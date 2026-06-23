import type { LotteryType } from "@/types/lottery";

interface LotteryLogoProps {
  type: LotteryType;
  className?: string;
}

export function LotteryLogo({ type, className = "" }: LotteryLogoProps) {
  if (type === "dlt") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        className={className}
      >
        <defs>
          <linearGradient id="dltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E63946" />
            <stop offset="100%" stopColor="#9B2335" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="45" fill="url(#dltGrad)" />
        <text
          x="50"
          y="40"
          textAnchor="middle"
          fill="white"
          fontSize="12"
          fontWeight="bold"
        >
          超级
        </text>
        <text
          x="50"
          y="58"
          textAnchor="middle"
          fill="white"
          fontSize="16"
          fontWeight="bold"
        >
          大乐透
        </text>
        <text
          x="50"
          y="75"
          textAnchor="middle"
          fill="#FFD700"
          fontSize="10"
        >
          35 12
        </text>
      </svg>
    );
  }

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className={className}>
      <defs>
        <linearGradient id="ssqGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E63946" />
          <stop offset="100%" stopColor="#9B2335" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill="url(#ssqGrad)" />
      <text
        x="50"
        y="38"
        textAnchor="middle"
        fill="white"
        fontSize="11"
        fontWeight="bold"
      >
        中国
      </text>
      <text
        x="50"
        y="54"
        textAnchor="middle"
        fill="white"
        fontSize="16"
        fontWeight="bold"
      >
        双色球
      </text>
      <text
        x="50"
        y="72"
        textAnchor="middle"
        fill="#3A86FF"
        fontSize="11"
        fontWeight="bold"
      >
        33 16
      </text>
    </svg>
  );
}