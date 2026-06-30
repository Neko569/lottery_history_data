import LotteryPanel from "./LotteryPanel";
import { LOTTERY_TYPES } from "@/utils/lottery";

interface SplitViewProps {
  isDesktop: boolean;
}

/** 分屏视图：遍历注册表全部彩种，分别展示独立面板 */
export default function SplitView({ isDesktop }: SplitViewProps) {
  return (
    <div
      className={
        isDesktop
          ? "grid grid-cols-2 gap-4"
          : "flex flex-col gap-4"
      }
    >
      {LOTTERY_TYPES.map((t) => (
        <div key={t} className="min-w-0">
          <LotteryPanel type={t} isDesktop={isDesktop} compact />
        </div>
      ))}
    </div>
  );
}
