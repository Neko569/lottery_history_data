import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  Camera,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ScanText,
  Clock,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * CDN 资源路径（全部运行时从 jsDelivr 加载，不进 dist 打包）
 * - onnxruntime-web: ORT 推理引擎
 * - opencv.js: 图像预处理
 * - esearch-ocr: PaddleOCR 浏览器封装（基于 PP-OCRv3 模型）
 * - 模型文件: ppocr_det.onnx / ppocr_rec.onnx / ppocr_keys_v1.txt
 */
const CDN = {
  ort: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js",
  // opencv.js：docs.opencv.org 在部分网络环境下加载不稳定/被墙，
  // 优先用 jsDelivr 镜像（@tbmc/opencv-js 是 docs.opencv.org 文件的 npm 镜像），
  // 失败时回退到官方 docs.opencv.org。
  opencv: [
    "https://cdn.jsdelivr.net/npm/@tbmc/opencv-js@4.9.0-release.3-custom1/dist/opencv.min.js",
    "https://docs.opencv.org/4.8.0/opencv.js",
  ],
  esearchOcr: "https://cdn.jsdelivr.net/npm/esearch-ocr@5.1.5/dist/esearch-ocr.js",
  assetsPath: "https://cdn.jsdelivr.net/npm/paddleocr-browser@1.0.3/dist/",
};

/** OCR 识别进度阶段 */
type Stage = "idle" | "loading-model" | "ready" | "recognizing" | "done" | "error";

/** 单次识别项的展示结构 */
interface RecognizedItem {
  text: string;
  score: number;
}

/** eSearch-OCR 的返回结构（基于实际返回值，宽松类型） */
interface OcrLine {
  text?: string;
  mean?: number; // 置信度（esearch-ocr 用 mean 而非 score）
  box?: number[][];
}
interface OcrOutput {
  // src 是最完整的原始行数组，每项含 text/mean/box
  src?: OcrLine[];
  // 段落级聚合（text/mean/box）
  parragraphs?: OcrLine[]; // 注意：esearch-ocr 拼写为 parragraphs（双 r）
  columns?: { src?: OcrLine[] }[];
  text?: string;
  [key: string]: unknown;
}

/** 动态加载单个 script 标签（去重，已加载则跳过） */
function loadScriptSingle(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.getAttribute("data-loaded") === "true") return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error(`脚本加载失败: ${src}`)));
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      script.setAttribute("data-loaded", "true");
      resolve();
    };
    script.onerror = () => reject(new Error(`脚本加载失败: ${src}`));
    document.head.appendChild(script);
  });
}

/** 动态加载 script，支持多 URL fallback（前者失败则尝试下一个） */
async function loadScript(src: string | string[]): Promise<void> {
  const urls = Array.isArray(src) ? src : [src];
  let lastErr: unknown;
  for (const url of urls) {
    try {
      await loadScriptSingle(url);
      return;
    } catch (e) {
      lastErr = e;
      // 移除失败的 script 标签，避免下次命中缓存
      const failed = document.querySelector<HTMLScriptElement>(`script[src="${url}"]`);
      if (failed && failed.getAttribute("data-loaded") !== "true") failed.remove();
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("所有 CDN 加载失败");
}

/** 等待 OpenCV.js 运行时就绪（轮询全局 cv 对象） */
function waitForOpenCV(timeout = 60000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const cv = (window as unknown as { cv?: { Mat?: unknown } }).cv;
      if (cv && cv.Mat) return resolve();
      if (Date.now() - start > timeout) return reject(new Error("OpenCV.js 初始化超时"));
      setTimeout(check, 100);
    };
    check();
  });
}

/** File 转 dataURL（eSearch-OCR 的 ocr() 接收 dataURL） */
function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

/** dataURL 转 Image */
function dataURLToImage(dataURL: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片解析失败"));
    img.src = dataURL;
  });
}

/**
 * 图片预处理（使用 OpenCV.js），温和策略：
 * 1. 短边放大到至少 960px（彩票号码区域需要足够分辨率）
 * 2. 转灰度
 * 3. 轻量高斯模糊去噪（1x1，几乎不影响细节）
 *
 * 注意：不做二值化/CLAHE，实测会破坏彩票号码识别（彩色背景 + 印刷体数字
 * 场景下，二值化容易把号码区域和背景混在一起）。
 *
 * 失败时回退返回原图 dataURL，不阻断流程。
 */
async function preprocessImage(dataURL: string): Promise<{ dataURL: string; info: string }> {
  const cv = (window as unknown as { cv?: any }).cv;
  if (!cv || !cv.Mat) {
    console.warn("[OCR] OpenCV 不可用，跳过预处理");
    return { dataURL, info: "未预处理（OpenCV 不可用）" };
  }
  const t0 = performance.now();
  let src: any, gray: any, blur: any, dst: any, small: any;
  try {
    const img = await dataURLToImage(dataURL);

    // 用 canvas 读入原图到 Mat
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context 不可用");
    ctx.drawImage(img, 0, 0);
    src = cv.imread(canvas);
    console.log(`[OCR] 原图尺寸: ${src.cols}x${src.rows}, 通道: ${src.channels()}`);

    // 短边放大到至少 960px（彩票号码区域需要足够分辨率）
    const minSide = Math.min(src.cols, src.rows);
    let working = src;
    if (minSide < 960) {
      const scale = 960 / minSide;
      small = new cv.Mat();
      cv.resize(src, small, new cv.Size(0, 0), scale, scale, cv.INTER_CUBIC);
      console.log(`[OCR] 放大: ${src.cols}x${src.rows} -> ${small.cols}x${small.rows} (x${scale.toFixed(2)})`);
      working = small;
    }

    // 转灰度
    gray = new cv.Mat();
    cv.cvtColor(working, gray, cv.COLOR_RGBA2GRAY);

    // 轻量高斯模糊去噪（1x1，几乎不影响细节）
    blur = new cv.Mat();
    cv.GaussianBlur(gray, blur, new cv.Size(1, 1), 0);

    // 直接用 blur 作为输出（灰度 + 轻微去噪）
    dst = blur;

    // 输出到 canvas → dataURL
    const outCanvas = document.createElement("canvas");
    outCanvas.width = dst.cols;
    outCanvas.height = dst.rows;
    cv.imshow(outCanvas, dst);
    const outDataURL = outCanvas.toDataURL("image/png");
    const elapsed = performance.now() - t0;
    const info = `${src.cols}x${src.rows}→${dst.cols}x${dst.rows} 灰度+轻去噪 (${elapsed.toFixed(0)}ms)`;
    console.log(`[OCR] 预处理完成: ${info}`);
    return { dataURL: outDataURL, info };
  } catch (e) {
    console.warn("[OCR] 预处理失败，回退原图:", e);
    return { dataURL, info: `预处理失败: ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    // 释放 Mat 内存（OpenCV.js 用 WASM 堆，需手动释放）
    // 注意：dst = blur 是同一引用，只 delete 一次
    [src, gray, small].forEach((m) => {
      try { m?.delete?.(); } catch { /* ignore */ }
    });
    try { blur?.delete?.(); } catch { /* ignore */ }
  }
}

/**
 * PaddleOCR POC 页面（CDN 加载方案）
 *
 * 所有 OCR 依赖（onnxruntime-web、opencv.js、esearch-ocr、模型文件）均运行时从
 * jsDelivr CDN 加载，不打包进 dist，彻底避免：
 * - Cloudflare Pages 25MB 单文件限制
 * - worker entry chunk 加载失败导致通信错误
 * - 主 bundle 体积膨胀
 *
 * 模型为 PP-OCRv3 级别（ppocr_det/ppocr_rec），对彩票号码（印刷体数字）足够。
 */
export default function OcrPoc() {
  const [stage, setStage] = useState<Stage>("idle");
  const [progressMsg, setProgressMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [items, setItems] = useState<RecognizedItem[]>([]);
  const [totalText, setTotalText] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [preprocessInfo, setPreprocessInfo] = useState("");
  /** 是否启用预处理（默认关闭，彩票原图质量通常足够，预处理可能反而破坏） */
  const [preprocessEnabled, setPreprocessEnabled] = useState(false);
  /** 框选模式：开启后可在图片上拖拽框选区域，只识别框内部分 */
  const [cropMode, setCropMode] = useState(false);
  /** 当前框选区域（基于显示尺寸的像素坐标），null 表示未框选 */
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  /** 是否正在拖拽框选 */
  const [isDragging, setIsDragging] = useState(false);
  /** 当前已上传的文件，用于框选后重新识别 */
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  const paddleRef = useRef<{ init: (opts: unknown) => Promise<void>; ocr: (dataURL: string) => Promise<OcrOutput> } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const imgWrapRef = useRef<HTMLDivElement>(null);
  const imgElRef = useRef<HTMLImageElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  /** 懒加载初始化 OCR（首次识别时触发，按需加载 CDN 资源） */
  const ensureOcr = useCallback(async () => {
    if (paddleRef.current) return paddleRef.current;
    setStage("loading-model");
    console.log("[OCR] ===== 初始化 OCR 引擎 =====");
    setProgressMsg("正在加载 onnxruntime-web...");
    await loadScript(CDN.ort);
    console.log("[OCR] onnxruntime-web 已加载");

    setProgressMsg("正在加载 opencv.js（约 8MB，请稍候）...");
    await loadScript(CDN.opencv);
    await waitForOpenCV();
    console.log("[OCR] opencv.js 已就绪");

    setProgressMsg("正在加载 esearch-ocr...");
    // esearch-ocr 是 ESM 模块，动态 import
    const Paddle = await import(/* @vite-ignore */ CDN.esearchOcr);
    const ort = (window as unknown as { ort: unknown }).ort;
    const cv = (window as unknown as { cv: unknown }).cv;
    console.log("[OCR] esearch-ocr 模块已加载");

    setProgressMsg("正在加载 OCR 模型（首次约 5MB）...");
    const assetsPath = CDN.assetsPath;
    const dicRes = await fetch(assetsPath + "ppocr_keys_v1.txt");
    const dic = await dicRes.text();
    console.log("[OCR] 字典加载完成，长度:", dic.length);
    const initStart = performance.now();
    await Paddle.init({
      detPath: assetsPath + "ppocr_det.onnx",
      recPath: assetsPath + "ppocr_rec.onnx",
      dic,
      ort,
      node: false,
      cv,
    });
    console.log(`[OCR] 模型初始化完成，耗时 ${(performance.now() - initStart).toFixed(0)}ms`);

    paddleRef.current = Paddle as typeof paddleRef.current;
    setLoaded(true);
    setStage("ready");
    setProgressMsg("");
    console.log("[OCR] ===== 引擎就绪 =====");
    return paddleRef.current;
  }, []);

  /**
   * 根据框选区域裁剪原图（基于自然尺寸，避免显示缩放导致的精度损失）。
   * cropRect 是基于图片显示尺寸的坐标，需按显示/自然尺寸比例换算到原图坐标。
   * 返回裁剪后的 dataURL；无框选或失败时返回原图 dataURL。
   */
  const cropDataURL = useCallback(
    async (rawDataURL: string): Promise<{ dataURL: string; info: string }> => {
      if (!cropRect || !imgElRef.current) {
        return { dataURL: rawDataURL, info: "未框选，识别整图" };
      }
      const img = imgElRef.current;
      const scaleX = img.naturalWidth / img.clientWidth;
      const scaleY = img.naturalHeight / img.clientHeight;
      // 框选坐标是基于 img 元素左上角的，换算到自然像素
      const sx = Math.max(0, Math.round(cropRect.x * scaleX));
      const sy = Math.max(0, Math.round(cropRect.y * scaleY));
      const sw = Math.max(1, Math.round(cropRect.w * scaleX));
      const sh = Math.max(1, Math.round(cropRect.h * scaleY));
      console.log(`[OCR] 框选裁剪: 显示(${cropRect.x},${cropRect.y},${cropRect.w}x${cropRect.h}) → 原图(${sx},${sy},${sw}x${sh})`);

      const fullImg = await dataURLToImage(rawDataURL);
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      if (!ctx) return { dataURL: rawDataURL, info: "裁剪失败（canvas 不可用）" };
      ctx.drawImage(fullImg, sx, sy, sw, sh, 0, 0, sw, sh);
      const croppedDataURL = canvas.toDataURL("image/png");
      return { dataURL: croppedDataURL, info: `框选 ${sw}x${sh}（原图 ${img.naturalWidth}x${img.naturalHeight}）` };
    },
    [cropRect],
  );

  /** 框选拖拽：鼠标按下 */
  const onCropMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!cropMode || !imgElRef.current) return;
      const img = imgElRef.current;
      const rect = img.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      dragStartRef.current = { x, y };
      setIsDragging(true);
      setCropRect({ x, y, w: 0, h: 0 });
      e.preventDefault();
    },
    [cropMode],
  );

  /** 框选拖拽：鼠标移动 */
  const onCropMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragStartRef.current || !imgElRef.current) return;
      const img = imgElRef.current;
      const rect = img.getBoundingClientRect();
      const x = Math.max(0, Math.min(img.clientWidth, e.clientX - rect.left));
      const y = Math.max(0, Math.min(img.clientHeight, e.clientY - rect.top));
      const start = dragStartRef.current;
      setCropRect({
        x: Math.min(start.x, x),
        y: Math.min(start.y, y),
        w: Math.abs(x - start.x),
        h: Math.abs(y - start.y),
      });
    },
    [isDragging],
  );

  /** 框选拖拽：鼠标松开 */
  const onCropMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
    // 太小的框选视为取消
    if (cropRect && (cropRect.w < 10 || cropRect.h < 10)) {
      setCropRect(null);
    }
  }, [cropRect]);

  /**
   * 执行识别流程：初始化 OCR → 裁剪（若框选）→ 预处理（若开启）→ OCR → 解析结果。
   * 不处理文件校验和 UI 状态清理，由调用方负责。
   */
  const recognize = useCallback(
    async (file: File) => {
      try {
        const Paddle = await ensureOcr();
        setStage("recognizing");
        setProgressMsg("正在识别图片...");
        const rawDataURL = await fileToDataURL(file);
        console.log("[OCR] ===== 开始识别 =====");
        console.log("[OCR] 文件:", file.name, `${(file.size / 1024).toFixed(1)}KB`, file.type);

        // 1. 先裁剪（如果开启了框选模式且有框选区域）
        let workingDataURL = rawDataURL;
        let cropInfo = "未框选";
        if (cropMode && cropRect) {
          // 等待图片渲染，确保 imgElRef 有正确尺寸
          await new Promise((r) => setTimeout(r, 50));
          const r = await cropDataURL(rawDataURL);
          workingDataURL = r.dataURL;
          cropInfo = r.info;
          console.log("[OCR] 裁剪:", cropInfo);
        }

        // 2. 再预处理（如果开启）
        setProgressMsg("正在预处理图片...");
        let processedDataURL = workingDataURL;
        let info = cropInfo;
        if (preprocessEnabled) {
          const r = await preprocessImage(workingDataURL);
          processedDataURL = r.dataURL;
          info = `${cropInfo} + ${r.info}`;
        } else {
          console.log("[OCR] 跳过预处理");
        }
        setPreprocessInfo(info);

        setProgressMsg("正在识别图片...");
        const start = performance.now();
        // 主线程推理会短暂阻塞，先让浏览器渲染 loading
        await new Promise((r) => setTimeout(r, 0));
        const result = (await Paddle.ocr(processedDataURL)) as OcrOutput;
        const elapsed = performance.now() - start;
        console.log("[OCR] 识别耗时:", `${elapsed.toFixed(0)}ms`);
        console.log("[OCR] 原始返回结果:", result);

        // 从 result.src 取原始识别行（esearch-ocr 实际返回结构）
        // 每项含 text / mean（置信度）/ box
        const lines: OcrLine[] = Array.isArray(result?.src) ? result.src : [];
        const recognized: RecognizedItem[] = lines
          .map((b) => ({
            text: (b.text ?? "").trim(),
            score: typeof b.mean === "number" ? b.mean : 0,
          }))
          .filter((it) => it.text.length > 0);

        console.log("[OCR] 识别行数:", recognized.length);
        console.log("[OCR] 识别文本:");
        recognized.forEach((it, i) => console.log(`  [${i}] score=${it.score.toFixed(3)} text="${it.text}"`));

        setItems(recognized);
        setTotalText(recognized.map((r) => r.text).join("\n"));
        setElapsedMs(elapsed);
        setStage("done");
        setProgressMsg("");
        console.log("[OCR] ===== 识别完成 =====");
      } catch (e) {
        console.error("[OCR] 识别异常:", e);
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setStage("error");
      }
    },
    [ensureOcr, preprocessEnabled, cropMode, cropRect, cropDataURL],
  );

  /** 处理图片文件：校验 → 显示 → 识别 */
  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setErrorMsg("请选择图片文件");
        setStage("error");
        return;
      }
      setErrorMsg("");
      setImageUrl(URL.createObjectURL(file));
      setCurrentFile(file);
      setItems([]);
      setTotalText("");
      setElapsedMs(0);
      setPreprocessInfo("");
      // 新上传时清空旧框选（坐标基于旧图尺寸，已失效）
      setCropRect(null);
      await recognize(file);
    },
    [recognize],
  );

  /** 用当前图片和当前框选重新识别（不清空框选，用于框选后重识别） */
  const reRecognize = useCallback(async () => {
    if (!currentFile) return;
    setItems([]);
    setTotalText("");
    setElapsedMs(0);
    setPreprocessInfo("");
    setErrorMsg("");
    await recognize(currentFile);
  }, [currentFile, recognize]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 从识别文本中提取候选号码（1-2 位数字） */
  const candidateNumbers = items
    .flatMap((it) => it.text.match(/\d{1,2}/g) || [])
    .map((n) => n.padStart(2, "0"));

  return (
    <div className="min-h-screen">
      <div className="border-b border-ink-700/60 bg-ink-950/40">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-3 sm:px-6">
          <div>
            <h1 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100">
              OCR 识别 POC
            </h1>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              PaddleOCR 端侧识别彩票号码可行性验证（CDN 加载）
            </p>
          </div>
          {loaded && (
            <span className="flex items-center gap-1.5 rounded-full bg-green/10 px-3 py-1 text-xs text-green">
              <CheckCircle2 className="h-3 w-3" />
              模型已就绪
            </span>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
        {/* 说明卡 */}
        <div className="card mb-6 p-4 text-xs text-zinc-600 dark:text-zinc-300">
          <div className="mb-1 flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-200">
            <ScanText className="h-3.5 w-3.5 text-indigo" />
            POC 说明
          </div>
          <p>
            所有 OCR 依赖（onnxruntime-web、opencv.js、esearch-ocr、模型）均在首次识别时从
            jsDelivr CDN 加载，不打包进站点。推理完全在浏览器内进行，图片不会上传到任何服务器。
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 左侧：上传与预览 */}
          <div className="card p-4">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={stage === "loading-model" || stage === "recognizing"}
                className="btn btn-sm bg-indigo text-white hover:bg-indigo/90"
              >
                <Camera className="h-3.5 w-3.5" />
                拍照识别
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={stage === "loading-model" || stage === "recognizing"}
                className="btn btn-sm"
              >
                <Upload className="h-3.5 w-3.5" />
                上传图片
              </button>
              {currentFile && (
                <button
                  type="button"
                  onClick={reRecognize}
                  disabled={stage === "loading-model" || stage === "recognizing" || (cropMode && !cropRect)}
                  className="btn btn-sm bg-indigo text-white hover:bg-indigo/90"
                  title={cropMode && !cropRect ? "请先在图片上拖拽框选区域" : "用当前图片和框选重新识别"}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  重新识别
                </button>
              )}
              <label className={cn("flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400", currentFile ? "" : "ml-auto")}>
                <input
                  type="checkbox"
                  checked={cropMode}
                  onChange={(e) => {
                    setCropMode(e.target.checked);
                    if (!e.target.checked) setCropRect(null);
                  }}
                  className="h-3 w-3 cursor-pointer"
                />
                框选模式
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={preprocessEnabled}
                  onChange={(e) => setPreprocessEnabled(e.target.checked)}
                  className="h-3 w-3 cursor-pointer"
                />
                启用预处理（放大+灰度）
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
              {(stage === "loading-model" || stage === "recognizing") && (
                <span className="flex items-center gap-1.5 text-xs text-indigo">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  {progressMsg || "处理中..."}
                </span>
              )}
            </div>

            <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-ink-600 bg-ink-950/30 p-4">
              {imageUrl ? (
                <div
                  ref={imgWrapRef}
                  className={cn(
                    "relative inline-block select-none",
                    cropMode && "cursor-crosshair",
                  )}
                  onMouseDown={onCropMouseDown}
                  onMouseMove={onCropMouseMove}
                  onMouseUp={onCropMouseUp}
                  onMouseLeave={onCropMouseUp}
                >
                  <img
                    ref={imgElRef}
                    src={imageUrl}
                    alt="待识别图片"
                    className="max-h-[400px] w-auto max-w-full object-contain pointer-events-none"
                    draggable={false}
                  />
                  {cropMode && cropRect && cropRect.w > 0 && cropRect.h > 0 && (
                    <div
                      className="absolute border-2 border-indigo bg-indigo/20 pointer-events-none"
                      style={{
                        left: cropRect.x,
                        top: cropRect.y,
                        width: cropRect.w,
                        height: cropRect.h,
                      }}
                    />
                  )}
                  {cropMode && !cropRect && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="rounded bg-black/60 px-2 py-1 text-[10px] text-white">
                        在图片上拖拽框选识别区域
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-zinc-500 dark:text-zinc-400">
                  <ImageIcon className="mx-auto mb-2 h-10 w-10 opacity-50" />
                  <p className="text-xs">点击上方按钮上传或拍照</p>
                </div>
              )}
            </div>
          </div>

          {/* 右侧：识别结果 */}
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                识别结果
              </span>
              {stage === "done" && (
                <span className="flex items-center gap-1 text-xs text-green-500">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  识别完成
                </span>
              )}
              {stage === "error" && (
                <span className="flex items-center gap-1 text-xs text-crimson">
                  <AlertCircle className="h-3.5 w-3.5" />
                  识别失败
                </span>
              )}
            </div>

            {stage === "error" && errorMsg && (
              <div className="mb-3 rounded-lg border border-crimson/40 bg-crimson/10 px-3 py-2 text-xs text-crimson-400">
                {errorMsg}
              </div>
            )}

            {stage === "done" && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-ink-900/40 px-3 py-2 text-xs">
                <Clock className="h-3 w-3 text-indigo" />
                <span className="text-zinc-500 dark:text-zinc-400">耗时</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {elapsedMs.toFixed(0)}ms
                </span>
                <span className="ml-2 text-zinc-500 dark:text-zinc-400">· 识别行</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {items.length}
                </span>
                {preprocessInfo && (
                  <>
                    <span className="ml-2 text-zinc-500 dark:text-zinc-400">· 预处理</span>
                    <span className="font-mono text-[10px] text-zinc-600 dark:text-zinc-400">
                      {preprocessInfo}
                    </span>
                  </>
                )}
              </div>
            )}

            {items.length > 0 ? (
              <div className="space-y-2">
                <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                  原始识别行（共 {items.length} 行）
                </div>
                <div className="max-h-[280px] space-y-1 overflow-y-auto">
                  {items.map((it, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-md bg-ink-900/40 px-2 py-1.5 text-xs"
                    >
                      <span className="font-mono text-zinc-900 dark:text-zinc-100">{it.text}</span>
                      {it.score > 0 && (
                        <span
                          className={cn(
                            "ml-2 rounded px-1.5 py-0.5 text-[10px]",
                            it.score >= 0.9
                              ? "bg-green/20 text-green"
                              : it.score >= 0.7
                                ? "bg-yellow-400/20 text-yellow-600 dark:text-yellow-400"
                                : "bg-crimson/20 text-crimson",
                          )}
                        >
                          {(it.score * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="border-t border-ink-700/60 pt-2">
                  <div className="mb-1.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                    候选号码（自动从文本提取 1-2 位数字）
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {candidateNumbers.length > 0 ? (
                      candidateNumbers.map((n, i) => (
                        <span
                          key={i}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo/20 font-mono text-xs font-bold text-indigo"
                        >
                          {n}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        未提取到数字
                      </span>
                    )}
                  </div>
                </div>

                {totalText && (
                  <div className="border-t border-ink-700/60 pt-2">
                    <div className="mb-1.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                      完整文本
                    </div>
                    <pre className="max-h-[120px] overflow-auto whitespace-pre-wrap rounded-md bg-ink-900/40 p-2 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                      {totalText}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              stage !== "error" && (
                <div className="py-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
                  {stage === "idle"
                    ? "上传图片后将显示识别结果"
                    : stage === "done"
                      ? "未识别到文本"
                      : "等待识别..."}
                </div>
              )
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
