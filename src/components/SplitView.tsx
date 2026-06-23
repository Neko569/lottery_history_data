import LotteryPanel from "./LotteryPanel";

interface SplitViewProps {
  isDesktop: boolean;
}

/** 分屏视图：左右分别展示大乐透与双色球 */
export default function SplitView({ isDesktop }: SplitViewProps) {
  return (
    <div
      className={
        isDesktop
          ? "grid grid-cols-2 gap-4"
          : "flex flex-col gap-4"
      }
    >
      <div className="min-w-0">
        <LotteryPanel type="dlt" isDesktop={isDesktop} compact />
      </div>
      <div className="min-w-0">
        <LotteryPanel type="ssq" isDesktop={isDesktop} compact />
      </div>
    </div>
  );
}
