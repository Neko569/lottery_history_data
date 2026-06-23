import { useState } from "react";
import { Shuffle, Trash2 } from "lucide-react";
import type { LotteryType, RandomTicket } from "@/types/lottery";
import { LOTTERY_RULES, generateTickets } from "@/utils/lottery";
import LotteryBall from "./LotteryBall";
import { cn } from "@/lib/utils";

interface RandomGeneratorProps {
  type: LotteryType;
}

const COUNT_OPTIONS = [1, 5, 10];

/** 随机号码生成器 */
export default function RandomGenerator({ type }: RandomGeneratorProps) {
  const rule = LOTTERY_RULES[type];
  const [count, setCount] = useState(1);
  const [tickets, setTickets] = useState<RandomTicket[]>([]);

  const handleGenerate = () => {
    setTickets(generateTickets(type, count));
  };

  const handleClear = () => setTickets([]);

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shuffle className="h-4 w-4 text-gold" />
          <h3 className="font-serif text-base font-bold text-zinc-100">
            随机生成
          </h3>
          <span className="text-xs text-zinc-500">
            {rule.frontCount}+{rule.backCount}
          </span>
        </div>
        {tickets.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="text-zinc-500 transition-colors hover:text-crimson"
            aria-label="清空"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <div className="seg">
          {COUNT_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              className={cn("seg-item", count === c && "seg-item-active")}
              onClick={() => setCount(c)}
            >
              {c}注
            </button>
          ))}
        </div>
        <button type="button" className="btn-gold ml-auto" onClick={handleGenerate}>
          <Shuffle className="h-4 w-4" />
          生成
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-ink-700 text-sm text-zinc-600">
          点击「生成」获取随机号码
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tickets.map((ticket, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-xl border border-ink-700/60 bg-ink-900/50 px-3 py-2 animate-pop-in"
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <span className="w-6 shrink-0 text-center font-mono text-xs text-zinc-500">
                {idx + 1}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {ticket.front.map((n, i) => (
                  <LotteryBall key={`f-${i}`} number={n} variant="front" size="sm" />
                ))}
                <span className="mx-1 h-4 w-px bg-ink-600" />
                {ticket.back.map((n, i) => (
                  <LotteryBall key={`b-${i}`} number={n} variant="back" size="sm" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
