import { useMemo } from "react";
import type { LotteryData, LotteryType } from "@/types/lottery";
import { LOTTERY_RULES, ACCENT_STYLES } from "@/utils/lottery";
import LotteryBall from "./LotteryBall";
import Pagination from "./Pagination";
import { cn } from "@/lib/utils";

interface LotteryListProps {
  type: LotteryType;
  data: LotteryData | null;
  pageSize: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

/** 开奖历史列表 + 分页 */
export default function LotteryList({
  type,
  data,
  pageSize,
  currentPage,
  onPageChange,
  loading,
}: LotteryListProps) {
  const rule = LOTTERY_RULES[type];

  const { pageItems, totalPages, total } = useMemo(() => {
    const items = data?.items ?? [];
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * pageSize;
    const pageItems = items.slice(start, start + pageSize);
    return { pageItems, totalPages, total };
  }, [data, pageSize, currentPage]);

  if (loading) {
    return <ListSkeleton />;
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="text-zinc-400 dark:text-zinc-300">暂无开奖数据</p>
        <p className="text-xs text-zinc-600 dark:text-zinc-500">
          可点击右上角刷新或手动上传 JSON 文件
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="card overflow-hidden">
        {/* 表头 */}
        <div className="flex items-center gap-3 border-b border-ink-700/70 bg-ink-900/60 px-4 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <span className="w-20 shrink-0 font-mono">期号</span>
          <span className="hidden w-24 shrink-0 sm:block">开奖日期</span>
          <span className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "font-medium",
                ACCENT_STYLES[rule.accent].text400,
              )}
            >
              {rule.frontLabel}
            </span>
            {rule.backCount > 0 && (
              <>
                <span className="text-zinc-700 dark:text-zinc-500">·</span>
                <span
                  className={cn(
                    "font-medium",
                    ACCENT_STYLES[rule.accent].text400Alt,
                  )}
                >
                  {rule.backLabel}
                </span>
              </>
            )}
          </span>
        </div>

        {/* 数据行 */}
        {pageItems.map((item, idx) => (
          <div
            key={String(item.term)}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-ink-800/60",
              idx % 2 === 1 && "bg-ink-900/30",
            )}
          >
            <span className="w-20 shrink-0 font-mono text-sm text-gold-300">
              {item.term}
            </span>
            <span className="hidden w-24 shrink-0 font-mono text-xs text-zinc-500 dark:text-zinc-400 sm:block">
              {item.draw_time.slice(0, 10)}
            </span>
            <div className="flex flex-1 items-center gap-1.5 overflow-x-auto whitespace-nowrap">
              {item.front_numbers.map((n, i) => (
                <LotteryBall key={`f-${i}`} number={n} variant="front" size="sm" />
              ))}
              {rule.backCount > 0 && item.back_numbers.length > 0 && (
                <>
                  <span className="mx-1 h-4 w-px bg-ink-600" />
                  {item.back_numbers.map((n, i) => (
                    <LotteryBall key={`b-${i}`} number={n} variant="back" size="sm" />
                  ))}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-1 text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          共 <span className="font-mono text-zinc-700 dark:text-zinc-300">{total}</span> 条记录
        </span>
        <span>
          第 <span className="font-mono text-zinc-700 dark:text-zinc-300">{currentPage}</span> /{" "}
          {totalPages} 页
        </span>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}

/** 加载骨架屏 */
function ListSkeleton() {
  return (
    <div className="card overflow-hidden">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-ink-800 px-4 py-3"
        >
          <div className="skeleton h-4 w-20 rounded" />
          <div className="skeleton h-4 w-20 rounded" />
          <div className="flex flex-1 gap-1.5">
            {Array.from({ length: 7 }).map((_, j) => (
              <div key={j} className="skeleton h-7 w-7 rounded-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
