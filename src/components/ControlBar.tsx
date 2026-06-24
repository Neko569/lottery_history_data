import { Columns2, Rows2 } from "lucide-react";
import type { LotteryType } from "@/types/lottery";
import { LOTTERY_RULES, PAGE_SIZE_OPTIONS } from "@/utils/lottery";
import { useLotteryStore } from "@/store/lotteryStore";
import { cn } from "@/lib/utils";

interface ControlBarProps {
  /** 是否处于分屏模式（分屏时隐藏彩种切换） */
  splitView: boolean;
}

/** 首页二级工具栏：彩种切换 / 分屏 / 每页条数
 *  品牌与主题切换已上移至全局 Navbar */
export default function ControlBar({ splitView }: ControlBarProps) {
  const activeLottery = useLotteryStore((s) => s.activeLottery);
  const setActiveLottery = useLotteryStore((s) => s.setActiveLottery);
  const setSplitView = useLotteryStore((s) => s.setSplitView);
  const pageSize = useLotteryStore((s) => s.pageSize);
  const setPageSize = useLotteryStore((s) => s.setPageSize);

  return (
    <div className="border-b border-ink-700/60 bg-ink-950/40">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        {/* 彩种切换：分屏时隐藏 */}
        {!splitView && (
          <div className="seg">
            {(Object.keys(LOTTERY_RULES) as LotteryType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={cn(
                  "seg-item",
                  activeLottery === t && "seg-item-active",
                )}
                onClick={() => setActiveLottery(t)}
              >
                {LOTTERY_RULES[t].name}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* 分屏开关 */}
          <button
            type="button"
            className={cn(
              "btn",
              splitView
                ? "bg-gold text-zinc-900 shadow-glow-gold"
                : "border border-ink-600 bg-ink-800/60 text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100",
            )}
            onClick={() => setSplitView(!splitView)}
            aria-pressed={splitView}
            title={splitView ? "切换为单视图" : "切换为分屏视图"}
          >
            {splitView ? (
              <Columns2 className="h-4 w-4" />
            ) : (
              <Rows2 className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {splitView ? "分屏中" : "分屏"}
            </span>
          </button>

          {/* 每页条数 */}
          <label className="flex items-center gap-1.5 rounded-full border border-ink-600 bg-ink-800/60 py-1.5 pl-3 pr-1.5 text-sm text-zinc-400 dark:text-zinc-300">
            <span className="hidden sm:inline">每页</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="cursor-pointer rounded-full bg-ink-700 px-2 py-0.5 text-sm font-medium text-zinc-900 outline-none hover:bg-ink-600 dark:text-zinc-100"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n} className="bg-ink-800 dark:text-zinc-100">
                  {n}
                </option>
              ))}
            </select>
            <span className="hidden sm:inline">条</span>
          </label>
        </div>
      </div>
    </div>
  );
}
