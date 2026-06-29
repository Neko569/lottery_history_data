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

/** eSearch-OCR 的返回结构（宽松类型，防御性处理） */
interface OcrBlock {
  text?: string;
  score?: number;
  box?: number[][];
}
interface OcrOutput {
  text?: string;
  blocks?: OcrBlock[];
  // 兼容其他可能的结构
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

  const paddleRef = useRef<{ init: (opts: unknown) => Promise<void>; ocr: (dataURL: string) => Promise<OcrOutput> } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  /** 懒加载初始化 OCR（首次识别时触发，按需加载 CDN 资源） */
  const ensureOcr = useCallback(async () => {
    if (paddleRef.current) return paddleRef.current;
    setStage("loading-model");
    setProgressMsg("正在加载 onnxruntime-web...");
    await loadScript(CDN.ort);

    setProgressMsg("正在加载 opencv.js（约 8MB，请稍候）...");
    await loadScript(CDN.opencv);
    await waitForOpenCV();

    setProgressMsg("正在加载 esearch-ocr...");
    // esearch-ocr 是 ESM 模块，动态 import
    const Paddle = await import(/* @vite-ignore */ CDN.esearchOcr);
    const ort = (window as unknown as { ort: unknown }).ort;
    const cv = (window as unknown as { cv: unknown }).cv;

    setProgressMsg("正在加载 OCR 模型（首次约 5MB）...");
    const assetsPath = CDN.assetsPath;
    const dicRes = await fetch(assetsPath + "ppocr_keys_v1.txt");
    const dic = await dicRes.text();
    await Paddle.init({
      detPath: assetsPath + "ppocr_det.onnx",
      recPath: assetsPath + "ppocr_rec.onnx",
      dic,
      ort,
      node: false,
      cv,
    });

    paddleRef.current = Paddle as typeof paddleRef.current;
    setLoaded(true);
    setStage("ready");
    setProgressMsg("");
    return paddleRef.current;
  }, []);

  /** 处理图片文件：初始化 OCR → 识别 → 展示结果 */
  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setErrorMsg("请选择图片文件");
        setStage("error");
        return;
      }
      setErrorMsg("");
      setImageUrl(URL.createObjectURL(file));
      setItems([]);
      setTotalText("");
      setElapsedMs(0);

      try {
        const Paddle = await ensureOcr();
        setStage("recognizing");
        setProgressMsg("正在识别图片...");
        const dataURL = await fileToDataURL(file);
        const start = performance.now();
        // 主线程推理会短暂阻塞，先让浏览器渲染 loading
        await new Promise((r) => setTimeout(r, 0));
        const result = (await Paddle.ocr(dataURL)) as OcrOutput;
        const elapsed = performance.now() - start;

        // 防御性解析结果结构
        const blocks: OcrBlock[] = Array.isArray(result?.blocks) ? result.blocks : [];
        const recognized: RecognizedItem[] = blocks
          .map((b) => ({
            text: (b.text ?? "").trim(),
            score: typeof b.score === "number" ? b.score : 0,
          }))
          .filter((it) => it.text.length > 0);

        setItems(recognized);
        setTotalText(result?.text ?? recognized.map((r) => r.text).join("\n"));
        setElapsedMs(elapsed);
        setStage("done");
        setProgressMsg("");
      } catch (e) {
        console.error(e);
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setStage("error");
      }
    },
    [ensureOcr],
  );

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
                <img
                  src={imageUrl}
                  alt="待识别图片"
                  className="max-h-[400px] w-auto max-w-full object-contain"
                />
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
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-ink-900/40 px-3 py-2 text-xs">
                <Clock className="h-3 w-3 text-indigo" />
                <span className="text-zinc-500 dark:text-zinc-400">耗时</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {elapsedMs.toFixed(0)}ms
                </span>
                <span className="ml-2 text-zinc-500 dark:text-zinc-400">· 识别行</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {items.length}
                </span>
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
