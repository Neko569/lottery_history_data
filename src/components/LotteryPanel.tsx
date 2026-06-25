import { useRef } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Upload, AlertCircle, CheckCircle2, Cloud, TrendingUp } from "lucide-react";
import type { LotteryType } from "@/types/lottery";
import { LOTTERY_RULES, DATA_REPO_URL } from "@/utils/lottery";
import { useLotteryStore } from "@/store/lotteryStore";
import LotteryList from "./LotteryList";
import TrendChart from "./TrendChart";
import RandomGenerator from "./RandomGenerator";
import { LotteryLogo } from "./LotteryLogo";
import { cn } from "@/lib/utils";

interface LotteryPanelProps {
  type: LotteryType;
  /** 是否桌面端（决定是否显示走势图） */
  isDesktop: boolean;
  /** 分屏模式下使用更紧凑的布局 */
  compact?: boolean;
}

/** 单彩种面板：列表 + 走势图(桌面) + 随机生成 */
export default function LotteryPanel({
  type,
  isDesktop,
  compact,
}: LotteryPanelProps) {
  const rule = LOTTERY_RULES[type];
  const state = useLotteryStore((s) => s.states[type]);
  const pageSize = useLotteryStore((s) => s.pageSize);
  const setCurrentPage = useLotteryStore((s) => s.setCurrentPage);
  const fetchRemoteData = useLotteryStore((s) => s.fetchRemoteData);
  const uploadData = useLotteryStore((s) => s.uploadData);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const accentText =
    rule.accent === "crimson" ? "text-crimson" : "text-indigo";
  const accentBorder =
    rule.accent === "crimson" ? "border-crimson/40" : "border-indigo/40";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadData(type, file);
    }
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 面板头 */}
      <div
        className={cn(
          "card flex items-center justify-between gap-3 border-l-2 p-3",
          accentBorder,
        )}
      >
        <div className="flex items-center gap-3">
          <LotteryLogo type={type} className="h-10 w-10 rounded-xl" />
          <div className="leading-tight">
            <h2 className={cn("font-serif text-lg font-bold", accentText)}>
              {rule.name}
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {rule.frontLabel} {rule.frontCount}/{rule.frontMax} ·{" "}
              {rule.backLabel} {rule.backCount}/{rule.backMax}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            to={`/trend/${type}`}
            className="btn-ghost h-9 w-9 p-0"
            title="完整号码走势"
          >
            <TrendingUp className="h-4 w-4" />
          </Link>
          <button
            type="button"
            className="btn-ghost h-9 w-9 p-0"
            onClick={() => fetchRemoteData(type)}
            title="刷新数据"
            disabled={state.loading}
          >
            <RefreshCw className={cn("h-4 w-4", state.loading && "animate-spin")} />
          </button>
          <button
            type="button"
            className="btn-ghost h-9 w-9 p-0"
            onClick={() => fileInputRef.current?.click()}
            title="手动上传 JSON"
          >
            <Upload className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* 数据源状态 */}
      <DataSourceBadge
        source={state.source}
        loading={state.loading}
        error={state.error}
        generatedAt={state.data?.generated_at}
      />

      {/* 主体内容：桌面端单视图左右布局，分屏/移动端上下堆叠 */}
      <div
        className={cn(
          "flex gap-4",
          isDesktop && !compact ? "flex-row" : "flex-col",
        )}
      >
        <div className="min-w-0 flex-1">
          <LotteryList
            type={type}
            data={state.data}
            pageSize={pageSize}
            currentPage={state.currentPage}
            onPageChange={(p) => setCurrentPage(type, p)}
            loading={state.loading}
          />
        </div>

        <div
          className={cn(
            "flex shrink-0 flex-col gap-4",
            isDesktop && !compact ? "w-[420px]" : "w-full",
          )}
        >
          <TrendChart type={type} data={state.data} />
          <RandomGenerator type={type} />
        </div>
      </div>
    </div>
  );
}

/** 数据来源状态徽标 */
function DataSourceBadge({
  source,
  loading,
  error,
  generatedAt,
}: {
  source: "remote" | "upload" | null;
  loading: boolean;
  error: string | null;
  generatedAt?: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-ink-700/60 bg-ink-900/50 px-3 py-2 text-xs text-zinc-400 dark:text-zinc-300">
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-gold" />
        正在加载数据…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-crimson/40 bg-crimson/10 px-3 py-2 text-xs text-crimson-400">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (source === "remote") {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-700/60 bg-ink-900/50 px-3 py-2 text-xs text-zinc-400 dark:text-zinc-300">
        <Cloud className="h-3.5 w-3.5 text-indigo-400" />
        <span>数据来源：开源仓库</span>
        <a
          href={DATA_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-400 underline-offset-2 hover:underline"
        >
          get_lottery_data
        </a>
        {generatedAt && (
          <span className="text-zinc-600 dark:text-zinc-500">· 更新于 {generatedAt}</span>
        )}
      </div>
    );
  }

  if (source === "upload") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-gold-300">
        <CheckCircle2 className="h-3.5 w-3.5" />
        数据来源：本地手动上传
      </div>
    );
  }

  return null;
}
