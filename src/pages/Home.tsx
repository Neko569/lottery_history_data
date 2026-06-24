import ControlBar from "@/components/ControlBar";
import LotteryPanel from "@/components/LotteryPanel";
import SplitView from "@/components/SplitView";
import { useLotteryStore } from "@/store/lotteryStore";
import { useDeviceDetect } from "@/hooks/useDeviceDetect";
import { useLotteryData } from "@/hooks/useLotteryData";

export default function Home() {
  useLotteryData();
  const isDesktop = useDeviceDetect();
  const splitView = useLotteryStore((s) => s.splitView);
  const activeLottery = useLotteryStore((s) => s.activeLottery);

  return (
    <div className="min-h-screen">
      <ControlBar splitView={splitView} />

      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        {splitView ? (
          <SplitView isDesktop={isDesktop} />
        ) : (
          <LotteryPanel type={activeLottery} isDesktop={isDesktop} />
        )}
      </main>

      <footer className="mx-auto max-w-[1600px] px-4 pb-8 pt-4 text-center text-xs text-zinc-600 dark:text-zinc-500 sm:px-6">
        <p>
          数据开源 · 仅供学习研究，不构成任何投注建议 · 请理性购彩
        </p>
      </footer>
    </div>
  );
}
