import { cn } from "@/lib/utils";

interface LotteryBallProps {
  number: string;
  /** 球的类别：前区/红球 或 后区/蓝球 */
  variant: "front" | "back";
  /** 尺寸 */
  size?: "xs" | "sm" | "md" | "lg";
  /** 是否高亮（命中），undefined表示不应用高亮逻辑 */
  highlight?: boolean;
  className?: string;
}

/** 号码球：前区/红球朱砂红渐变，后区/蓝球靛蓝渐变 */
export default function LotteryBall({
  number,
  variant,
  size = "md",
  highlight,
  className,
}: LotteryBallProps) {
  const sizes: Record<string, string> = {
    xs: "h-5 w-5 text-[10px]",
    sm: "h-7 w-7 text-xs",
    md: "h-9 w-9 text-sm",
    lg: "h-11 w-11 text-base",
  };

  const isFront = variant === "front";

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center rounded-full font-mono font-bold tabular-nums text-white shadow-md transition-all",
        sizes[size],
        isFront
          ? "bg-gradient-to-br from-crimson-400 via-crimson to-crimson-700"
          : "bg-gradient-to-br from-indigo-400 via-indigo to-indigo-700",
        highlight === true && "ring-2 ring-yellow-400 ring-offset-1 ring-offset-ink-900 scale-110",
        highlight === false && "opacity-60",
        className,
      )}
    >
      {/* 高光 */}
      <span className="pointer-events-none absolute left-1 top-1 h-2 w-2 rounded-full bg-white/40 blur-[1px]" />
      <span className="relative drop-shadow-sm">{number}</span>
    </span>
  );
}
