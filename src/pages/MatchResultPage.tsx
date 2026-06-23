import { useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, TrendingDown, Target, Plus, Minus, Shuffle, RefreshCw, Upload, AlertCircle, CheckCircle2, Cloud, BarChart3, Download } from "lucide-react";
import type { LotteryType, RandomTicket, LotteryItem } from "@/types/lottery";
import { LOTTERY_RULES, DATA_REPO_URL, generateTickets } from "@/utils/lottery";
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

const PRIZE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "一等奖": { bg: "bg-gradient-to-r from-yellow-400 to-amber-500", text: "text-yellow-900", border: "border-yellow-400" },
  "二等奖": { bg: "bg-gradient-to-r from-purple-400 to-fuchsia-500", text: "text-white", border: "border-purple-400" },
  "三等奖": { bg: "bg-gradient-to-r from-blue-400 to-cyan-500", text: "text-white", border: "border-blue-400" },
  "四等奖": { bg: "bg-gradient-to-r from-green-400 to-emerald-500", text: "text-white", border: "border-green-400" },
  "五等奖": { bg: "bg-gradient-to-r from-teal-400 to-cyan-500", text: "text-white", border: "border-teal-400" },
  "六等奖": { bg: "bg-zinc-500", text: "text-white", border: "border-zinc-500" },
  "七等奖": { bg: "bg-zinc-600", text: "text-white", border: "border-zinc-600" },
  "八等奖": { bg: "bg-zinc-700", text: "text-zinc-200", border: "border-zinc-700" },
  "九等奖": { bg: "bg-zinc-800", text: "text-zinc-400", border: "border-zinc-800" },
};

/** 导出号码为图片 */
const exportAsImage = (tickets: LotteryTicket[], type: LotteryType, rule: typeof LOTTERY_RULES.dlt) => {
  const isDlt = type === "dlt";
  const padding = 40;
  const ballSize = 36;
  const ballGap = 8;
  const rowGap = 20;
  const separatorWidth = 30;
  const labelHeight = 60;

  const frontBalls = rule.frontCount;
  const maxBallsInRow = Math.max(frontBalls, rule.backCount);
  const contentWidth = padding * 2 + maxBallsInRow * ballSize + (maxBallsInRow - 1) * ballGap;
  const width = contentWidth;
  const rowHeight = ballSize + rowGap;
  const height = labelHeight + tickets.length * rowHeight + padding;

  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);

  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#e5e5e5";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(rule.name, width / 2, 36);

  tickets.forEach((ticket, ticketIdx) => {
    const y = labelHeight + ticketIdx * rowHeight;

    ticket.front.forEach((num, i) => {
      const x = padding + i * (ballSize + ballGap) + ballSize / 2;
      const ballY = y + ballSize / 2;

      const gradient = ctx.createRadialGradient(x - 3, ballY - 3, 0, x, ballY, ballSize / 2);
      gradient.addColorStop(0, "#ef4444");
      gradient.addColorStop(1, "#b91c1c");
      ctx.beginPath();
      ctx.arc(x, ballY, ballSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(num, x, ballY);
    });

    const separatorX = padding + frontBalls * (ballSize + ballGap) - ballGap / 2;
    ctx.fillStyle = "#52525b";
    ctx.fillRect(separatorX, y + 8, 2, ballSize - 16);

    ticket.back.forEach((num, i) => {
      const x = separatorX + separatorWidth + i * (ballSize + ballGap) + ballSize / 2;
      const ballY = y + ballSize / 2;

      const gradient = ctx.createRadialGradient(x - 3, ballY - 3, 0, x, ballY, ballSize / 2);
      if (isDlt) {
        gradient.addColorStop(0, "#818cf8");
        gradient.addColorStop(1, "#4f46e5");
      } else {
        gradient.addColorStop(0, "#3b82f6");
        gradient.addColorStop(1, "#1d4ed8");
      }
      ctx.beginPath();
      ctx.arc(x, ballY, ballSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(num, x, ballY);
    });

    ctx.fillStyle = "#71717a";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${ticketIdx + 1}`, 8, y + ballSize / 2 + 4);
  });

  const link = document.createElement("a");
  link.download = `${type}-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
};

interface LotteryTicket {
  front: string[];
  back: string[];
  isCompound: boolean;
}

export default function MatchResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const type = searchParams.get("type") as LotteryType || "dlt";
  const ticketsJson = searchParams.get("tickets");
  const initialTickets: LotteryTicket[] = ticketsJson 
    ? JSON.parse(ticketsJson).map((t: RandomTicket) => ({ ...t, isCompound: false }))
    : [];
  
  const [selectedRange, setSelectedRange] = useState<RangeOption>(30);
  const [customTickets, setCustomTickets] = useState<LotteryTicket[]>(initialTickets.length > 0 ? initialTickets : [{ front: [], back: [], isCompound: false }]);
  
  const rule = LOTTERY_RULES[type];
  const state = useLotteryStore((s) => s.states[type]);
  const fetchRemoteData = useLotteryStore((s) => s.fetchRemoteData);
  const uploadData = useLotteryStore((s) => s.uploadData);
  const data = state.data;
  const loading = state.loading;
  const error = state.error;
  const source = state.source;

  const isTicketComplete = (ticket: LotteryTicket): boolean => {
    if (ticket.isCompound) {
      return ticket.front.length >= rule.frontCount && ticket.back.length >= rule.backCount;
    }
    return ticket.front.length === rule.frontCount && ticket.back.length === rule.backCount;
  };

  const allTicketsComplete = customTickets.length > 0 && customTickets.every(t => isTicketComplete(t));

  const getFilteredData = useCallback(() => {
    if (!data) return [];
    const count = selectedRange === "all" ? data.items.length : selectedRange;
    return data.items.slice(0, count);
  }, [data, selectedRange]);

  const getPrizeLevel = (frontMatch: number, backMatch: number) => {
    if (type === "dlt") {
      if (frontMatch === 5 && backMatch === 2) return { level: "一等奖", ...PRIZE_COLORS["一等奖"] };
      if (frontMatch === 5 && backMatch === 1) return { level: "二等奖", ...PRIZE_COLORS["二等奖"] };
      if (frontMatch === 5 && backMatch === 0) return { level: "三等奖", ...PRIZE_COLORS["三等奖"] };
      if (frontMatch === 4 && backMatch === 2) return { level: "四等奖", ...PRIZE_COLORS["四等奖"] };
      if (frontMatch === 4 && backMatch === 1) return { level: "五等奖", ...PRIZE_COLORS["五等奖"] };
      if (frontMatch === 3 && backMatch === 2) return { level: "六等奖", ...PRIZE_COLORS["六等奖"] };
      if (frontMatch === 4 && backMatch === 0) return { level: "七等奖", ...PRIZE_COLORS["七等奖"] };
      if ((frontMatch === 3 && backMatch === 1) || (frontMatch === 2 && backMatch === 2)) return { level: "八等奖", ...PRIZE_COLORS["八等奖"] };
      if ((frontMatch === 3 && backMatch === 0) || (frontMatch === 2 && backMatch === 1) || (frontMatch === 1 && backMatch === 2) || (frontMatch === 0 && backMatch === 2)) return { level: "九等奖", ...PRIZE_COLORS["九等奖"] };
    } else {
      if (frontMatch === 6 && backMatch === 1) return { level: "一等奖", ...PRIZE_COLORS["一等奖"] };
      if (frontMatch === 6 && backMatch === 0) return { level: "二等奖", ...PRIZE_COLORS["二等奖"] };
      if (frontMatch === 5 && backMatch === 1) return { level: "三等奖", ...PRIZE_COLORS["三等奖"] };
      if (frontMatch === 5 && backMatch === 0) return { level: "四等奖", ...PRIZE_COLORS["四等奖"] };
      if (frontMatch === 4 && backMatch === 1) return { level: "五等奖", ...PRIZE_COLORS["五等奖"] };
      if (frontMatch === 4 && backMatch === 0) return { level: "六等奖", ...PRIZE_COLORS["六等奖"] };
      if (frontMatch === 3 && backMatch === 1) return { level: "七等奖", ...PRIZE_COLORS["七等奖"] };
      if ((frontMatch === 3 && backMatch === 0) || (frontMatch === 2 && backMatch === 1) || (frontMatch === 1 && backMatch === 1) || (frontMatch === 0 && backMatch === 1)) return { level: "八等奖", ...PRIZE_COLORS["八等奖"] };
    }
    return null;
  };

  const calculateMatches = useCallback((ticket: LotteryTicket) => {
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
        item,
      };
    });
    
    const matches = results.filter(r => r.prize !== null);
    
    const prizeOrder = ["一等奖", "二等奖", "三等奖", "四等奖", "五等奖", "六等奖", "七等奖", "八等奖", "九等奖"];
    matches.sort((a, b) => {
      const aIdx = a.prizeLevel ? prizeOrder.indexOf(a.prizeLevel) : prizeOrder.length;
      const bIdx = b.prizeLevel ? prizeOrder.indexOf(b.prizeLevel) : prizeOrder.length;
      if (aIdx !== bIdx) return aIdx - bIdx;
      return Number(b.term) - Number(a.term);
    });
    
    const maxMatch = matches.length > 0 ? matches[0].total : 0;
    const bestPrize = matches.length > 0 ? matches[0].prizeLevel : null;
    
    return { total: matches.length, matches, maxMatch, prizeLevel: bestPrize };
  }, [getFilteredData]);

  const generateCompoundTickets = (ticket: LotteryTicket): RandomTicket[] => {
    if (!ticket.isCompound) {
      return [{ front: [...ticket.front], back: [...ticket.back] }];
    }
    
    const frontCombinations = combinations(ticket.front, rule.frontCount);
    const backCombinations = combinations(ticket.back, rule.backCount);
    
    return frontCombinations.flatMap(f => 
      backCombinations.map(b => ({ front: f, back: b }))
    );
  };

  const combinations = (arr: string[], k: number): string[][] => {
    if (k === 1) return arr.map(x => [x]);
    if (k === arr.length) return [arr];
    
    const result: string[][] = [];
    for (let i = 0; i <= arr.length - k; i++) {
      const head = arr[i];
      const tailCombinations = combinations(arr.slice(i + 1), k - 1);
      for (const tail of tailCombinations) {
        result.push([head, ...tail]);
      }
    }
    return result;
  };

  const totalMatches = customTickets.length > 0
    ? customTickets.flatMap(ticket => {
        const actualTickets = generateCompoundTickets(ticket);
        return actualTickets.map(t => calculateMatches({ ...t, isCompound: ticket.isCompound }));
      })
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
    setCustomTickets([...customTickets, { front: [], back: [], isCompound: false }]);
  };

  const handleClearAll = () => {
    setCustomTickets([{ front: [], back: [], isCompound: false }]);
  };

  const handleRemoveTicket = (index: number) => {
    setCustomTickets(customTickets.filter((_, i) => i !== index));
  };

  const handleToggleNumber = (ticketIndex: number, numType: "front" | "back", number: string) => {
    setCustomTickets(customTickets.map((ticket, idx) => {
      if (idx !== ticketIndex) return ticket;
      const arr = ticket[numType];
      if (arr.includes(number)) {
        return { ...ticket, [numType]: arr.filter(n => n !== number) };
      } else {
        const maxCount = ticket.isCompound 
          ? (numType === "front" ? rule.frontMax : rule.backMax)
          : (numType === "front" ? rule.frontCount : rule.backCount);
        if (arr.length >= maxCount) return ticket;
        return { ...ticket, [numType]: [...arr, number].sort((a, b) => Number(a) - Number(b)) };
      }
    }));
  };

  const handleGenerateTicket = (ticketIndex: number) => {
    const newTickets = generateTickets(type, 1);
    setCustomTickets(customTickets.map((ticket, idx) => {
      if (idx !== ticketIndex) return ticket;
      return { ...newTickets[0], isCompound: false };
    }));
  };

  const handleToggleCompound = (ticketIndex: number) => {
    setCustomTickets(customTickets.map((ticket, idx) => {
      if (idx !== ticketIndex) return ticket;
      return { ...ticket, isCompound: !ticket.isCompound };
    }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadData(type, file);
    }
    e.target.value = "";
  };

  const getTotalCombinations = (ticket: LotteryTicket): number => {
    if (!ticket.isCompound) return 1;
    const frontCombos = combinationCount(ticket.front.length, rule.frontCount);
    const backCombos = combinationCount(ticket.back.length, rule.backCount);
    return frontCombos * backCombos;
  };

  const combinationCount = (n: number, k: number): number => {
    if (n < k) return 0;
    if (k === 0 || k === n) return 1;
    let result = 1;
    for (let i = 0; i < k; i++) {
      result *= (n - i) / (i + 1);
    }
    return Math.round(result);
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
              <span className={cn("rounded-full px-3 py-1 text-xs font-bold", PRIZE_COLORS[bestPrize]?.bg, PRIZE_COLORS[bestPrize]?.text)}>
                最高: {bestPrize}
              </span>
            )}
            <div className="flex rounded-lg border border-ink-600 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setCustomTickets([{ front: [], back: [], isCompound: false }]);
                  navigate(`/match?type=dlt`);
                }}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  type === "dlt" ? "bg-crimson text-white" : "bg-ink-900 text-zinc-400 hover:bg-ink-800"
                )}
              >
                大乐透
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomTickets([{ front: [], back: [], isCompound: false }]);
                  navigate(`/match?type=ssq`);
                }}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  type === "ssq" ? "bg-crimson text-white" : "bg-ink-900 text-zinc-400 hover:bg-ink-800"
                )}
              >
                双色球
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        {loading ? (
          <div className="card text-center py-12">
            <RefreshCw className="mx-auto h-12 w-12 animate-spin text-gold mb-4" />
            <p className="text-zinc-500">正在加载{rule.name}开奖数据...</p>
          </div>
        ) : error ? (
          <div className="card p-4">
            <div className="flex items-start gap-2 rounded-lg border border-crimson/40 bg-crimson/10 px-3 py-2 text-xs text-crimson-400">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fetchRemoteData(type)}
                className="btn-gold"
              >
                <RefreshCw className="h-4 w-4" />
                重新加载
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn"
              >
                <Upload className="h-4 w-4" />
                手动上传
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>
        ) : !data ? (
          <div className="card p-8 text-center">
            <Target className="mx-auto h-12 w-12 text-zinc-400 mb-4" />
            <p className="mb-6 text-zinc-500">暂无{rule.name}开奖数据</p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fetchRemoteData(type)}
                className="btn-gold"
              >
                <RefreshCw className="h-4 w-4" />
                自动加载数据
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn"
              >
                <Upload className="h-4 w-4" />
                手动上传 JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>
        ) : (
          <>
            {source && (
              <div className="card p-3 mb-4">
                {source === "remote" ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    <Cloud className="h-3.5 w-3.5 text-indigo-400" />
                    <span>数据来源：开源仓库</span>
                    <a
                      href={DATA_REPO_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 underline-offset-2 hover:underline"
                    >
                      get_lottery_data
                    </a>
                    {data.generated_at && (
                      <span className="text-zinc-600">· 更新于 {data.generated_at}</span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-gold-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    数据来源：本地手动上传
                  </div>
                )}
              </div>
            )}

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
                  {customTickets.map((ticket, ticketIdx) => {
                    const complete = isTicketComplete(ticket);
                    return (
                      <div key={ticketIdx} className={cn(
                        "rounded-xl border bg-ink-900/30 p-4 transition-colors",
                        complete ? "border-green-500/40" : "border-ink-700/60"
                      )}>
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="rounded-full bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">
                              第{ticketIdx + 1}注
                            </span>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={ticket.isCompound}
                                onChange={() => handleToggleCompound(ticketIdx)}
                                className="rounded border-ink-600 bg-ink-800 text-crimson focus:ring-crimson/20"
                              />
                              <span className="text-xs text-zinc-500">复式</span>
                              {ticket.isCompound && (
                                <span className="rounded bg-crimson/20 px-2 py-0.5 text-xs text-crimson">
                                  {getTotalCombinations(ticket)}注
                                </span>
                              )}
                            </label>
                            {complete ? (
                              <span className="flex items-center gap-1 text-xs text-green-500">
                                <CheckCircle2 className="h-3 w-3" />
                                已选完
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-500">
                                请选择 {ticket.isCompound ? `至少${rule.frontCount}个` : rule.frontCount}个{rule.frontLabel}和{ticket.isCompound ? `至少${rule.backCount}个` : rule.backCount}个{rule.backLabel}
                              </span>
                            )}
                          </div>
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
                              {rule.frontLabel} ({ticket.front.length}/{ticket.isCompound ? rule.frontMax : rule.frontCount})
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {Array.from({ length: rule.frontMax }, (_, i) => String(i + 1).padStart(2, "0")).map((num) => (
                              <button
                                key={num}
                                type="button"
                                className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
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
                              {rule.backLabel} ({ticket.back.length}/{ticket.isCompound ? rule.backMax : rule.backCount})
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {Array.from({ length: rule.backMax }, (_, i) => String(i + 1).padStart(2, "0")).map((num) => (
                              <button
                                key={num}
                                type="button"
                                className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
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
                    );
                  })}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddTicket}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-600 py-3 text-zinc-500 hover:border-crimson hover:text-crimson transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      添加一注
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="btn btn-sm text-zinc-500 hover:text-crimson"
                    >
                      <Minus className="h-3 w-3" />
                      清空
                    </button>
                    {customTickets.some(t => t.front.length > 0 || t.back.length > 0) && (
                      <button
                        type="button"
                        onClick={() => exportAsImage(customTickets, type, rule)}
                        className="btn btn-sm text-zinc-500 hover:text-indigo"
                      >
                        <Download className="h-3 w-3" />
                        导出
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {!allTicketsComplete ? (
                <div className="card text-center py-8">
                  <BarChart3 className="mx-auto h-10 w-10 text-zinc-400 mb-3" />
                  <p className="text-zinc-500 mb-2">请先选择完整的号码</p>
                  <p className="text-xs text-zinc-400">
                    选完 {rule.frontCount} 个{rule.frontLabel}和 {rule.backCount} 个{rule.backLabel}后自动开始对比
                  </p>
                </div>
              ) : (
                <>
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
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", bestPrize && PRIZE_COLORS[bestPrize]?.bg || "bg-yellow-100")}>
                        <span className={cn("font-serif text-lg font-bold", bestPrize && PRIZE_COLORS[bestPrize]?.text || "text-yellow-600")}>奖</span>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">最高奖项</p>
                        <p className="text-xl font-bold text-zinc-900">
                          {bestPrize || "-"}
                        </p>
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
                        <p className="text-xl font-bold text-zinc-900">
                          {customTickets.reduce((sum, t) => sum + getTotalCombinations(t), 0)}注
                        </p>
                      </div>
                    </div>
                  </div>

                  {customTickets.map((ticket, ticketIdx) => {
                    const actualTickets = generateCompoundTickets(ticket);
                    let hasPrize = false;
                    const allMatches = actualTickets.map(t => {
                      const matchResult = calculateMatches({ ...t, isCompound: ticket.isCompound });
                      if (matchResult.matches.length > 0) hasPrize = true;
                      return matchResult;
                    });

                    if (!hasPrize) return null;

                    return (
                      <div key={ticketIdx} className="card overflow-hidden">
                        <div className="flex items-center justify-between border-b border-ink-700/60 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="rounded-full bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">
                              第{ticketIdx + 1}注 {ticket.isCompound && `(复式${getTotalCombinations(ticket)}注)`}
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
                            {allMatches.some(m => m.prizeLevel) && (
                              <span className={cn("rounded-full px-3 py-1 text-xs font-bold", 
                                PRIZE_COLORS[allMatches.find(m => m.prizeLevel)?.prizeLevel || ""]?.bg,
                                PRIZE_COLORS[allMatches.find(m => m.prizeLevel)?.prizeLevel || ""]?.text)}>
                                {allMatches.find(m => m.prizeLevel)?.prizeLevel}
                              </span>
                            )}
                            <span className="rounded-full bg-ink-800 px-3 py-1 text-xs font-medium text-zinc-400">
                              中奖{allMatches.reduce((sum, m) => sum + m.matches.length, 0)}次
                            </span>
                          </div>
                        </div>

                        <div className="divide-y divide-ink-700/60">
                          {actualTickets.map((actualTicket, actualIdx) => {
                            const matchResult = calculateMatches({ ...actualTicket, isCompound: ticket.isCompound });
                            if (matchResult.matches.length === 0) return null;

                            return (
                              <div key={actualIdx}>
                                {ticket.isCompound && (
                                  <div className="bg-ink-900/30 px-4 py-2">
                                    <span className="text-xs text-zinc-500">
                                      组合 {actualIdx + 1}: {actualTicket.front.join(' ')} + {actualTicket.back.join(' ')}
                                    </span>
                                  </div>
                                )}
                                {matchResult.matches.slice(0, 30).map((m, i) => {
                                  const prize = getPrizeLevel(m.frontMatch, m.backMatch);
                                  const item = m.item as LotteryItem;
                                  return (
                                    <div key={i} className="px-4 py-3 hover:bg-ink-900/30">
                                      <div className="flex items-center justify-between mb-2">
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
                                            <span className={cn("font-bold text-sm px-2 py-0.5 rounded", prize.bg, prize.text)}>
                                              {prize.level}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-1.5 pl-8">
                                        {item.front_numbers.map((n, ni) => (
                                          <LotteryBall
                                            key={`fn-${ni}`}
                                            number={n}
                                            variant="front"
                                            size="xs"
                                            highlight={actualTicket.front.includes(n)}
                                          />
                                        ))}
                                        <span className="mx-2 h-3 w-px bg-ink-600" />
                                        {item.back_numbers.map((n, ni) => (
                                          <LotteryBall
                                            key={`bn-${ni}`}
                                            number={n}
                                            variant="back"
                                            size="xs"
                                            highlight={actualTicket.back.includes(n)}
                                          />
                                        ))}
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
                            );
                          })}
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
                </>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}