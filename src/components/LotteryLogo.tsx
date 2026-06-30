import { LOTTERIES, type LotteryType } from "@/utils/lottery";

interface LotteryLogoProps {
  type: LotteryType;
  className?: string;
}

/**
 * 彩种 Logo：按注册表 `LOTTERIES[type].logo` 配置统一渲染。
 * 新增彩种只需在注册表补 logo 配置，无需在此添加分支。
 */
export function LotteryLogo({ type, className = "" }: LotteryLogoProps) {
  const { logo, rule } = LOTTERIES[type];
  // 每个彩种独立 gradient id，避免同页多 Logo 渐变冲突
  const gradId = `logoGrad-${type}`;
  const rangeText = `${rule.frontMax} ${rule.backMax}`;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className={className}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={logo.gradientFrom} />
          <stop offset="100%" stopColor={logo.gradientTo} />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill={`url(#${gradId})`} />
      <text x="50" y="38" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
        {logo.topText}
      </text>
      <text x="50" y="55" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">
        {rule.name}
      </text>
      <text x="50" y="73" textAnchor="middle" fill={logo.rangeColor} fontSize="11" fontWeight="bold">
        {rangeText}
      </text>
    </svg>
  );
}
