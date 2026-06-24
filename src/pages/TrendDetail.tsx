import { useEffect } from "react";
import { useParams } from "react-router-dom";
import type { LotteryType } from "@/types/lottery";
import { LOTTERY_RULES } from "@/utils/lottery";
import { useLotteryStore } from "@/store/lotteryStore";
import FullNumberTrendChart from "@/components/FullNumberTrendChart";

export default function TrendDetail() {
  const params = useParams<{ type: LotteryType }>();
  const type = params.type || "dlt";
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
        <div className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6">
          <h1 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {rule.name} - 完整号码走势
          </h1>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            前区 {rule.frontLabel} 1-{rule.frontMax} · 后区 {rule.backLabel} 1-{rule.backMax}
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        <FullNumberTrendChart type={type} data={state.data} />
      </main>
    </div>
  );
}
