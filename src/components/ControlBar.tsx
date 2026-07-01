import { Columns2, Rows2, ChevronDown } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { LotteryType } from "@/types/lottery";
import {
  LOTTERY_RULES,
  PAGE_SIZE_OPTIONS,
  LOTTERY_CATEGORIES,
  getCategoryOf,
  type LotteryCategory,
} from "@/utils/lottery";
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

  const [activeCategory, setActiveCategory] = useState<LotteryCategory>(() =>
    getCategoryOf(activeLottery),
  );

  // activeLottery 被外部修改时，同步大类选中态
  useEffect(() => {
    setActiveCategory(getCategoryOf(activeLottery));
  }, [activeLottery]);

  const categoryLotteries =
    LOTTERY_CATEGORIES.find((c) => c.key === activeCategory)?.lotteries ?? [];

  /** 点击大类：切换展示的彩种列表；若当前彩种不在该大类下，自动切到该大类第一个彩种 */
  const handleCategoryClick = (cat: LotteryCategory) => {
    setActiveCategory(cat);
    const list =
      LOTTERY_CATEGORIES.find((c) => c.key === cat)?.lotteries ?? [];
    if (list.length > 0 && !list.includes(activeLottery)) {
      setActiveLottery(list[0]);
    }
  };

  const Controls = (
    <div className="flex flex-wrap items-center gap-2">
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
  );

  return (
    <div className="border-b border-ink-700/60 bg-ink-950/40">
      <div className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6">
        {!splitView ? (
          <>
            {/* 第一行：大分类（体育彩票 / 福利彩票）+ 工具控件 */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="seg">
                {LOTTERY_CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    className={cn(
                      "seg-item",
                      activeCategory === cat.key && "seg-item-active",
                    )}
                    onClick={() => handleCategoryClick(cat.key)}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              <div className="ml-auto">{Controls}</div>
            </div>

            {/* 第二行：小分类（具体彩种），显示不下时收进「更多」 */}
            <div className="mt-2">
              <LotterySelector
                lotteries={categoryLotteries}
                activeLottery={activeLottery}
                onSelect={setActiveLottery}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <div className="ml-auto">{Controls}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 彩种选择行：自动测量可用宽度，放不下的彩种收进「更多」下拉 */
function LotterySelector({
  lotteries,
  activeLottery,
  onSelect,
}: {
  lotteries: LotteryType[];
  activeLottery: LotteryType;
  onSelect: (t: LotteryType) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  /** 离屏测量行：渲染全部彩种按钮 + 「更多」按钮，仅用于获取真实宽度 */
  const measureRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(lotteries.length);
  const [moreOpen, setMoreOpen] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const row = rowRef.current;
      const measureRow = measureRef.current;
      if (!row || !measureRow) return;
      const containerWidth = row.clientWidth;
      const children = Array.from(measureRow.children) as HTMLElement[];
      if (children.length === 0) return;
      // 测量行最后一个是「更多」按钮，前面的是彩种按钮
      const moreWidth = children[children.length - 1].offsetWidth;
      const itemWidths = children
        .slice(0, -1)
        .map((el) => el.offsetWidth);
      // seg 容器内部 gap-1(4px)；seg 自身 p-1(4px*2) + border(1px*2) = 10px 开销
      const gap = 4;
      const segOverhead = 10;
      const available = containerWidth - segOverhead;

      // 全部放得下，无需「更多」
      const totalAll =
        itemWidths.reduce((s, w) => s + w, 0) +
        Math.max(0, itemWidths.length - 1) * gap;
      if (totalAll <= available) {
        setVisibleCount(itemWidths.length);
        return;
      }

      // 逐个累加，找到最多能放下几个（需为剩余彩种预留「更多」按钮宽度）
      let cumulative = 0;
      let count = 0;
      for (let i = 0; i < itemWidths.length; i++) {
        const isLast = i === itemWidths.length - 1;
        const reserve = isLast ? 0 : gap + moreWidth;
        if (cumulative + itemWidths[i] + reserve > available) {
          count = i;
          break;
        }
        cumulative += itemWidths[i] + gap;
        count = i + 1;
      }
      setVisibleCount(count);
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (rowRef.current) ro.observe(rowRef.current);
    return () => ro.disconnect();
  }, [lotteries]);

  // 切换大类后重置展开状态
  useEffect(() => {
    setMoreOpen(false);
  }, [lotteries]);

  // 点击外部关闭「更多」下拉
  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreOpen]);

  const visible = lotteries.slice(0, visibleCount);
  const hidden = lotteries.slice(visibleCount);
  const hasMore = hidden.length > 0;

  return (
    <div className="relative">
      {/* 离屏测量行：不可见，仅用于宽度测量 */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-[-9999px] top-[-9999px] flex gap-2"
      >
        {lotteries.map((t) => (
          <span key={t} className="seg-item">
            {LOTTERY_RULES[t].name}
          </span>
        ))}
        <span className="seg-item inline-flex items-center gap-1">
          更多 <ChevronDown className="h-3 w-3" />
        </span>
      </div>

      {/* 可见行 */}
      <div ref={rowRef} className="flex flex-nowrap items-center gap-2">
        <div className="seg">
          {visible.map((t) => (
            <button
              key={t}
              type="button"
              className={cn(
                "seg-item",
                activeLottery === t && "seg-item-active",
              )}
              onClick={() => onSelect(t)}
            >
              {LOTTERY_RULES[t].name}
            </button>
          ))}
          {hasMore && (
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                className={cn(
                  "seg-item inline-flex items-center gap-1",
                  (moreOpen || hidden.includes(activeLottery)) &&
                    "seg-item-active",
                )}
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
              >
                更多 <ChevronDown className="h-3 w-3" />
              </button>
              {moreOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 flex min-w-[7rem] flex-col gap-1 rounded-2xl border border-ink-700 bg-ink-900 p-1 shadow-xl">
                  {hidden.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={cn(
                        "seg-item w-full text-left",
                        activeLottery === t && "seg-item-active",
                      )}
                      onClick={() => {
                        onSelect(t);
                        setMoreOpen(false);
                      }}
                    >
                      {LOTTERY_RULES[t].name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
