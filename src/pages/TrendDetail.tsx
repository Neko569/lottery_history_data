import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import type { LotteryType } from "@/types/lottery";
import { LOTTERY_RULES } from "@/utils/lottery";
import { useLotteryStore } from "@/store/lotteryStore";
import FullNumberTrendChart from "@/components/FullNumberTrendChart";

export default function TrendDetail() {
  const navigate = useNavigate();
  const params = useParams<{ type: LotteryType }>();
  const type = params.type || "dlt";
  const rule = LOTTERY_RULES[type];
  const state = useLotteryStore((s) => s.states[type]);

  return (
    <div className="min-h-screen">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-20 border-b border-ink-700 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="btn-ghost h-9 w-9 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="leading-tight">
            <h1 className="font-serif text-lg font-bold text-zinc-900">
              {rule.name} - 完整号码走势
            </h1>
            <p className="text-[10px] text-zinc-500">
              前区 {rule.frontLabel} 1-{rule.frontMax} · 后区 {rule.backLabel} 1-{rule.backMax}
            </p>
          </div>
        </div>
      </header>

      {/* 内容区 */}
      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        <FullNumberTrendChart type={type} data={state.data} />
      </main>
    </div>
  );
}
