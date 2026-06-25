import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { LotteryType } from "@/types/lottery";
import { LOTTERY_RULES, toLotteryType } from "@/utils/lottery";
import { useLotteryStore } from "@/store/lotteryStore";
import FullNumberTrendChart from "@/components/FullNumberTrendChart";
import { cn } from "@/lib/utils";

/** 走势页可选彩种，与对比分析页保持一致 */
const TREND_TYPES: LotteryType[] = ["dlt", "ssq"];

export default function TrendDetail() {
  const navigate = useNavigate();
  const params = useParams<{ type: LotteryType }>();
  const type = toLotteryType(params.type);
  const rule = LOTTERY_RULES[type];
  const state = useLotteryStore((s) => s.states[type]);
  const fetchRemoteData = useLotteryStore((s) => s.fetchRemoteData);

  useEffect(() => {
    if (!state.data && !state.loading) {
      fetchRemoteData(type);
    }
  }, [type, state.data, state.loading, fetchRemoteData]);

  return (
    <div className="min-h-screen">
      <div className="border-b border-ink-700/60 bg-ink-950/40">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="leading-tight">
            <h1 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {rule.name} - 完整号码走势
            </h1>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              前区 {rule.frontLabel} 1-{rule.frontMax} · 后区 {rule.backLabel} 1-{rule.backMax}
            </p>
          </div>

          {/* 彩种切换 */}
          <div className="flex shrink-0 rounded-lg border border-ink-600 overflow-hidden">
            {TREND_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => navigate(`/trend/${t}`)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  type === t
                    ? "bg-crimson text-white"
                    : "bg-ink-900 text-zinc-400 hover:bg-ink-800 dark:text-zinc-300",
                )}
              >
                {LOTTERY_RULES[t].name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        <FullNumberTrendChart type={type} data={state.data} />
      </main>
    </div>
  );
}
