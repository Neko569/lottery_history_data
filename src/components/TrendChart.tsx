import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LotteryData, LotteryType } from "@/types/lottery";
import { LOTTERY_RULES, TREND_PERIOD_OPTIONS } from "@/utils/lottery";
import { cn } from "@/lib/utils";

interface TrendChartProps {
  type: LotteryType;
  data: LotteryData | null;
}

/** 走势图折线颜色调色板 */
const PALETTE = [
  "#E63946",
  "#D4AF37",
  "#3A86FF",
  "#06D6A0",
  "#9B5DE5",
  "#F15BB5",
  "#FF9F1C",
];

/** 走势图：仅桌面端显示，展示各位置号码走势 */
export default function TrendChart({ type, data }: TrendChartProps) {
  const rule = LOTTERY_RULES[type];
  const [period, setPeriod] = useState(30);
  const [area, setArea] = useState<"front" | "back">("front");

  const count = area === "front" ? rule.frontCount : rule.backCount;
  const max = area === "front" ? rule.frontMax : rule.backMax;

  const chartData = useMemo(() => {
    if (!data || data.items.length === 0) return [];
    // 数据为倒序（最新在前），走势图需正序（旧→新），取最近 period 期
    const sliced = data.items.slice(0, period).reverse();
    return sliced.map((item) => {
      const nums = area === "front" ? item.front_numbers : item.back_numbers;
      const row: Record<string, string | number> = {
        term: String(item.term),
      };
      for (let i = 0; i < count; i++) {
        row[`p${i + 1}`] = nums[i] ? Number(nums[i]) : 0;
      }
      return row;
    });
  }, [data, period, area, count]);

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-base font-bold text-zinc-100">
            号码走势
          </h3>
          <span className="text-xs text-zinc-500">
            {area === "front" ? rule.frontLabel : rule.backLabel} · {count} 球
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* 前后区切换 */}
          <div className="seg">
            <button
              type="button"
              className={cn(
                "seg-item",
                area === "front" && "seg-item-active",
              )}
              onClick={() => setArea("front")}
            >
              {rule.frontLabel}
            </button>
            <button
              type="button"
              className={cn(
                "seg-item",
                area === "back" && "seg-item-active",
              )}
              onClick={() => setArea("back")}
            >
              {rule.backLabel}
            </button>
          </div>
          {/* 期数选择 */}
          <div className="seg">
            {TREND_PERIOD_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                className={cn(
                  "seg-item",
                  period === p && "seg-item-active",
                )}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
          暂无走势数据
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#24242F" />
              <XAxis
                dataKey="term"
                tick={{ fill: "#71717a", fontSize: 11, fontFamily: "JetBrains Mono" }}
                tickLine={false}
                axisLine={{ stroke: "#33333F" }}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                domain={[1, max]}
                tick={{ fill: "#71717a", fontSize: 11, fontFamily: "JetBrains Mono" }}
                tickLine={false}
                axisLine={{ stroke: "#33333F" }}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#131319",
                  border: "1px solid #33333F",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#D4AF37", fontFamily: "JetBrains Mono" }}
                itemStyle={{ color: "#e8e8ee" }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                iconType="circle"
              />
              {Array.from({ length: count }).map((_, i) => (
                <Line
                  key={`p${i + 1}`}
                  type="monotone"
                  dataKey={`p${i + 1}`}
                  name={`位置${i + 1}`}
                  stroke={PALETTE[i % PALETTE.length]}
                  strokeWidth={2}
                  dot={{ r: 2.5, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
