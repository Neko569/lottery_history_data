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

interface FullNumberTrendChartProps {
  type: LotteryType;
  data: LotteryData | null;
}

const PALETTE = [
  "#E63946",
  "#D4AF37",
  "#3A86FF",
  "#06D6A0",
  "#9B5DE5",
  "#F15BB5",
  "#FF9F1C",
];

export default function FullNumberTrendChart({ type, data }: FullNumberTrendChartProps) {
  const rule = LOTTERY_RULES[type];
  const [period, setPeriod] = useState(50);
  const [area, setArea] = useState<"front" | "back">("front");
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);

  const maxNum = area === "front" ? rule.frontMax : rule.backMax;
  const label = area === "front" ? rule.frontLabel : rule.backLabel;

  const chartData = useMemo(() => {
    if (!data || data.items.length === 0) return [];
    const sliced = data.items.slice(0, period).reverse();
    return sliced.map((item, idx) => {
      const nums = area === "front" ? item.front_numbers : item.back_numbers;
      const row: Record<string, string | number> = {
        term: String(item.term),
        date: item.draw_time,
        index: idx,
      };
      for (let n = 1; n <= maxNum; n++) {
        row[`n${n}`] = nums.includes(String(n).padStart(2, "0")) ? 1 : 0;
      }
      return row;
    });
  }, [data, period, area, maxNum]);

  const handleNumberToggle = (num: number) => {
    setSelectedNumbers((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num].sort((a, b) => a - b),
    );
  };

  const displayNumbers = selectedNumbers.length > 0 ? selectedNumbers : Array.from({ length: Math.min(8, maxNum) }, (_, i) => i + 1);

  return (
    <div className="space-y-4">
      {/* 控制面板 */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="seg">
              <button
                type="button"
                className={cn("seg-item", area === "front" && "seg-item-active")}
                onClick={() => {
                  setArea("front");
                  setSelectedNumbers([]);
                }}
              >
                {rule.frontLabel}
              </button>
              <button
                type="button"
                className={cn("seg-item", area === "back" && "seg-item-active")}
                onClick={() => {
                  setArea("back");
                  setSelectedNumbers([]);
                }}
              >
                {rule.backLabel}
              </button>
            </div>
            <div className="seg">
              {TREND_PERIOD_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={cn("seg-item", period === p && "seg-item-active")}
                  onClick={() => setPeriod(p)}
                >
                  {p}期
                </button>
              ))}
            </div>
          </div>
          <div className="text-xs text-zinc-500">
            {label} 号码范围：1-{maxNum}
          </div>
        </div>
      </div>

      {/* 号码选择器 */}
      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-700">选择要查看的号码</span>
          {selectedNumbers.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedNumbers([])}
              className="text-xs text-crimson hover:underline"
            >
              清空选择
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: maxNum }, (_, i) => i + 1).map((num) => (
            <button
              key={num}
              type="button"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg text-sm font-mono font-medium transition-all",
                selectedNumbers.includes(num)
                  ? "bg-crimson text-white shadow-glow"
                  : "border border-ink-700 bg-ink-800/60 text-zinc-700 hover:border-crimson/60 hover:text-zinc-900",
              )}
              onClick={() => handleNumberToggle(num)}
            >
              {String(num).padStart(2, "0")}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          提示：点击号码可切换选中状态，最多同时查看8个号码的走势；未选择时默认显示前8个号码
        </p>
      </div>

      {/* 走势图 */}
      {chartData.length === 0 ? (
        <div className="card flex h-80 items-center justify-center text-sm text-zinc-500">
          暂无走势数据
        </div>
      ) : (
        <div className="card p-4">
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 12, left: -8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
                <XAxis
                  dataKey="term"
                  tick={{ fill: "#71717a", fontSize: 11, fontFamily: "JetBrains Mono" }}
                  tickLine={false}
                  axisLine={{ stroke: "#D1D1D8" }}
                  interval="preserveStartEnd"
                  minTickGap={15}
                />
                <YAxis
                  domain={[0, 1]}
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "#D1D1D8" }}
                  width={32}
                  ticks={[0, 1]}
                  tickFormatter={(v) => (v === 1 ? "出现" : "未出")}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E5E5EA",
                    borderRadius: 12,
                    fontSize: 12,
                    boxShadow: "0 8px 24px -8px rgba(0,0,0,0.15)",
                  }}
                  labelFormatter={(label) => {
                    const item = chartData.find((d) => String(d.term) === String(label));
                    return `${label} · ${item?.date || ""}`;
                  }}
                  labelStyle={{ color: "#B8932B", fontFamily: "JetBrains Mono" }}
                  itemStyle={{ color: "#27272a" }}
                  formatter={(value: number, name: string) => [
                    value === 1 ? "✓ 出现" : "未出现",
                    `号码 ${name.replace("n", "")}`,
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  iconType="circle"
                />
                {displayNumbers.map((num, i) => (
                  <Line
                    key={`n${num}`}
                    type="step"
                    dataKey={`n${num}`}
                    name={`号码 ${String(num).padStart(2, "0")}`}
                    stroke={PALETTE[i % PALETTE.length]}
                    strokeWidth={2}
                    dot={{ r: num <= 8 ? 3 : 0, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 号码统计 */}
      {chartData.length > 0 && (
        <div className="card p-4">
          <h4 className="mb-3 text-sm font-medium text-zinc-900">号码出现频率统计</h4>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {Array.from({ length: maxNum }, (_, i) => i + 1).map((num) => {
              const count = chartData.filter((d) => d[`n${num}`] === 1).length;
              const rate = ((count / chartData.length) * 100).toFixed(1);
              return (
                <div
                  key={num}
                  className={cn(
                    "flex flex-col items-center rounded-lg border border-ink-700 p-2",
                    selectedNumbers.includes(num) && "border-crimson/40 bg-crimson/5",
                  )}
                >
                  <span className="font-mono text-sm font-medium text-zinc-900">
                    {String(num).padStart(2, "0")}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {count}次 ({rate}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
