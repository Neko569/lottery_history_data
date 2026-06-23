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

type TrendType = "position" | "sum" | "parity";

const PALETTE = [
  "#E63946",
  "#D4AF37",
  "#3A86FF",
  "#06D6A0",
  "#9B5DE5",
  "#F15BB5",
  "#FF9F1C",
];

const TREND_TYPE_LABELS: Record<TrendType, string> = {
  position: "位置走势",
  sum: "和值走势",
  parity: "奇偶比",
};

export default function TrendChart({ type, data }: TrendChartProps) {
  const rule = LOTTERY_RULES[type];
  const [period, setPeriod] = useState(30);
  const [area, setArea] = useState<"front" | "back">("front");
  const [trendType, setTrendType] = useState<TrendType>("position");

  const count = area === "front" ? rule.frontCount : rule.backCount;
  const max = area === "front" ? rule.frontMax : rule.backMax;

  const chartData = useMemo(() => {
    if (!data || data.items.length === 0) return [];
    const sliced = data.items.slice(0, period).reverse();

    return sliced.map((item) => {
      const nums = area === "front" ? item.front_numbers : item.back_numbers;
      const numValues = nums.map((n) => Number(n));
      const row: Record<string, string | number> = {
        term: String(item.term),
      };

      if (trendType === "position") {
        for (let i = 0; i < count; i++) {
          row[`p${i + 1}`] = numValues[i] || 0;
        }
      } else if (trendType === "sum") {
        const sum = numValues.reduce((acc, val) => acc + val, 0);
        row["sum"] = sum;
        row["avg"] = (sum / count).toFixed(1);
      } else if (trendType === "parity") {
        const even = numValues.filter((n) => n % 2 === 0).length;
        const odd = numValues.filter((n) => n % 2 === 1).length;
        row["even"] = even;
        row["odd"] = odd;
        row["ratio"] = odd > 0 ? (even / odd).toFixed(2) : even;
      }

      return row;
    });
  }, [data, period, area, count, trendType]);

  const getChartLines = () => {
    if (trendType === "position") {
      return Array.from({ length: count }).map((_, i) => (
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
      ));
    } else if (trendType === "sum") {
      return [
        <Line
          key="sum"
          type="monotone"
          dataKey="sum"
          name="和值"
          stroke="#E63946"
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />,
        <Line
          key="avg"
          type="monotone"
          dataKey="avg"
          name="平均值"
          stroke="#3A86FF"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ r: 3, strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />,
      ];
    } else if (trendType === "parity") {
      return [
        <Line
          key="even"
          type="monotone"
          dataKey="even"
          name="偶数个数"
          stroke="#3A86FF"
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />,
        <Line
          key="odd"
          type="monotone"
          dataKey="odd"
          name="奇数个数"
          stroke="#E63946"
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />,
      ];
    }
    return [];
  };

  const getYAxisDomain = () => {
    if (trendType === "position") {
      return [1, max] as [number, number];
    } else if (trendType === "sum") {
      return [count, count * max] as [number, number];
    } else if (trendType === "parity") {
      return [0, count] as [number, number];
    }
    return [0, 100] as [number, number];
  };

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-base font-bold text-zinc-900">
            号码走势
          </h3>
          <span className="text-xs text-zinc-500">
            {area === "front" ? rule.frontLabel : rule.backLabel} · {count} 球
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* 走势图类型切换 */}
          <div className="seg">
            {(Object.keys(TREND_TYPE_LABELS) as TrendType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={cn(
                  "seg-item",
                  trendType === t && "seg-item-active",
                )}
                onClick={() => setTrendType(t)}
              >
                {TREND_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
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
                {p}期
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
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
              <XAxis
                dataKey="term"
                tick={{ fill: "#71717a", fontSize: 11, fontFamily: "JetBrains Mono" }}
                tickLine={false}
                axisLine={{ stroke: "#D1D1D8" }}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                domain={getYAxisDomain()}
                tick={{ fill: "#71717a", fontSize: 11, fontFamily: "JetBrains Mono" }}
                tickLine={false}
                axisLine={{ stroke: "#D1D1D8" }}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E5E5EA",
                  borderRadius: 12,
                  fontSize: 12,
                  boxShadow: "0 8px 24px -8px rgba(0,0,0,0.15)",
                }}
                labelStyle={{ color: "#B8932B", fontFamily: "JetBrains Mono" }}
                itemStyle={{ color: "#27272a" }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                iconType="circle"
              />
              {getChartLines()}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
