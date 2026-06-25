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
            <svg viewBox="0 0 256 256" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="nbBg" x1="32" y1="24" x2="224" y2="232" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#DC2626" />
                  <stop offset="1" stopColor="#991B1B" />
                </linearGradient>
                <radialGradient id="nbBall" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(88 82) rotate(50) scale(92)">
                  <stop stopColor="#FFFFFF" />
                  <stop offset="0.55" stopColor="#FFFFFF" />
                  <stop offset="1" stopColor="#FEE2E2" />
                </radialGradient>
                <filter id="nbBallShadow" x="44" y="48" width="136" height="136" filterUnits="userSpaceOnUse">
                  <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#7F1D1D" floodOpacity="0.25" />
                </filter>
              </defs>
              {/* Background */}
              <rect x="24" y="24" width="208" height="208" rx="48" fill="url(#nbBg)" />
              {/* History arc */}
              <path d="M74 84C92 61 125 52 153 63C190 78 208 119 193 156C180 188 148 207 113 201" stroke="#FECACA" strokeWidth="10" strokeLinecap="round" opacity="0.88" fill="none" />
              {/* Arrow head */}
              <path d="M109 201L126 188M109 201L125 215" stroke="#FECACA" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity="0.88" fill="none" />
              {/* Chart card */}
              <rect x="112" y="150" width="90" height="56" rx="18" fill="#FFFFFF" opacity="0.92" />
              {/* Chart grid */}
              <path d="M132 188H184" stroke="#FEE2E2" strokeWidth="3.5" strokeLinecap="round" opacity="0.65" fill="none" />
              <path d="M132 171H184" stroke="#FEE2E2" strokeWidth="3.5" strokeLinecap="round" opacity="0.5" fill="none" />
              {/* Chart line */}
              <path d="M132 186L146 175L158 180L172 164L189 171" stroke="#DC2626" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9" />
              {/* Chart points */}
              <circle cx="132" cy="186" r="4.5" fill="#991B1B" opacity="0.9" />
              <circle cx="146" cy="175" r="4.5" fill="#991B1B" opacity="0.9" />
              <circle cx="158" cy="180" r="4.5" fill="#991B1B" opacity="0.9" />
              <circle cx="172" cy="164" r="4.5" fill="#991B1B" opacity="0.9" />
              <circle cx="189" cy="171" r="4.5" fill="#991B1B" opacity="0.9" />
              {/* Lottery ball */}
              <circle cx="112" cy="118" r="52" fill="url(#nbBall)" filter="url(#nbBallShadow)" />
              {/* Reflections */}
              <ellipse cx="92" cy="87" rx="15" ry="11" fill="#FFFFFF" opacity="0.9" />
              <path d="M76 116C81 99 96 87 113 85" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" opacity="0.55" fill="none" />
              <circle cx="130" cy="84" r="6" fill="#FFFFFF" opacity="0.65" />
              {/* Number 7 */}
              <text x="112" y="136" textAnchor="middle" fontFamily="Arial Black, Arial, Helvetica, sans-serif" fontSize="48" fontWeight="900" fill="#991B1B" stroke="#991B1B" strokeWidth="1.6" paintOrder="stroke fill">7</text>
              {/* Small dots */}
              <circle cx="68" cy="176" r="10" fill="#FDE68A" />
              <circle cx="84" cy="192" r="7" fill="#FCA5A5" />
              <circle cx="60" cy="198" r="6" fill="#A7F3D0" />
            </svg>
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
