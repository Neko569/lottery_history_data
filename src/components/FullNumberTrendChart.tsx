import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from "recharts";
import type { LotteryData, LotteryType } from "@/types/lottery";
import { LOTTERY_RULES, TREND_PERIOD_OPTIONS } from "@/utils/lottery";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

interface FullNumberTrendChartProps {
  type: LotteryType;
  data: LotteryData | null;
}

type TrendType = "position" | "miss" | "sum" | "parity" | "size" | "prime";

const TREND_TYPE_LABELS: Record<TrendType, string> = {
  position: "位置走势",
  miss: "遗漏走势",
  sum: "和值走势",
  parity: "奇偶走势",
  size: "大小走势",
  prime: "质合走势",
};

const PALETTE = ["#E63946", "#D4AF37", "#3A86FF", "#06D6A0", "#9B5DE5", "#F15BB5", "#FF9F1C"];

const isPrime = (n: number): boolean => {
  if (n <= 1) return false;
  if (n <= 3) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
};

export default function FullNumberTrendChart({ type, data }: FullNumberTrendChartProps) {
  const rule = LOTTERY_RULES[type];
  const { isDark } = useTheme();
  const [period, setPeriod] = useState(50);
  const [area, setArea] = useState<"front" | "back">("front");
  const [trendType, setTrendType] = useState<TrendType>("position");
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);

  // 图表主题色
  const chartColors = {
    grid: isDark ? "#2a2a38" : "#E5E5EA",
    axisLine: isDark ? "#3a3a4a" : "#D1D1D8",
    tick: "#71717a",
    tooltipBg: isDark ? "#16161f" : "#FFFFFF",
    tooltipBorder: isDark ? "#2a2a38" : "#E5E5EA",
    tooltipItem: isDark ? "#e5e5e5" : "#27272a",
    heatmapEmpty: isDark ? "#1c1c28" : "#f4f4f7",
  };

  const maxNum = area === "front" ? rule.frontMax : rule.backMax;
  const count = area === "front" ? rule.frontCount : rule.backCount;
  const label = area === "front" ? rule.frontLabel : rule.backLabel;
  const midValue = Math.floor(maxNum / 2) + 1;

  const chartData = useMemo(() => {
    if (!data || data.items.length === 0) return [];
    const sliced = data.items.slice(0, period).reverse();

    // 遗漏走势需要跨条目累计，在 map 外维护计数字典
    const missCount: Record<number, number> = {};

    return sliced.map((item) => {
      const nums = area === "front" ? item.front_numbers : item.back_numbers;
      const numValues = nums.map((n) => Number(n));
      const row: Record<string, string | number> = {
        term: String(item.term),
        date: item.draw_time,
      };

      if (trendType === "position") {
        for (let i = 0; i < count; i++) {
          row[`p${i + 1}`] = numValues[i] || 0;
        }
      } else if (trendType === "miss") {
        for (let n = 1; n <= maxNum; n++) {
          if (nums.includes(String(n).padStart(2, "0"))) {
            missCount[n] = 0;
            row[`m${n}`] = 0;
          } else {
            missCount[n] = (missCount[n] || 0) + 1;
            row[`m${n}`] = missCount[n];
          }
        }
      } else if (trendType === "sum") {
        const sum = numValues.reduce((acc, val) => acc + val, 0);
        row["sum"] = sum;
        row["avg"] = (sum / count).toFixed(1);
      } else if (trendType === "parity") {
        const even = numValues.filter((n) => n % 2 === 0).length;
        const odd = count - even;
        row["even"] = even;
        row["odd"] = odd;
      } else if (trendType === "size") {
        const big = numValues.filter((n) => n >= midValue).length;
        const small = count - big;
        row["big"] = big;
        row["small"] = small;
      } else if (trendType === "prime") {
        const prime = numValues.filter(isPrime).length;
        const composite = count - prime;
        row["prime"] = prime;
        row["composite"] = composite;
      }

      return row;
    });
  }, [data, period, area, maxNum, count, trendType, midValue]);

  const heatmapData = useMemo(() => {
    if (!data || data.items.length === 0) return [];
    const sliced = data.items.slice(0, Math.min(50, period));
    return sliced.map((item, idx) => {
      const nums = area === "front" ? item.front_numbers : item.back_numbers;
      const row: Record<string, number | string> = { term: String(item.term), index: idx };
      for (let n = 1; n <= maxNum; n++) {
        row[`n${n}`] = nums.includes(String(n).padStart(2, "0")) ? 1 : 0;
      }
      return row;
    });
  }, [data, period, area, maxNum]);

  const missData = useMemo(() => {
    if (!data || data.items.length === 0) return [];
    const currentMiss: Record<number, number> = {};
    for (let n = 1; n <= maxNum; n++) {
      currentMiss[n] = 0;
    }
    const result: Record<number, number> = {};
    for (let n = 1; n <= maxNum; n++) {
      result[n] = 0;
    }
    const items = data.items.slice(0, period);
    for (let i = items.length - 1; i >= 0; i--) {
      const nums = area === "front" ? items[i].front_numbers : items[i].back_numbers;
      for (let n = 1; n <= maxNum; n++) {
        if (nums.includes(String(n).padStart(2, "0"))) {
          currentMiss[n] = 0;
        } else {
          currentMiss[n]++;
        }
      }
    }
    for (let n = 1; n <= maxNum; n++) {
      result[n] = currentMiss[n];
    }
    return Object.entries(result).map(([num, miss]) => ({
      num: Number(num),
      miss: miss as number,
    }));
  }, [data, period, area, maxNum]);

  const frequencyData = useMemo(() => {
    if (!data || data.items.length === 0) return [];
    const sliced = data.items.slice(0, period);
    const freq: Record<number, number> = {};
    for (let n = 1; n <= maxNum; n++) {
      freq[n] = 0;
    }
    sliced.forEach((item) => {
      const nums = area === "front" ? item.front_numbers : item.back_numbers;
      for (let n = 1; n <= maxNum; n++) {
        if (nums.includes(String(n).padStart(2, "0"))) {
          freq[n]++;
        }
      }
    });
    return Object.entries(freq).map(([num, count]) => ({
      num: Number(num),
      count,
      rate: ((count / period) * 100).toFixed(1),
    }));
  }, [data, period, area, maxNum]);

  const getChartLines = () => {
    // 数据点描边色：与所在卡片背景形成对比，避免点融入背景
    const dotStroke = isDark ? "#16161f" : "#FFFFFF";
    if (trendType === "position") {
      return Array.from({ length: count }).map((_, i) => {
        const color = PALETTE[i % PALETTE.length];
        return (
          <Line
            key={`p${i + 1}`}
            type="monotone"
            dataKey={`p${i + 1}`}
            name={`${label}${i + 1}`}
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3, fill: color, stroke: dotStroke, strokeWidth: 1 }}
            activeDot={{ r: 6, fill: color, stroke: dotStroke, strokeWidth: 1.5 }}
            connectNulls
          />
        );
      });
    } else if (trendType === "miss") {
      const displayNums = selectedNumbers.length > 0 ? selectedNumbers : Array.from({ length: Math.min(6, maxNum) }, (_, i) => i + 1);
      return displayNums.map((num, i) => {
        const color = PALETTE[i % PALETTE.length];
        return (
          <Line
            key={`m${num}`}
            type="monotone"
            dataKey={`m${num}`}
            name={`号码 ${String(num).padStart(2, "0")}`}
            stroke={color}
            strokeWidth={2}
            dot={{ r: 2, fill: color, stroke: dotStroke, strokeWidth: 1 }}
            activeDot={{ r: 5, fill: color, stroke: dotStroke, strokeWidth: 1.5 }}
          />
        );
      });
    } else if (trendType === "sum") {
      return [
        <Line key="sum" type="monotone" dataKey="sum" name="和值" stroke="#E63946" strokeWidth={2} dot={{ r: 3, fill: "#E63946", stroke: dotStroke, strokeWidth: 1 }} activeDot={{ r: 6, fill: "#E63946", stroke: dotStroke, strokeWidth: 1.5 }} />,
        <Line key="avg" type="monotone" dataKey="avg" name="平均值" stroke="#3A86FF" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: "#3A86FF", stroke: dotStroke, strokeWidth: 1 }} activeDot={{ r: 6, fill: "#3A86FF", stroke: dotStroke, strokeWidth: 1.5 }} />,
      ];
    } else if (trendType === "parity") {
      return [
        <Line key="even" type="monotone" dataKey="even" name="偶数" stroke="#3A86FF" strokeWidth={2} dot={{ r: 3, fill: "#3A86FF", stroke: dotStroke, strokeWidth: 1 }} activeDot={{ r: 6, fill: "#3A86FF", stroke: dotStroke, strokeWidth: 1.5 }} />,
        <Line key="odd" type="monotone" dataKey="odd" name="奇数" stroke="#E63946" strokeWidth={2} dot={{ r: 3, fill: "#E63946", stroke: dotStroke, strokeWidth: 1 }} activeDot={{ r: 6, fill: "#E63946", stroke: dotStroke, strokeWidth: 1.5 }} />,
      ];
    } else if (trendType === "size") {
      return [
        <Line key="big" type="monotone" dataKey="big" name="大号" stroke="#E63946" strokeWidth={2} dot={{ r: 3, fill: "#E63946", stroke: dotStroke, strokeWidth: 1 }} activeDot={{ r: 6, fill: "#E63946", stroke: dotStroke, strokeWidth: 1.5 }} />,
        <Line key="small" type="monotone" dataKey="small" name="小号" stroke="#3A86FF" strokeWidth={2} dot={{ r: 3, fill: "#3A86FF", stroke: dotStroke, strokeWidth: 1 }} activeDot={{ r: 6, fill: "#3A86FF", stroke: dotStroke, strokeWidth: 1.5 }} />,
      ];
    } else if (trendType === "prime") {
      return [
        <Line key="prime" type="monotone" dataKey="prime" name="质数" stroke="#06D6A0" strokeWidth={2} dot={{ r: 3, fill: "#06D6A0", stroke: dotStroke, strokeWidth: 1 }} activeDot={{ r: 6, fill: "#06D6A0", stroke: dotStroke, strokeWidth: 1.5 }} />,
        <Line key="composite" type="monotone" dataKey="composite" name="合数" stroke="#9B5DE5" strokeWidth={2} dot={{ r: 3, fill: "#9B5DE5", stroke: dotStroke, strokeWidth: 1 }} activeDot={{ r: 6, fill: "#9B5DE5", stroke: dotStroke, strokeWidth: 1.5 }} />,
      ];
    }
    return [];
  };

  const getYAxisDomain = () => {
    if (trendType === "position") return [1, maxNum] as [number, number];
    if (trendType === "miss") return [0, Math.max(10, period)] as [number, number];
    if (trendType === "sum") return [count, count * maxNum] as [number, number];
    return [0, count] as [number, number];
  };

  const handleNumberToggle = (num: number) => {
    setSelectedNumbers((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num].sort((a, b) => a - b).slice(0, 6),
    );
  };

  return (
    <div className="space-y-4">
      {/* 控制面板 */}
      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <div className="flex flex-wrap items-center gap-2">
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
            <div className="h-4 w-px bg-zinc-300" />
            <div className="seg flex flex-wrap sm:inline-flex">
              {(Object.keys(TREND_TYPE_LABELS) as TrendType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={cn("seg-item", trendType === t && "seg-item-active")}
                  onClick={() => setTrendType(t)}
                >
                  {TREND_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="seg flex flex-wrap sm:inline-flex sm:ml-auto">
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
      </div>

      {/* 号码选择器（遗漏走势时显示） */}
      {trendType === "miss" && (
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">选择号码查看遗漏走势</span>
            {selectedNumbers.length > 0 && (
              <button type="button" onClick={() => setSelectedNumbers([])} className="text-xs text-crimson hover:underline">
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
                    : "border border-ink-700 bg-ink-800/60 text-zinc-700 hover:border-crimson/60 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100",
                )}
                onClick={() => handleNumberToggle(num)}
              >
                {String(num).padStart(2, "0")}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">提示：点击号码可切换选中状态，最多同时查看6个号码的遗漏走势</p>
        </div>
      )}

      {/* 走势图 */}
      {chartData.length === 0 ? (
        <div className="card flex h-80 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">暂无走势数据</div>
      ) : (
        <div className="card p-4">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis
                  dataKey="term"
                  tick={{ fill: chartColors.tick, fontSize: 11, fontFamily: "JetBrains Mono" }}
                  tickLine={false}
                  axisLine={{ stroke: chartColors.axisLine }}
                  interval="preserveStartEnd"
                  minTickGap={15}
                />
                <YAxis
                  domain={getYAxisDomain()}
                  tick={{ fill: chartColors.tick, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: chartColors.axisLine }}
                  width={40}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#B8932B", fontFamily: "JetBrains Mono" }}
                  itemStyle={{ color: chartColors.tooltipItem }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8, maxHeight: 48, overflow: "hidden" }}
                  iconType="circle"
                  iconSize={9}
                />
                {getChartLines()}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 号码热力图 */}
      {heatmapData.length > 0 && (
        <div className="card p-4">
          <h4 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">号码分布热力图（最近50期）</h4>
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              {/* 号码列标题 */}
              <div className="flex items-center gap-1 mb-1">
                <span className="w-16 flex-shrink-0 text-right text-xs font-mono text-zinc-400 dark:text-zinc-500">期号</span>
                {Array.from({ length: maxNum }, (_, i) => i + 1).map((n) => (
                  <div
                    key={n}
                    className="flex-1 text-center text-[10px] font-mono font-medium text-zinc-600 dark:text-zinc-400"
                  >
                    {String(n).padStart(2, "0")}
                  </div>
                ))}
              </div>
              {/* 热力图数据 */}
              <div className="grid grid-cols-1 gap-0.5">
                {heatmapData.map((row) => (
                  <div key={row.term as string} className="flex items-center gap-0.5">
                    <span className="w-16 flex-shrink-0 text-right text-xs font-mono text-zinc-500 dark:text-zinc-400">
                      {(row.term as string).slice(-3)}
                    </span>
                    {Array.from({ length: maxNum }, (_, i) => i + 1).map((n) => (
                      <div
                        key={n}
                        className={cn(
                          "flex-1 h-5 flex items-center justify-center rounded-sm transition-colors text-[10px] font-mono",
                          row[`n${n}`] === 1
                            ? "bg-crimson text-white font-bold"
                            : "text-zinc-400 dark:text-zinc-500",
                        )}
                        style={row[`n${n}`] === 0 ? { backgroundColor: chartColors.heatmapEmpty } : undefined}
                        title={`${row.term} - 号码 ${String(n).padStart(2, "0")}: ${row[`n${n}`] === 1 ? "出现" : "未出"}`}
                      >
                        {String(n).padStart(2, "0")}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-end gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-crimson" /> 出现
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: chartColors.heatmapEmpty }} /> 未出
            </span>
          </div>
        </div>
      )}

      {/* 遗漏统计与频率统计 */}
      {missData.length > 0 && frequencyData.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card p-4">
            <h4 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">当前遗漏期数</h4>
            <div className="grid grid-cols-5 gap-1 sm:grid-cols-7">
              {missData.map((item) => (
                <div
                  key={item.num}
                  className={cn(
                    "flex flex-col items-center rounded-lg border border-ink-700 p-1.5",
                    item.miss >= 10 && "border-crimson/40 bg-crimson/5",
                  )}
                >
                  <span className="font-mono text-xs font-medium text-zinc-900 dark:text-zinc-100">{String(item.num).padStart(2, "0")}</span>
                  <span className={cn("text-[10px]", item.miss >= 10 ? "text-crimson" : "text-zinc-500 dark:text-zinc-400")}>
                    {item.miss}期
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <h4 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">号码出现频率（{period}期）</h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={frequencyData} layout="vertical" margin={{ top: 5, right: 5, left: 30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={false} />
                  <XAxis type="number" tick={{ fill: chartColors.tick, fontSize: 10 }} tickLine={false} axisLine={{ stroke: chartColors.axisLine }} />
                  <YAxis
                    type="category"
                    dataKey="num"
                    tick={{ fill: chartColors.tick, fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: chartColors.axisLine }}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, fontSize: 11 }}
                    formatter={(value: number, name: string, props: { payload: { num: number; rate: string } }) => [
                      `${value}次 (${props.payload.rate}%)`,
                      `号码 ${String(props.payload.num).padStart(2, "0")}`,
                    ]}
                  />
                  <Bar dataKey="count" fill="#E63946" radius={[0, 4, 4, 0]}>
                    {frequencyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.count >= period * 0.3 ? "#E63946" : "#3A86FF"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
