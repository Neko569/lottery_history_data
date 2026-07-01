import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LOTTERY_RULES, LOTTERY_CATEGORIES, getCategoryOf, toLotteryType, type LotteryType, type LotteryCategory } from "@/utils/lottery";
import { useLotteryStore } from "@/store/lotteryStore";
import FullNumberTrendChart from "@/components/FullNumberTrendChart";
import { LotterySelector } from "@/components/ControlBar";
import { cn } from "@/lib/utils";

export default function TrendDetail() {
  const navigate = useNavigate();
  const params = useParams<{ type: LotteryType }>();
  const type = toLotteryType(params.type);
  const rule = LOTTERY_RULES[type];
  const state = useLotteryStore((s) => s.states[type]);
  const fetchRemoteData = useLotteryStore((s) => s.fetchRemoteData);
  const setActiveLottery = useLotteryStore((s) => s.setActiveLottery);

  const [activeCategory, setActiveCategory] = useState<LotteryCategory>(() =>
    getCategoryOf(type),
  );

  // 同步全局 activeLottery：使 Navbar 的「走势」入口与当前页彩种一致，
  // 避免切换彩种后导航栏链接失配导致高亮样式丢失
  useEffect(() => {
    setActiveLottery(type);
    setActiveCategory(getCategoryOf(type));
  }, [type, setActiveLottery]);

  useEffect(() => {
    if (!state.data && !state.loading) {
      fetchRemoteData(type);
    }
  }, [type, state.data, state.loading, fetchRemoteData]);

  const categoryLotteries =
    LOTTERY_CATEGORIES.find((c) => c.key === activeCategory)?.lotteries ?? [];

  /** 点击大类：切换展示的彩种列表；若当前彩种不在该大类下，跳到该大类第一个彩种 */
  const handleCategoryClick = (cat: LotteryCategory) => {
    setActiveCategory(cat);
    const list = LOTTERY_CATEGORIES.find((c) => c.key === cat)?.lotteries ?? [];
    if (list.length > 0 && !list.includes(type)) {
      navigate(`/trend/${list[0]}`);
    }
  };

  /** 是否含后区/特别号（开奖展示用：七乐彩玩家不选后区但开奖有特别号） */
  const backDrawTotal = rule.backDrawCount ?? rule.backCount;

  return (
    <div className="min-h-screen">
      <div className="border-b border-ink-700/60 bg-ink-950/40">
        <div className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6">
          {/* 第一行：大分类（体育彩票 / 福利彩票） */}
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
            <div className="ml-auto leading-tight text-right">
              <h1 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {rule.name} · 完整号码走势
              </h1>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {rule.frontLabel} 1-{rule.frontMax}
                {backDrawTotal > 0 && ` · ${rule.backLabel} 1-${rule.backMax}`}
              </p>
            </div>
          </div>

          {/* 第二行：具体彩种（与主页一致的 LotterySelector） */}
          <div className="mt-2">
            <LotterySelector
              lotteries={categoryLotteries}
              activeLottery={type}
              onSelect={(t) => navigate(`/trend/${t}`)}
            />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        <FullNumberTrendChart type={type} data={state.data} />
      </main>
    </div>
  );
}
