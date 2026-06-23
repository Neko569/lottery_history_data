import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, TrendingDown, Target } from "lucide-react";
import type { LotteryType, RandomTicket } from "@/types/lottery";
import { LOTTERY_RULES } from "@/utils/lottery";
import { useLotteryStore } from "@/store/lotteryStore";
import LotteryBall from "@/components/LotteryBall";
import { cn } from "@/lib/utils";

interface MatchResultPageProps {
  type?: LotteryType;
  tickets?: RandomTicket[];
}

interface MatchStat {
  matchCount: number;
  matchDetails: { front: number; back: number }[];
}

export default function MatchResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  
  const type = searchParams.get("type") as LotteryType || "dlt";
  const ticketsJson = searchParams.get("tickets");
  const tickets: RandomTicket[] = ticketsJson ? JSON.parse(ticketsJson) : [];
  
  const rule = LOTTERY_RULES[type];
  const state = useLotteryStore((s) => s.states[type]);
  const data = state.data;

  const calculateMatches = (ticket: RandomTicket) => {
    if (!data) return { total: 0, matches: [] };
    
    const results = data.items.map((item) => {
      const frontMatch = item.front_numbers.filter(n => ticket.front.includes(n)).length;
      const backMatch = item.back_numbers.filter(n => ticket.back.includes(n)).length;
      return {
        term: item.term,
        date: item.draw_time,
        frontMatch,
        backMatch,
        total: frontMatch + backMatch,
        fullMatch: frontMatch === rule.frontCount && backMatch === rule.backCount
      };
    });
    
    const matches = results.filter(r => r.total > 0);
    const maxMatch = Math.max(...matches.map(m => m.total), 0);
    
    return { total: matches.length, matches, maxMatch };
  };

  const getPrizeLevel = (frontMatch: number, backMatch: number) => {
    if (frontMatch === rule.frontCount && backMatch === rule.backCount) return { level: "一等奖", color: "text-yellow-400" };
    if (frontMatch === rule.frontCount && backMatch === rule.backCount - 1) return { level: "二等奖", color: "text-purple-400" };
    if (frontMatch === rule.frontCount - 1 && backMatch === rule.backCount) return { level: "三等奖", color: "text-blue-400" };
    if (frontMatch >= 4 && backMatch >= 2) return { level: "四等奖", color: "text-green-400" };
    if (frontMatch >= 4 && backMatch >= 1) return { level: "五等奖", color: "text-cyan-400" };
    if (frontMatch >= 3 && backMatch >= 2) return { level: "六等奖", color: "text-zinc-400" };
    if (frontMatch >= 2 && backMatch >= 2) return { level: "七等奖", color: "text-zinc-500" };
    if (frontMatch >= 3 && backMatch === 0) return { level: "八等奖", color: "text-zinc-600" };
    return null;
  };

  const totalMatches = tickets.length > 0 
    ? tickets.map(t => calculateMatches(t))
    : [];

  const grandTotal = totalMatches.reduce((sum, m) => sum + m.total, 0);
  const maxMatch = Math.max(...totalMatches.map(m => m.maxMatch), 0);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-ink-700/60 bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn-ghost h-9 w-9 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="font-serif text-lg font-bold text-zinc-900">
                {rule.name}对比分析
              </h1>
              <p className="text-[10px] text-zinc-500">选号与历史数据匹配</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("rounded-full px-3 py-1 text-xs font-medium", 
              maxMatch >= 6 ? "bg-yellow-100 text-yellow-700" : 
              maxMatch >= 4 ? "bg-green-100 text-green-700" : "bg-ink-800 text-zinc-400")}>
              最高命中: {maxMatch}个
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        {!data ? (
          <div className="card text-center py-12">
            <Target className="mx-auto h-12 w-12 text-zinc-400 mb-4" />
            <p className="text-zinc-500">暂无数据，请先加载{rule.name}开奖数据</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="card text-center py-12">
            <Target className="mx-auto h-12 w-12 text-zinc-400 mb-4" />
            <p className="text-zinc-500">请在首页生成号码后再来对比</p>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="btn-gold mt-4"
            >
              返回首页生成号码
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="card flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10">
                  <Trophy className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">总命中次数</p>
                  <p className="text-xl font-bold text-zinc-900">{grandTotal}</p>
                </div>
              </div>
              <div className="card flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-crimson/10">
                  <Target className="h-5 w-5 text-crimson" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">最高命中</p>
                  <p className="text-xl font-bold text-crimson">{maxMatch}个号码</p>
                </div>
              </div>
              <div className="card flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo/10">
                  <TrendingDown className="h-5 w-5 text-indigo" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">数据期数</p>
                  <p className="text-xl font-bold text-zinc-900">{data.items.length}期</p>
                </div>
              </div>
              <div className="card flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green/10">
                  <span className="font-serif text-lg font-bold text-green">注</span>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">投注数量</p>
                  <p className="text-xl font-bold text-zinc-900">{tickets.length}注</p>
                </div>
              </div>
            </div>

            {tickets.map((ticket, idx) => {
              const matchResult = calculateMatches(ticket);
              return (
                <div key={idx} className="card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-ink-700/60 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">
                        第{idx + 1}注
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {ticket.front.map((n, i) => (
                          <LotteryBall key={`f-${i}`} number={n} variant="front" size="sm" />
                        ))}
                        <span className="mx-1 h-3 w-px bg-ink-600" />
                        {ticket.back.map((n, i) => (
                          <LotteryBall key={`b-${i}`} number={n} variant="back" size="sm" />
                        ))}
                      </div>
                    </div>
                    <span className={cn("rounded-full px-3 py-1 text-xs font-medium",
                      matchResult.maxMatch >= 6 ? "bg-yellow-100 text-yellow-700" :
                      matchResult.maxMatch >= 4 ? "bg-green-100 text-green-700" : "bg-ink-800 text-zinc-400")}>
                      命中{matchResult.matches.length}次 · 最高{matchResult.maxMatch}个
                    </span>
                  </div>

                  {matchResult.matches.length > 0 ? (
                    <div className="divide-y divide-ink-700/60">
                      {matchResult.matches.slice(0, 20).map((m, i) => {
                        const prize = getPrizeLevel(m.frontMatch, m.backMatch);
                        return (
                          <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-ink-900/30">
                            <div className="flex items-center gap-4">
                              <span className="font-mono text-sm text-zinc-600">
                                {m.term}期
                              </span>
                              <span className="text-xs text-zinc-500">
                                {m.date}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <span className={cn("rounded-md px-2 py-0.5 text-xs",
                                  m.frontMatch === rule.frontCount ? "bg-crimson/20 text-crimson" : "bg-ink-800 text-zinc-500")}>
                                  前{m.frontMatch}
                                </span>
                                <span className={cn("rounded-md px-2 py-0.5 text-xs",
                                  m.backMatch === rule.backCount ? "bg-indigo/20 text-indigo" : "bg-ink-800 text-zinc-500")}>
                                  后{m.backMatch}
                                </span>
                              </div>
                              {prize && (
                                <span className={cn("font-medium text-sm", prize.color)}>
                                  {prize.level}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {matchResult.matches.length > 20 && (
                        <div className="px-4 py-2 text-center text-xs text-zinc-500">
                          还有 {matchResult.matches.length - 20} 条匹配记录...
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-center text-zinc-500">
                      暂无匹配记录
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}