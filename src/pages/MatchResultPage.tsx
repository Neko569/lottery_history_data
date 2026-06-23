import { useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, TrendingDown, Target, Plus, Minus, Shuffle } from "lucide-react";
import type { LotteryType, RandomTicket } from "@/types/lottery";
import { LOTTERY_RULES, generateTickets } from "@/utils/lottery";
import { useLotteryStore } from "@/store/lotteryStore";
import LotteryBall from "@/components/LotteryBall";
import { cn } from "@/lib/utils";

type RangeOption = 30 | 50 | 100 | "all";

const RANGE_OPTIONS: { value: RangeOption; label: string }[] = [
  { value: 30, label: "近30期" },
  { value: 50, label: "近50期" },
  { value: 100, label: "近100期" },
  { value: "all", label: "所有期数" },
];

export default function MatchResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  
  const type = searchParams.get("type") as LotteryType || "dlt";
  const ticketsJson = searchParams.get("tickets");
  const initialTickets: RandomTicket[] = ticketsJson ? JSON.parse(ticketsJson) : [];
  
  const [selectedRange, setSelectedRange] = useState<RangeOption>("all");
  const [customTickets, setCustomTickets] = useState<RandomTicket[]>(initialTickets);
  
  const rule = LOTTERY_RULES[type];
  const state = useLotteryStore((s) => s.states[type]);
  const data = state.data;

  const getFilteredData = useCallback(() => {
    if (!data) return [];
    const count = selectedRange === "all" ? data.items.length : selectedRange;
    return data.items.slice(0, count);
  }, [data, selectedRange]);

  const getPrizeLevel = (frontMatch: number, backMatch: number) => {
    if (type === "dlt") {
      if (frontMatch === 5 && backMatch === 2) return { level: "一等奖", color: "text-yellow-400" };
      if (frontMatch === 5 && backMatch === 1) return { level: "二等奖", color: "text-purple-400" };
      if (frontMatch === 5 && backMatch === 0) return { level: "三等奖", color: "text-blue-400" };
      if (frontMatch === 4 && backMatch === 2) return { level: "四等奖", color: "text-green-400" };
      if (frontMatch === 4 && backMatch === 1) return { level: "五等奖", color: "text-cyan-400" };
      if (frontMatch === 3 && backMatch === 2) return { level: "六等奖", color: "text-zinc-400" };
      if (frontMatch === 4 && backMatch === 0) return { level: "七等奖", color: "text-zinc-500" };
      if ((frontMatch === 3 && backMatch === 1) || (frontMatch === 2 && backMatch === 2)) return { level: "八等奖", color: "text-zinc-600" };
      if ((frontMatch === 3 && backMatch === 0) || (frontMatch === 2 && backMatch === 1) || (frontMatch === 1 && backMatch === 2) || (frontMatch === 0 && backMatch === 2)) return { level: "九等奖", color: "text-zinc-700" };
    } else {
      if (frontMatch === 6 && backMatch === 1) return { level: "一等奖", color: "text-yellow-400" };
      if (frontMatch === 6 && backMatch === 0) return { level: "二等奖", color: "text-purple-400" };
      if (frontMatch === 5 && backMatch === 1) return { level: "三等奖", color: "text-blue-400" };
      if (frontMatch === 5 && backMatch === 0) return { level: "四等奖", color: "text-green-400" };
      if (frontMatch === 4 && backMatch === 1) return { level: "五等奖", color: "text-cyan-400" };
      if (frontMatch === 4 && backMatch === 0) return { level: "六等奖", color: "text-zinc-400" };
      if (frontMatch === 3 && backMatch === 1) return { level: "七等奖", color: "text-zinc-500" };
      if ((frontMatch === 3 && backMatch === 0) || (frontMatch === 2 && backMatch === 1) || (frontMatch === 1 && backMatch === 1) || (frontMatch === 0 && backMatch === 1)) return { level: "八等奖", color: "text-zinc-600" };
    }
    return null;
  };

  const calculateMatches = useCallback((ticket: RandomTicket) => {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return { total: 0, matches: [], maxMatch: 0, prizeLevel: null };
    
    const results = filteredData.map((item) => {
      const frontMatch = item.front_numbers.filter(n => ticket.front.includes(n)).length;
      const backMatch = item.back_numbers.filter(n => ticket.back.includes(n)).length;
      const prize = getPrizeLevel(frontMatch, backMatch);
      return {
        term: item.term,
        date: item.draw_time,
        frontMatch,
        backMatch,
        total: frontMatch + backMatch,
        prize,
        prizeLevel: prize?.level || null,
      };
    });
    
    const matches = results.filter(r => r.prize !== null);
    const maxMatch = Math.max(...matches.map(m => m.total), 0);
    const bestPrize = matches.length > 0 
      ? matches.reduce<string | null>((best, m) => {
          const levels = ["一等奖", "二等奖", "三等奖", "四等奖", "五等奖", "六等奖", "七等奖", "八等奖", "九等奖"];
          const bestIdx = levels.indexOf(best || "九等奖");
          const mIdx = levels.indexOf(m.prizeLevel || "九等奖");
          return mIdx < bestIdx ? m.prizeLevel : best;
        }, null)
      : null;
    
    return { total: matches.length, matches, maxMatch, prizeLevel: bestPrize };
  }, [getFilteredData]);

  const totalMatches = customTickets.length > 0 
    ? customTickets.map(t => calculateMatches(t))
    : [];

  const grandTotal = totalMatches.reduce((sum, m) => sum + m.total, 0);
  const bestPrize = totalMatches.length > 0
    ? totalMatches.reduce<string | null>((best, m) => {
        if (!best) return m.prizeLevel;
        if (!m.prizeLevel) return best;
        const levels = ["一等奖", "二等奖", "三等奖", "四等奖", "五等奖", "六等奖", "七等奖", "八等奖", "九等奖"];
        return levels.indexOf(m.prizeLevel) < levels.indexOf(best) ? m.prizeLevel : best;
      }, null)
    : null;

  const handleAddTicket = () => {
    const newTicket: RandomTicket = {
      front: [],
      back: [],
    };
    setCustomTickets([...customTickets, newTicket]);
  };

  const handleRemoveTicket = (index: number) => {
    setCustomTickets(customTickets.filter((_, i) => i !== index));
  };

  const handleToggleNumber = (ticketIndex: number, type: "front" | "back", number: string) => {
    setCustomTickets(customTickets.map((ticket, idx) => {
      if (idx !== ticketIndex) return ticket;
      const arr = ticket[type];
      if (arr.includes(number)) {
        return { ...ticket, [type]: arr.filter(n => n !== number) };
      } else {
        const maxCount = type === "front" ? rule.frontCount : rule.backCount;
        if (arr.length >= maxCount) return ticket;
        return { ...ticket, [type]: [...arr, number].sort((a, b) => Number(a) - Number(b)) };
      }
    }));
  };

  const handleGenerateTicket = (ticketIndex: number) => {
    const newTickets = generateTickets(type, 1);
    setCustomTickets(customTickets.map((ticket, idx) => {
      if (idx !== ticketIndex) return ticket;
      return newTickets[0];
    }));
  };

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
            {bestPrize && (
              <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
                最高奖项: {bestPrize}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        {!data ? (
          <div className="card text-center py-12">
            <Target className="mx-auto h-12 w-12 text-zinc-400 mb-4" />
            <p className="text-zinc-500">暂无数据，请先加载{rule.name}开奖数据</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="card p-4">
              <div className="mb-4 flex flex-wrap items-center gap-4">
                <span className="text-sm font-medium text-zinc-700">选择查询范围:</span>
                <div className="flex gap-2">
                  {RANGE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                        selectedRange === option.value
                          ? "bg-crimson text-white"
                          : "bg-ink-800 text-zinc-400 hover:bg-ink-700"
                      )}
                      onClick={() => setSelectedRange(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-zinc-500">
                  共 {getFilteredData().length} 期数据
                </span>
              </div>

              <div className="space-y-4">
                {customTickets.length === 0 && (
                  <div className="rounded-xl border-2 border-dashed border-ink-600 p-6 text-center">
                    <Target className="mx-auto h-10 w-10 text-zinc-400 mb-3" />
                    <p className="mb-4 text-zinc-500">请手动选择号码或随机生成</p>
                  </div>
                )}

                {customTickets.map((ticket, ticketIdx) => (
                  <div key={ticketIdx} className="rounded-xl border border-ink-700/60 bg-ink-900/30 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="rounded-full bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">
                        第{ticketIdx + 1}注
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleGenerateTicket(ticketIdx)}
                          className="btn btn-sm"
                          title="随机生成"
                        >
                          <Shuffle className="h-3 w-3" />
                        </button>
                        {customTickets.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTicket(ticketIdx)}
                            className="btn btn-sm text-zinc-500 hover:text-crimson"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-500">
                          {rule.frontLabel} ({ticket.front.length}/{rule.frontCount})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Array.from({ length: rule.frontMax }, (_, i) => String(i + 1).padStart(2, "0")).map((num) => (
                          <button
                            key={num}
                            type="button"
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors",
                              ticket.front.includes(num)
                                ? "bg-crimson text-white"
                                : "bg-ink-800 text-zinc-400 hover:bg-ink-700"
                            )}
                            onClick={() => handleToggleNumber(ticketIdx, "front", num)}
                          >
                            {Number(num)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-500">
                          {rule.backLabel} ({ticket.back.length}/{rule.backCount})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Array.from({ length: rule.backMax }, (_, i) => String(i + 1).padStart(2, "0")).map((num) => (
                          <button
                            key={num}
                            type="button"
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors",
                              ticket.back.includes(num)
                                ? "bg-indigo text-white"
                                : "bg-ink-800 text-zinc-400 hover:bg-ink-700"
                            )}
                            onClick={() => handleToggleNumber(ticketIdx, "back", num)}
                          >
                            {Number(num)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddTicket}
                  className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-600 py-3 text-zinc-500 hover:border-crimson hover:text-crimson transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  添加一注
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="card flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10">
                  <Trophy className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">中奖次数</p>
                  <p className="text-xl font-bold text-zinc-900">{grandTotal}</p>
                </div>
              </div>
              <div className="card flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-100">
                  <span className="font-serif text-lg font-bold text-yellow-600">奖</span>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">最高奖项</p>
                  <p className="text-xl font-bold text-yellow-600">{bestPrize || "-"}</p>
                </div>
              </div>
              <div className="card flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo/10">
                  <TrendingDown className="h-5 w-5 text-indigo" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">查询期数</p>
                  <p className="text-xl font-bold text-zinc-900">{getFilteredData().length}期</p>
                </div>
              </div>
              <div className="card flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green/10">
                  <span className="font-serif text-lg font-bold text-green">注</span>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">投注数量</p>
                  <p className="text-xl font-bold text-zinc-900">{customTickets.length}注</p>
                </div>
              </div>
            </div>

            {customTickets.map((ticket, ticketIdx) => {
              const matchResult = calculateMatches(ticket);
              const hasPrize = matchResult.matches.length > 0;
              
              if (!hasPrize) return null;

              return (
                <div key={ticketIdx} className="card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-ink-700/60 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">
                        第{ticketIdx + 1}注
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
                    <div className="flex items-center gap-3">
                      {matchResult.prizeLevel && (
                        <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
                          {matchResult.prizeLevel}
                        </span>
                      )}
                      <span className="rounded-full bg-ink-800 px-3 py-1 text-xs font-medium text-zinc-400">
                        中奖{matchResult.matches.length}次
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-ink-700/60">
                    {matchResult.matches.slice(0, 30).map((m, i) => {
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
                    {matchResult.matches.length > 30 && (
                      <div className="px-4 py-2 text-center text-xs text-zinc-500">
                        还有 {matchResult.matches.length - 30} 条中奖记录...
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {customTickets.length > 0 && grandTotal === 0 && (
              <div className="card text-center py-8">
                <Target className="mx-auto h-10 w-10 text-zinc-400 mb-3" />
                <p className="text-zinc-500">未查询到中奖记录</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}