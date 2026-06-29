import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  Camera,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ScanText,
  Cpu,
  Clock,
  Image as ImageIcon,
} from "lucide-react";
import type { PaddleOCR as PaddleOCRType, OcrResult } from "@paddleocr/paddleocr-js";
import { cn } from "@/lib/utils";

/** OCR 实例类型：create() 返回主线程 PaddleOCR 或 Worker 模式代理的联合类型 */
type OcrInstance = Awaited<ReturnType<typeof PaddleOCRType.create>>;

/** OCR 识别进度阶段 */
type Stage = "idle" | "loading-model" | "ready" | "recognizing" | "done" | "error";

/** 单次识别项的展示结构 */
interface RecognizedItem {
  text: string;
  score: number;
}

/**
 * PaddleOCR POC 页面
 * 用于验证浏览器端 OCR 识别彩票号码图片的可行性
 * 不接入业务逻辑，仅展示：上传图片 → 识别 → 原始结果
 */
export default function OcrPoc() {
  const [stage, setStage] = useState<Stage>("idle");
  const [progressMsg, setProgressMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [items, setItems] = useState<RecognizedItem[]>([]);
  const [metrics, setMetrics] = useState<OcrResult["metrics"] | null>(null);
  const [runtime, setRuntime] = useState<OcrResult["runtime"] | null>(null);
  const [backend, setBackend] = useState("");

  const ocrRef = useRef<OcrInstance | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  /** 懒加载初始化 OCR 实例（首次识别时触发，避免页面打开就下载模型） */
  const ensureOcr = useCallback(async (): Promise<OcrInstance> => {
    if (ocrRef.current) return ocrRef.current;
    setStage("loading-model");
    setProgressMsg("正在加载 PaddleOCR 模型（首次约 5-10MB，请稍候）...");
    // 动态 import，避免 OCR SDK 进入主 bundle
    const { PaddleOCR } = await import("@paddleocr/paddleocr-js");
    // 不使用 worker 模式：worker entry chunk 达 10MB+，
    // 在 Cloudflare Pages 等静态托管下加载不稳定（易超时/被扩展拦截），
    // 主线程单线程 WASM 推理仅短暂阻塞 ~500-1500ms，可接受。
    const ocr = await PaddleOCR.create({
      lang: "ch",
      ocrVersion: "PP-OCRv5",
      worker: false,
      ortOptions: {
        // 单线程 WASM + SIMD，无需 COOP/COEP，GitHub Pages 直接可用
        backend: "wasm",
        wasmPaths: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/",
        numThreads: 1,
        simd: true,
      },
    });
    ocrRef.current = ocr;
    const summary = ocr.getInitializationSummary?.();
    setBackend(summary?.backend || "wasm");
    setStage("ready");
    setProgressMsg("");
    return ocr;
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
      setMetrics(null);
      setRuntime(null);

      try {
        const ocr = await ensureOcr();
        setStage("recognizing");
        setProgressMsg("正在识别图片...");
        // 主线程模式下 OCR 会阻塞 UI，先让浏览器渲染 loading 状态
        await new Promise((r) => setTimeout(r, 0));
        const results = await ocr.predict(file);
        const result = results[0];
        if (!result) {
          setErrorMsg("未返回识别结果");
          setStage("error");
          return;
        }
        setItems(
          result.items.map((it) => ({
            text: it.text,
            score: it.score,
          })),
        );
        setMetrics(result.metrics);
        setRuntime(result.runtime);
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
      // 组件卸载时释放模型与对象 URL
      ocrRef.current?.dispose?.();
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 从识别文本中提取候选号码（2位数字） */
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
              PaddleOCR.js 端侧识别彩票号码可行性验证
            </p>
          </div>
          {backend && (
            <span className="flex items-center gap-1.5 rounded-full bg-indigo/10 px-3 py-1 text-xs text-indigo">
              <Cpu className="h-3 w-3" />
              后端: {backend}
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
            本页面用于验证 PaddleOCR.js 在浏览器端识别彩票号码图片的可行性。模型在首次识别时从 CDN
            下载（约 5-10MB），推理完全在浏览器内进行，图片不会上传到任何服务器。
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

            {metrics && (
              <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-ink-900/40 px-2 py-2">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                    <Clock className="h-2.5 w-2.5" />
                    总耗时
                  </div>
                  <div className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {metrics.totalMs.toFixed(0)}ms
                  </div>
                </div>
                <div className="rounded-lg bg-ink-900/40 px-2 py-2">
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400">检测框</div>
                  <div className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {metrics.detectedBoxes}
                  </div>
                </div>
                <div className="rounded-lg bg-ink-900/40 px-2 py-2">
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400">识别行</div>
                  <div className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {metrics.recognizedCount}
                  </div>
                </div>
              </div>
            )}

            {runtime && (
              <div className="mb-3 rounded-lg bg-ink-950/40 px-3 py-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                backend={runtime.requestedBackend} · det={runtime.detProvider} · rec={runtime.recProvider}
                · WebGPU={runtime.webgpuAvailable ? "可用" : "不可用"}
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
