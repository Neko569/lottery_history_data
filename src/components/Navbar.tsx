import { NavLink } from "react-router-dom";
import { Home as HomeIcon, Target, TrendingUp } from "lucide-react";
import { useLotteryStore } from "@/store/lotteryStore";
import { cn } from "@/lib/utils";
import ThemeToggle from "./ThemeToggle";

/** 全局统一导航栏 —— 在所有页面顶部常驻 */
export default function Navbar() {
  // 读取当前彩种，使"走势/对比分析"入口带上对应 type
  const activeLottery = useLotteryStore((s) => s.activeLottery);

  const navItems = [
    { to: "/", label: "首页", icon: HomeIcon, end: true },
    { to: `/trend/${activeLottery}`, label: "走势", icon: TrendingUp, end: false },
    { to: `/match?type=${activeLottery}`, label: "对比分析", icon: Target, end: false },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-ink-700/60 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-2.5 sm:px-6">
        {/* 品牌 */}
        <NavLink to="/" className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-crimson to-crimson-700 shadow-glow">
            <span className="font-serif text-lg font-black text-gold">彩</span>
          </div>
          <div className="leading-tight">
            <h1 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100 sm:text-xl">
              彩运
            </h1>
            <p className="hidden text-[10px] text-zinc-500 dark:text-zinc-400 sm:block">
              开奖历史 · 走势分析 · 随机生成
            </p>
          </div>
        </NavLink>

        {/* 导航链接 */}
        <nav className="ml-auto flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={label}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-crimson/10 text-crimson"
                    : "text-zinc-500 hover:bg-ink-800/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* 主题切换 */}
        <div className="shrink-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
