import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Trophy, TrendingDown, Target, Plus, Minus, Shuffle, RefreshCw, Upload, AlertCircle, CheckCircle2, Cloud, BarChart3, Download, Package, ChevronDown, ChevronUp, FileText, FileUp, Ban, Trash2 } from "lucide-react";
import type { RandomTicket, LotteryItem } from "@/types/lottery";
import { LOTTERY_RULES, LOTTERIES, LOTTERY_CATEGORIES, getCategoryOf, DATA_REPO_URLS, generateTicket, generateTicketWithCounts, toLotteryType, PRIZE_TABLE, getPrizeLevels, getPrizeTierByMatch, matchTicket, type LotteryPackage, type LotteryCategory } from "@/utils/lottery";
import { useLotteryStore } from "@/store/lotteryStore";
import LotteryBall from "@/components/LotteryBall";
import { LotterySelector } from "@/components/ControlBar";
import { exportTicketsToImage, isCompoundTicket } from "@/utils/exportTickets";
import { cn } from "@/lib/utils";

type RangeOption = 30 | 50 | 100 | "all" | "latest";

const RANGE_OPTIONS: { value: RangeOption; label: string }[] = [
  { value: "latest", label: "最新一期" },
  { value: 30, label: "近30期" },
  { value: 50, label: "近50期" },
  { value: 100, label: "近100期" },
  { value: "all", label: "所有期数" },
];

interface LotteryTicket {
  front: string[];
  back: string[];
}

/** 文本导入解析结果 */
interface ParseResult {
  tickets: LotteryTicket[];
  errors: string[];
}

/** 将一段号码字符串解析为补零后的号码数组，非法时返回 error */
const normalizeNumberGroup = (
  str: string,
  label: string,
  max: number,
  min: number = 1,
): { nums: string[]; error?: string } => {
  const tokens = str
    .split(/[\s,，、;；]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const nums: string[] = [];
  for (const tok of tokens) {
    const n = parseInt(tok, 10);
    if (Number.isNaN(n) || n < min || n > max) {
      return { nums: [], error: `${label}号码 "${tok}" 不合法（应在 ${min}-${max} 之间）` };
    }
    nums.push(String(n).padStart(2, "0"));
  }
  return { nums };
};

/**
 * 解析用户粘贴的文本为多注号码。支持以下每行格式：
 *  - "04 06 07 33 34 + 05 08"   （用 + 分隔前后区，支持复式）
 *  - "04,06,07,33,34,05,08"      （逗号/空格分隔，无 + 时按 frontCount 拆分前后区，仅适用单式）
 * 单个位号码可不补零（如 4 6 7 33 34 + 5 8）。
 */
const parseTicketsFromText = (text: string, rule: { frontCount: number; frontMax: number; frontMin?: number; backCount: number; backMax: number; backMin?: number; frontLabel: string; backLabel: string }): ParseResult => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const tickets: LotteryTicket[] = [];
  const errors: string[] = [];
  const frontMin = rule.frontMin ?? 1;
  const backMin = rule.backMin ?? 1;

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const plusMatch = line.match(/\+/);

    if (plusMatch) {
      const [frontPart, backPart] = line.split("+");
      const frontRes = normalizeNumberGroup(frontPart, rule.frontLabel, rule.frontMax, frontMin);
      if (frontRes.error) {
        errors.push(`第${lineNo}行: ${frontRes.error}`);
        return;
      }
      const backRes = normalizeNumberGroup(backPart, rule.backLabel, rule.backMax, backMin);
      if (backRes.error) {
        errors.push(`第${lineNo}行: ${backRes.error}`);
        return;
      }
      if (frontRes.nums.length < rule.frontCount) {
        errors.push(`第${lineNo}行: ${rule.frontLabel}号码不足，至少需要 ${rule.frontCount} 个`);
        return;
      }
      if (backRes.nums.length < rule.backCount) {
        errors.push(`第${lineNo}行: ${rule.backLabel}号码不足，至少需要 ${rule.backCount} 个`);
        return;
      }
      tickets.push({ front: frontRes.nums, back: backRes.nums });
    } else {
      const tokens = line
        .split(/[\s,，、;；]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      if (tokens.length < rule.frontCount + rule.backCount) {
        errors.push(`第${lineNo}行: 号码数量不足，至少需要 ${rule.frontCount + rule.backCount} 个`);
        return;
      }
      const frontTokens = tokens.slice(0, rule.frontCount);
      const backTokens = tokens.slice(rule.frontCount);
      const frontRes = normalizeNumberGroup(frontTokens.join(" "), rule.frontLabel, rule.frontMax, frontMin);
      if (frontRes.error) {
        errors.push(`第${lineNo}行: ${frontRes.error}`);
        return;
      }
      const backRes = normalizeNumberGroup(backTokens.join(" "), rule.backLabel, rule.backMax, backMin);
      if (backRes.error) {
        errors.push(`第${lineNo}行: ${backRes.error}`);
        return;
      }
      if (backRes.nums.length > rule.backCount) {
        errors.push(`第${lineNo}行: 无 + 分隔时仅支持单式，${rule.backLabel}号码多于 ${rule.backCount} 个，请用 + 分隔前后区`);
        return;
      }
      tickets.push({ front: frontRes.nums, back: backRes.nums });
    }
  });

  return { tickets, errors };
};

export default function MatchResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const type = toLotteryType(searchParams.get("type"));
  const ticketsJson = searchParams.get("tickets");
  // 彩种级配置（由注册表派生，新增彩种自动生效）
  const lottery = LOTTERIES[type];
  const PRIZE_COLORS = lottery.prizeColors;
  const PACKAGES = lottery.packages;

  /** 彩种选择大类（与主页一致的两行布局）：当前彩种所属大类 */
  const [activeCategory, setActiveCategory] = useState<LotteryCategory>(() =>
    getCategoryOf(type),
  );
  // 切换彩种时同步大类选中态
  useEffect(() => {
    setActiveCategory(getCategoryOf(type));
  }, [type]);
  // 切换彩种时清空杀号（不同彩种号码范围不同，旧杀号无效）
  useEffect(() => {
    setKilledFront([]);
    setKilledBack([]);
  }, [type]);
  const categoryLotteries =
    LOTTERY_CATEGORIES.find((c) => c.key === activeCategory)?.lotteries ?? [];
  /** 点击大类：切换展示的彩种列表；若当前彩种不在该大类下，跳到该大类第一个彩种 */
  const handleCategoryClick = (cat: LotteryCategory) => {
    setActiveCategory(cat);
    const list = LOTTERY_CATEGORIES.find((c) => c.key === cat)?.lotteries ?? [];
    if (list.length > 0 && !list.includes(type)) {
      setCustomTickets([{ front: [], back: [] }]);
      navigate(`/match?type=${list[0]}`);
    }
  };

  const [selectedRange, setSelectedRange] = useState<RangeOption>(30);
  const [pickCollapsed, setPickCollapsed] = useState(false);
  /** 选号区每注折叠状态：记录已折叠的注索引 */
  const [collapsedTickets, setCollapsedTickets] = useState<Set<number>>(new Set());
  /** 杀号面板折叠状态（杀号开关开启后可折叠号码网格） */
  const [killPanelCollapsed, setKillPanelCollapsed] = useState(false);
  /** 奖级表折叠状态：默认折叠，避免在移动端占太多空间 */
  const [prizeTableCollapsed, setPrizeTableCollapsed] = useState(true);
  /** 「不中指定奖级继续随机」开关 */
  const [keepRandomUntilPrize, setKeepRandomUntilPrize] = useState(false);
  /** 「杀号」开关：开启后随机时不选入已杀号码 */
  const [killEnabled, setKillEnabled] = useState(false);
  /** 已杀前区号码（已补零格式） */
  const [killedFront, setKilledFront] = useState<string[]>([]);
  /** 已杀后区号码（已补零格式） */
  const [killedBack, setKilledBack] = useState<string[]>([]);
  /** 停止奖级（下拉选项与奖级表一致） */
  const [targetPrizeLevel, setTargetPrizeLevel] = useState<string>(() => {
    const levels = getPrizeLevels(toLotteryType(searchParams.get("type")));
    return levels[levels.length - 1] ?? "九等奖";
  });
  /** 随机生成中状态 */
  const [generating, setGenerating] = useState(false);
  /** 随机生成结果说明（命中/未命中、尝试次数） */
  const [genStatus, setGenStatus] = useState<string | null>(null);
  /** 文本导入区折叠状态：默认折叠，需要时展开 */
  const [importCollapsed, setImportCollapsed] = useState(true);
  /** 文本导入输入框内容 */
  const [importText, setImportText] = useState("");
  /** 文本导入解析错误信息（成功时为空） */
  const [importErrors, setImportErrors] = useState<string[]>([]);
  /** 文本导入文件输入引用 */
  const textFileInputRef = useRef<HTMLInputElement>(null);
  /** 中奖明细折叠状态：记录已折叠的注索引，默认全部展开 */
  const [collapsedMatches, setCollapsedMatches] = useState<Set<number>>(new Set());
  const [customTickets, setCustomTickets] = useState<LotteryTicket[]>(() => {
    const empty = [{ front: [], back: [] }] as LotteryTicket[];
    if (!ticketsJson) return empty;
    try {
      const parsed = JSON.parse(ticketsJson);
      if (!Array.isArray(parsed)) return empty;
      const mapped = parsed
        .filter((t: unknown): t is RandomTicket =>
          !!t && typeof t === "object" && Array.isArray((t as RandomTicket).front) && Array.isArray((t as RandomTicket).back))
        .map((t: RandomTicket) => ({ front: t.front, back: t.back }));
      return mapped.length > 0 ? mapped : empty;
    } catch {
      return empty;
    }
  });
  
  const rule = LOTTERY_RULES[type];
  const frontMin = rule.frontMin ?? 1;
  const backMin = rule.backMin ?? 1;
  const hasBack = rule.backCount > 0;
  /** 开奖是否含后区/特别号（用于展示开奖号码：七乐彩玩家不选后区但开奖有特别号） */
  const backDrawTotal = rule.backDrawCount ?? rule.backCount;
  const hasBackDraw = backDrawTotal > 0;
  /** 当前彩种奖级顺序（一等奖在前），用于排序与「随机到指定奖级」下拉 */
  const prizeLevels = useMemo(() => getPrizeLevels(type), [type]);
  /** 生效的停止奖级：切换彩种时若原值不适用则回退到最低奖级 */
  const effectiveTargetPrizeLevel = prizeLevels.includes(targetPrizeLevel)
    ? targetPrizeLevel
    : prizeLevels[prizeLevels.length - 1];
  const state = useLotteryStore((s) => s.states[type]);
  const fetchRemoteData = useLotteryStore((s) => s.fetchRemoteData);
  const uploadData = useLotteryStore((s) => s.uploadData);
  const data = state.data;
  const loading = state.loading;
  const error = state.error;
  const source = state.source;

  // 深链接（直接访问 /match?type=xxx）无数据时自动拉取，与 TrendDetail 行为一致
  useEffect(() => {
    if (!data && !loading) {
      fetchRemoteData(type);
    }
  }, [type, data, loading, fetchRemoteData]);

  // 选号后自动同步到文本导入区，便于复制或继续编辑
  useEffect(() => {
    const lines = customTickets
      .map((t) => {
        const front = t.front.filter((n) => n !== "");
        const back = t.back.filter((n) => n !== "");
        if (front.length === 0 && back.length === 0) return "";
        if (hasBack) return `${front.join(" ")} + ${back.join(" ")}`;
        return front.join(" ");
      })
      .filter((l) => l.length > 0);
    setImportText(lines.join("\n"));
  }, [customTickets, hasBack]);

  const isTicketComplete = (ticket: LotteryTicket): boolean => {
    // 按位彩种：每位都必须选了 1 个数字（顺序即位置，不可缺位）
    if (rule.positionBased) {
      const frontOk = Array.from({ length: rule.frontCount }, (_, i) => i)
        .every((i) => !!ticket.front[i]);
      const backOk = rule.backCount > 0
        ? Array.from({ length: rule.backCount }, (_, i) => i).every((i) => !!ticket.back[i])
        : true;
      return frontOk && backOk;
    }
    return ticket.front.length >= rule.frontCount && ticket.back.length >= rule.backCount;
  };

  const allTicketsComplete = customTickets.length > 0 && customTickets.every(t => isTicketComplete(t));

  const getFilteredData = useCallback(() => {
    if (!data) return [];
    const count = selectedRange === "all" ? data.items.length : selectedRange === "latest" ? 1 : selectedRange;
    return data.items.slice(0, count);
  }, [data, selectedRange]);

  const getPrizeLevel = useCallback((frontMatch: number, backMatch: number) => {
    const tier = getPrizeTierByMatch(type, frontMatch, backMatch);
    if (!tier) return null;
    return { level: tier.level, ...PRIZE_COLORS[tier.level] };
  }, [type, PRIZE_COLORS]);

  const calculateMatches = useCallback((ticket: LotteryTicket) => {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return { total: 0, matches: [], maxMatch: 0, prizeLevel: null };
    // 未选号不计奖：快乐八七等奖为「全不中(0中)」，空票会误命中，需跳过
    if (ticket.front.length === 0 && ticket.back.length === 0) {
      return { total: 0, matches: [], maxMatch: 0, prizeLevel: null };
    }

    const results = filteredData.map((item) => {
      // 按位彩种逐位对位比较；普通彩种集合交集（matchTicket 内部区分）
      const { frontMatch, backMatch } = matchTicket(type, ticket, item);
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

    const prizeOrder = prizeLevels;
    matches.sort((a, b) => {
      const aIdx = a.prizeLevel ? prizeOrder.indexOf(a.prizeLevel) : prizeOrder.length;
      const bIdx = b.prizeLevel ? prizeOrder.indexOf(b.prizeLevel) : prizeOrder.length;
      if (aIdx !== bIdx) return aIdx - bIdx;
      return Number(b.term) - Number(a.term);
    });

    const maxMatch = matches.length > 0 ? matches[0].total : 0;
    const bestPrize = matches.length > 0 ? matches[0].prizeLevel : null;

    return { total: matches.length, matches, maxMatch, prizeLevel: bestPrize };
  }, [getFilteredData, getPrizeLevel, prizeLevels, type]);

  // 复式不再展开为所有组合，直接以一整注匹配历史，避免注数过多导致卡顿
  // memo：仅当 customTickets / 数据范围 / 彩种变化时重算，避免每渲染遍历数千期
  const totalMatches = useMemo(
    () => (customTickets.length > 0 ? customTickets.map(ticket => calculateMatches(ticket)) : []),
    [customTickets, calculateMatches],
  );

  const grandTotal = totalMatches.reduce((sum, m) => sum + m.total, 0);
  const bestPrize = totalMatches.length > 0
    ? totalMatches.reduce<string | null>((best, m) => {
        if (!best) return m.prizeLevel;
        if (!m.prizeLevel) return best;
        return prizeLevels.indexOf(m.prizeLevel) < prizeLevels.indexOf(best) ? m.prizeLevel : best;
      }, null)
    : null;

  /** 新建一注空选号：按位彩种用定长数组（每位初始为空串），普通彩种用空数组 */
  const newEmptyTicket = useCallback((): LotteryTicket => {
    if (rule.positionBased) {
      return {
        front: Array.from({ length: rule.frontCount }, () => ""),
        back: Array.from({ length: rule.backCount }, () => ""),
      };
    }
    return { front: [], back: [] };
  }, [rule]);

  const handleAddTicket = () => {
    setCustomTickets([...customTickets, newEmptyTicket()]);
  };

  /** 清空指定注的选号（重置为空注，保留注位） */
  const handleClearTicket = (index: number) => {
    setCustomTickets(customTickets.map((t, i) => (i === index ? newEmptyTicket() : t)));
  };

  const handleRemoveTicket = (index: number) => {
    setCustomTickets(customTickets.filter((_, i) => i !== index));
  };

  /** 切换指定注的折叠状态 */
  const toggleTicketCollapse = (ticketIdx: number) => {
    setCollapsedTickets((prev) => {
      const next = new Set(prev);
      if (next.has(ticketIdx)) next.delete(ticketIdx);
      else next.add(ticketIdx);
      return next;
    });
  };

  const handleToggleNumber = (ticketIndex: number, numType: "front" | "back", number: string) => {
    setCustomTickets(customTickets.map((ticket, idx) => {
      if (idx !== ticketIndex) return ticket;
      const arr = ticket[numType];
      if (arr.includes(number)) {
        return { ...ticket, [numType]: arr.filter(n => n !== number) };
      } else {
        const maxCount = numType === "front" ? rule.frontMax : rule.backMax;
        if (arr.length >= maxCount) return ticket;
        return { ...ticket, [numType]: [...arr, number].sort((a, b) => Number(a) - Number(b)) };
      }
    }));
  };

  /** 按位彩种选号：为指定位置选 1 个数字（再次点击同一数字则取消） */
  const handlePickPosition = (ticketIndex: number, numType: "front" | "back", pos: number, number: string) => {
    setCustomTickets(customTickets.map((ticket, idx) => {
      if (idx !== ticketIndex) return ticket;
      const arr = [...ticket[numType]];
      while (arr.length <= pos) arr.push("");
      arr[pos] = arr[pos] === number ? "" : number;
      return { ...ticket, [numType]: arr };
    }));
  };

  /** 杀号选号：点击号码加入/移除杀号池（再次点击同一号码则取消） */
  const handleToggleKilled = (numType: "front" | "back", number: string) => {
    if (numType === "front") {
      setKilledFront((prev) =>
        prev.includes(number)
          ? prev.filter((n) => n !== number)
          : [...prev, number].sort((a, b) => Number(a) - Number(b)),
      );
    } else {
      setKilledBack((prev) =>
        prev.includes(number)
          ? prev.filter((n) => n !== number)
          : [...prev, number].sort((a, b) => Number(a) - Number(b)),
      );
    }
  };

  /** 当前生效的杀号排除参数：杀号开关关闭时为 undefined */
  const killExclude = killEnabled
    ? { front: killedFront, back: killedBack }
    : undefined;

  const handleGenerateTicket = (ticketIndex: number) => {
    // 开关关闭：单次随机，行为不变
    if (!keepRandomUntilPrize) {
      const t = generateTicket(type, killExclude);
      setCustomTickets((prev) => prev.map((ticket, idx) => (idx === ticketIndex ? { front: t.front, back: t.back } : ticket)));
      setGenStatus(null);
      return;
    }

    // 开关开启：不中指定奖级（或更高）就继续随机
    const filteredData = getFilteredData();
    const targetIdx = prizeLevels.indexOf(effectiveTargetPrizeLevel);
    setGenerating(true);
    setGenStatus("随机中…");

    // 延迟一帧让「随机中…」先渲染，再做可能较重的循环
    setTimeout(() => {
      // 按期数自适应尝试上限：总「期×次」工作量约束在预算内，避免「所有期数」时卡顿
      const PERIOD_CHECK_BUDGET = 300000;
      const maxAttempts = Math.max(50, Math.min(20000, Math.ceil(PERIOD_CHECK_BUDGET / Math.max(filteredData.length, 1))));
      let attempts = 0;
      let bestTicket: LotteryTicket | null = null;
      let bestIdx = prizeLevels.length; // 越小越好
      let hit = false;

      while (attempts < maxAttempts) {
        attempts++;
        const candidate = generateTicket(type, killExclude);
        let candBestIdx = prizeLevels.length;
        for (let i = 0; i < filteredData.length; i++) {
          const item = filteredData[i];
          const { frontMatch: fm, backMatch: bm } = matchTicket(type, candidate, item);
          const tier = getPrizeTierByMatch(type, fm, bm);
          if (tier) {
            const idx = prizeLevels.indexOf(tier.level);
            if (idx < candBestIdx) candBestIdx = idx;
            if (candBestIdx <= targetIdx) break; // 已达目标，提前退出
          }
        }
        if (candBestIdx < bestIdx) {
          bestIdx = candBestIdx;
          bestTicket = { front: candidate.front, back: candidate.back };
        }
        if (candBestIdx <= targetIdx) {
          hit = true;
          break;
        }
      }

      const finalTicket: LotteryTicket = bestTicket ?? (() => { const t = generateTicket(type, killExclude); return { front: t.front, back: t.back }; })();
      setCustomTickets((prev) => prev.map((ticket, idx) => (idx === ticketIndex ? finalTicket : ticket)));
      setGenerating(false);
      setGenStatus(
        hit
          ? `已命中 ${effectiveTargetPrizeLevel}（或更高），共随机 ${attempts} 次`
          : `未在 ${maxAttempts} 次内命中 ${effectiveTargetPrizeLevel}，已取本次最优：${bestIdx < prizeLevels.length ? prizeLevels[bestIdx] : "未中奖"}`
      );
    }, 0);
  };

  /** 按套餐票生成：按选定价位套餐生成全部单式+复式组合，替换当前选号 */
  const handleGeneratePackage = (pkg: LotteryPackage) => {
    const newTickets: LotteryTicket[] = [];
    pkg.parts.forEach((part) => {
      for (let i = 0; i < part.count; i++) {
        const t = generateTicketWithCounts(type, part.front, part.back, killExclude);
        newTickets.push({ front: t.front, back: t.back });
      }
    });
    setCustomTickets(newTickets);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadData(type, file);
    }
    e.target.value = "";
  };

  /** 从文本框导入号码：解析后替换当前选号，解析错误时保留原选号并展示错误 */
  const handleImportText = () => {
    if (!importText.trim()) {
      setImportErrors(["请先输入号码文本"]);
      return;
    }
    const { tickets, errors } = parseTicketsFromText(importText, rule);
    setImportErrors(errors);
    if (tickets.length > 0) {
      setCustomTickets(tickets);
    }
  };

  /** 从 .txt 文件导入文本到输入框（不直接解析，便于用户确认后再导入） */
  const handleTextFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImportText(String(reader.result || ""));
        setImportErrors([]);
        setImportCollapsed(false);
      };
      reader.readAsText(file);
    }
    e.target.value = "";
  };

  const getTotalCombinations = (ticket: LotteryTicket): number => {
    if (!isCompoundTicket(ticket, rule)) return 1;
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
      <div className="border-b border-ink-700/60 bg-ink-950/40">
        <div className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6">
          {/* 第一行：页面标题 + 最高中奖（独占一行，避免与下方彩种选择挤在同一行导致换行） */}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {rule.name}对比分析
            </h1>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">选号与历史数据匹配</p>
            {bestPrize && (
              <span className={cn("ml-auto rounded-full px-3 py-1 text-xs font-bold", PRIZE_COLORS[bestPrize]?.bg, PRIZE_COLORS[bestPrize]?.text)}>
                最高: {bestPrize}
              </span>
            )}
          </div>

          {/* 第二行：大分类（体育彩票 / 福利彩票），与主页一致 */}
          <div className="mt-2">
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
          </div>

          {/* 第三行：具体彩种（与主页一致的 LotterySelector） */}
          <div className="mt-2">
            <LotterySelector
              lotteries={categoryLotteries}
              activeLottery={type}
              onSelect={(t) => {
                setCustomTickets([{ front: [], back: [] }]);
                navigate(`/match?type=${t}`);
              }}
            />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        {loading ? (
          <div className="card text-center py-12">
            <RefreshCw className="mx-auto h-12 w-12 animate-spin text-gold mb-4" />
            <p className="text-zinc-500 dark:text-zinc-400">正在加载{rule.name}开奖数据...</p>
          </div>
        ) : error ? (
          <div className="card p-4">
            <div className="flex items-start gap-2 rounded-lg border border-crimson/40 bg-crimson/10 px-3 py-2 text-xs text-crimson-400">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="space-y-1.5">
                <div>远程数据加载失败，请手动上传数据文件。</div>
                <div className="flex flex-col gap-1">
                  <span>数据文件下载地址：</span>
                  <a
                    href={DATA_REPO_URLS.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 underline-offset-2 hover:underline"
                  >
                    GitHub 数据仓库
                  </a>
                  <a
                    href={DATA_REPO_URLS.gitee}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 underline-offset-2 hover:underline"
                  >
                    Gitee 数据仓库
                  </a>
                </div>
              </div>
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
                accept=".json,.csv,application/json,text/csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>
        ) : !data ? (
          <div className="card p-8 text-center">
            <Target className="mx-auto h-12 w-12 text-zinc-400 mb-4" />
            <p className="mb-6 text-zinc-500 dark:text-zinc-400">暂无{rule.name}开奖数据</p>
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
                手动上传文件
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv,application/json,text/csv"
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
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 dark:text-zinc-300">
                    <Cloud className="h-3.5 w-3.5 text-indigo-400" />
                    <span>数据来源：开源仓库</span>
                    <a
                      href={DATA_REPO_URLS.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 underline-offset-2 hover:underline"
                    >
                      GitHub
                    </a>
                    <span className="text-zinc-600 dark:text-zinc-500">/</span>
                    <a
                      href={DATA_REPO_URLS.gitee}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 underline-offset-2 hover:underline"
                    >
                      Gitee
                    </a>
                    {data.generated_at && (
                      <span className="text-zinc-600 dark:text-zinc-500">· 更新于 {data.generated_at}</span>
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

            {/* 奖级表：依据官方最新规则，可折叠 */}
            <div className="card mb-4 overflow-hidden">
              <button
                type="button"
                onClick={() => setPrizeTableCollapsed((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-ink-800/40"
              >
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-gold" />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{rule.name}奖级表</span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">依据官方最新规则</span>
                </div>
                {prizeTableCollapsed ? (
                  <ChevronDown className="h-4 w-4 text-zinc-500" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-zinc-500" />
                )}
              </button>

              {!prizeTableCollapsed && (
                <div className="overflow-x-auto border-t border-ink-700/60">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-ink-900/40 text-zinc-500 dark:text-zinc-400">
                        <th className="whitespace-nowrap px-3 py-2 text-left font-medium">奖级</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left font-medium">中奖条件（{rule.frontLabel}+{rule.backLabel}）</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left font-medium">奖金</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left font-medium">类型</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-700/60">
                      {PRIZE_TABLE[type].map((tier) => (
                        <tr key={tier.level} className="hover:bg-ink-900/30">
                          <td className="px-3 py-2">
                            <span className={cn("inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold",
                              PRIZE_COLORS[tier.level]?.bg, PRIZE_COLORS[tier.level]?.text)}>
                              {tier.level}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 font-mono text-zinc-700 dark:text-zinc-200">
                            {tier.conditions.map((c) => `${c.front}+${c.back}`).join(" / ")}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-zinc-700 dark:text-zinc-200">
                            {tier.bonus}
                            {tier.note && (
                              <span className="ml-1 text-[10px] text-amber-500">{tier.note}</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-zinc-500 dark:text-zinc-400">
                            {tier.kind === "floating" ? "浮动奖" : "固定奖"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {lottery.ruleNote && (
                    <div className="border-t border-ink-700/60 bg-amber-500/5 px-3 py-2 text-[10px] leading-relaxed text-amber-600 dark:text-amber-400">
                      {lottery.ruleNote}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="card p-4 lg:sticky lg:top-4 lg:self-start">
                <div className="mb-4 flex flex-wrap items-center gap-4">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">选择查询范围:</span>
                  <div className="flex gap-2">
                    {RANGE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                          selectedRange === option.value
                            ? "bg-crimson text-white"
                            : "bg-ink-800 text-zinc-400 hover:bg-ink-700 dark:text-zinc-300"
                        )}
                        onClick={() => setSelectedRange(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    共 {getFilteredData().length} 期数据
                  </span>
                </div>

                {/* 选号区：可折叠，查询范围始终显示在折叠区外 */}
                <div className="overflow-hidden rounded-xl border border-ink-700/60 bg-ink-900/20">
                  <button
                    type="button"
                    onClick={() => setPickCollapsed((v) => !v)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-ink-800/40"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">选号区</span>
                      <span className="rounded-full bg-ink-800 px-2 py-0.5 text-xs text-zinc-400 dark:text-zinc-300">{customTickets.length}注</span>
                      {allTicketsComplete && (
                        <span className="flex items-center gap-1 text-xs text-green-500">
                          <CheckCircle2 className="h-3 w-3" />
                          已选完
                        </span>
                      )}
                    </div>
                    {pickCollapsed ? (
                      <ChevronDown className="h-4 w-4 text-zinc-500" />
                    ) : (
                      <ChevronUp className="h-4 w-4 text-zinc-500" />
                    )}
                  </button>

                  {!pickCollapsed && (
                    <div className="space-y-4 border-t border-ink-700/60 p-4">
                      {/* 文本导入区：可折叠，支持粘贴多行号码或从 .txt 文件导入 */}
                      <div className="overflow-hidden rounded-xl border border-ink-700/60 bg-ink-900/30">
                        <button
                          type="button"
                          onClick={() => setImportCollapsed((v) => !v)}
                          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-ink-800/40"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-indigo" />
                            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">文本导入</span>
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">粘贴或从文件导入多注号码</span>
                          </div>
                          {importCollapsed ? (
                            <ChevronDown className="h-4 w-4 text-zinc-500" />
                          ) : (
                            <ChevronUp className="h-4 w-4 text-zinc-500" />
                          )}
                        </button>

                        {!importCollapsed && (
                          <div className="space-y-3 border-t border-ink-700/60 p-4">
                            <textarea
                              value={importText}
                              onChange={(e) => {
                                setImportText(e.target.value);
                                if (importErrors.length > 0) setImportErrors([]);
                              }}
                              placeholder={`每行一注，支持以下格式：\n${hasBack ? `${Array.from({ length: rule.frontCount }, (_, i) => i + frontMin).join(" ")} + ${Array.from({ length: rule.backCount }, (_, i) => i + backMin).join(" ")}` : Array.from({ length: rule.frontCount }, (_, i) => i + frontMin).join(" ")}\n${Array.from({ length: rule.frontCount + rule.backCount }, (_, i) => i + frontMin).join(",")}`}
                              rows={6}
                              className="w-full resize-y rounded-lg border border-ink-600 bg-ink-950/60 px-3 py-2 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo focus:outline-none focus:ring-1 focus:ring-indigo dark:text-zinc-100 dark:placeholder:text-zinc-500"
                            />

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={handleImportText}
                                className="btn btn-sm bg-indigo text-white hover:bg-indigo/90"
                              >
                                <FileText className="h-3 w-3" />
                                导入号码
                              </button>
                              <button
                                type="button"
                                onClick={() => textFileInputRef.current?.click()}
                                className="btn btn-sm"
                              >
                                <FileUp className="h-3 w-3" />
                                从文件导入
                              </button>
                              <input
                                ref={textFileInputRef}
                                type="file"
                                accept=".txt,.csv,text/plain,text/csv"
                                className="hidden"
                                onChange={handleTextFileChange}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setImportText("");
                                  setImportErrors([]);
                                }}
                                className="btn btn-sm text-zinc-500 hover:text-crimson dark:text-zinc-400"
                              >
                                清空文本
                              </button>
                              <span className="ml-auto text-[10px] text-zinc-500 dark:text-zinc-400">
                                {hasBack ? `${rule.frontCount}个${rule.frontLabel} + ${rule.backCount}个${rule.backLabel} 为一注` : `${rule.frontCount}个${rule.frontLabel} 为一注`}
                              </span>
                            </div>

                            {importErrors.length > 0 && (
                              <div className="rounded-lg border border-crimson/40 bg-crimson/10 px-3 py-2 text-xs text-crimson-400">
                                <div className="mb-1 flex items-center gap-1 font-medium">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  解析错误（{importErrors.length}行）
                                </div>
                                <ul className="ml-4 list-disc space-y-0.5">
                                  {importErrors.slice(0, 8).map((err, i) => (
                                    <li key={i}>{err}</li>
                                  ))}
                                  {importErrors.length > 8 && (
                                    <li className="text-zinc-500">还有 {importErrors.length - 8} 条错误...</li>
                                  )}
                                </ul>
                              </div>
                            )}

                            <div className="rounded-lg bg-ink-950/40 px-3 py-2 text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                              <div className="mb-1 font-medium text-zinc-400 dark:text-zinc-300">格式说明</div>
                              {hasBack && <div>· 用 <span className="font-mono text-zinc-300">+</span> 分隔前后区，支持复式（如 5+3）</div>}
                              <div>· 无 <span className="font-mono text-zinc-300">+</span> 时按前{rule.frontCount}个为{rule.frontLabel}{hasBack ? `、其余为${rule.backLabel}` : ""}自动拆分（仅单式）</div>
                              <div>· 分隔符支持空格、逗号、顿号；号码范围 {rule.frontLabel} {frontMin}-{rule.frontMax}{hasBack ? `，${rule.backLabel} ${backMin}-${rule.backMax}` : ""}</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {PACKAGES && PACKAGES.length > 0 && (
                        <div className="rounded-xl border border-ink-700/60 bg-ink-900/30 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 text-gold" />
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">按套餐票生成</span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">点击生成对应价位组合（替换当前选号）</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {PACKAGES.map((pkg) => (
                        <button
                          key={pkg.id}
                          type="button"
                          className="flex flex-col items-start rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-left transition-colors hover:border-gold hover:bg-gold/5"
                          onClick={() => handleGeneratePackage(pkg)}
                        >
                          <span className="flex items-baseline gap-1">
                            <span className="text-sm font-bold text-gold">{pkg.price}元</span>
                            <span className="text-xs text-zinc-300">{pkg.name}</span>
                          </span>
                          <span className="mt-0.5 text-[10px] leading-tight text-zinc-500 dark:text-zinc-400">
                            {pkg.parts.map((p) =>
                              p.kind === "compound" ? `${p.front}+${p.back}复式` : `${p.count}注单式`
                            ).join(" · ")}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 随机生成开关：不中指定奖级继续随机 */}
                <div className="rounded-xl border border-ink-700/60 bg-ink-900/30 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={keepRandomUntilPrize}
                      disabled={generating}
                      onClick={() => { setKeepRandomUntilPrize((v) => !v); setGenStatus(null); }}
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
                        keepRandomUntilPrize ? "bg-gold" : "bg-ink-600"
                      )}
                    >
                      <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", keepRandomUntilPrize ? "translate-x-4" : "translate-x-0.5")} />
                    </button>
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">不中指定奖级继续随机</span>
                    {keepRandomUntilPrize && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">停止奖级</span>
                        <select
                          value={effectiveTargetPrizeLevel}
                          disabled={generating}
                          onChange={(e) => { setTargetPrizeLevel(e.target.value); setGenStatus(null); }}
                          className="rounded-md border border-ink-600 bg-ink-950/60 px-2 py-1 text-xs text-zinc-900 focus:border-indigo focus:outline-none dark:text-zinc-100"
                        >
                          {prizeLevels.map((lvl) => (
                            <option key={lvl} value={lvl}>{lvl}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <span className="ml-auto text-[10px] text-zinc-500 dark:text-zinc-400">仅作用于每注「随机」按钮</span>
                  </div>
                  {generating ? (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-gold">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      随机中…（按期数自适应上限）
                    </div>
                  ) : genStatus ? (
                    <div className="mt-2 text-[10px] text-zinc-500 dark:text-zinc-400">{genStatus}</div>
                  ) : null}
                  {keepRandomUntilPrize && (
                    <p className="mt-2 text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                      开启后，点击每注的随机按钮会反复生成号码，直到所选范围内至少有一期中出「停止奖级」或更高奖级为止；一等奖等极小概率奖级可能无法在限定次数内命中。
                    </p>
                  )}
                </div>

                {/* 杀号开关：开启后随机生成时不选入已杀号码 */}
                <div className="rounded-xl border border-ink-700/60 bg-ink-900/30 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={killEnabled}
                      disabled={generating}
                      onClick={() => setKillEnabled((v) => !v)}
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
                        killEnabled ? "bg-crimson" : "bg-ink-600"
                      )}
                    >
                      <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", killEnabled ? "translate-x-4" : "translate-x-0.5")} />
                    </button>
                    <Ban className="h-3.5 w-3.5 text-crimson" />
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">杀号</span>
                    {killEnabled ? (
                      <>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          已杀{rule.frontLabel}{killedFront.length}个{hasBack ? `、${rule.backLabel}${killedBack.length}个` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => setKillPanelCollapsed((v) => !v)}
                          className="ml-auto text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                          title={killPanelCollapsed ? "展开" : "折叠"}
                        >
                          {killPanelCollapsed ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronUp className="h-4 w-4" />
                          )}
                        </button>
                      </>
                    ) : (
                      <span className="ml-auto text-[10px] text-zinc-500 dark:text-zinc-400">开启后随机时不选入已杀号码</span>
                    )}
                  </div>

                  {killEnabled && !killPanelCollapsed && (
                    <div className="mt-3 space-y-3 border-t border-ink-700/60 pt-3">
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            {rule.frontLabel} 杀号 (已杀{killedFront.length}/{rule.frontMax - frontMin + 1})
                          </span>
                        </div>
                        <div className={cn("grid gap-1", lottery.pickGridCols.front)}>
                          {Array.from({ length: rule.frontMax - frontMin + 1 }, (_, i) => String(i + frontMin).padStart(2, "0")).map((num) => {
                            const killed = killedFront.includes(num);
                            return (
                              <button
                                key={num}
                                type="button"
                                disabled={generating}
                                className={cn(
                                  "flex h-8 w-8 items-center justify-center justify-self-center rounded-full text-sm font-medium transition-colors disabled:opacity-50",
                                  killed
                                    ? "bg-zinc-700 text-zinc-400 line-through"
                                    : "bg-ink-800 text-zinc-600 hover:bg-ink-700 dark:text-zinc-300"
                                )}
                                onClick={() => handleToggleKilled("front", num)}
                              >
                                {Number(num)}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {hasBack && (
                        <div>
                          <div className="mb-2 flex items-center gap-2">
                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                              {rule.backLabel} 杀号 (已杀{killedBack.length}/{rule.backMax - backMin + 1})
                            </span>
                          </div>
                          <div className={cn("grid gap-1", lottery.pickGridCols.back)}>
                            {Array.from({ length: rule.backMax - backMin + 1 }, (_, i) => String(i + backMin).padStart(2, "0")).map((num) => {
                              const killed = killedBack.includes(num);
                              return (
                                <button
                                  key={num}
                                  type="button"
                                  disabled={generating}
                                  className={cn(
                                    "flex h-8 w-8 items-center justify-center justify-self-center rounded-full text-sm font-medium transition-colors disabled:opacity-50",
                                    killed
                                      ? "bg-zinc-700 text-zinc-400 line-through"
                                      : "bg-ink-800 text-zinc-600 hover:bg-ink-700 dark:text-zinc-300"
                                  )}
                                  onClick={() => handleToggleKilled("back", num)}
                                >
                                  {Number(num)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {(killedFront.length > 0 || killedBack.length > 0) && (
                        <button
                          type="button"
                          onClick={() => { setKilledFront([]); setKilledBack([]); }}
                          disabled={generating}
                          className="btn btn-sm text-zinc-500 hover:text-crimson dark:text-zinc-400"
                        >
                          清空杀号
                        </button>
                      )}
                      <p className="text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                        已杀号码在点击「随机」按钮（含套餐票生成、不中指定奖级继续随机）时不会被选入；若杀号数量超过可选范围上限，将自动回退为不排除。
                      </p>
                    </div>
                  )}
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
                          <button
                            type="button"
                            onClick={() => toggleTicketCollapse(ticketIdx)}
                            className="flex items-center gap-3 text-left"
                          >
                            <span className="rounded-full bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">
                              第{ticketIdx + 1}注
                            </span>
                            {isCompoundTicket(ticket, rule) && (
                              <span className="rounded bg-crimson/20 px-2 py-0.5 text-xs text-crimson">
                                复式 {getTotalCombinations(ticket)}注
                              </span>
                            )}
                            {complete ? (
                              <span className="flex items-center gap-1 text-xs text-green-500">
                                <CheckCircle2 className="h-3 w-3" />
                                已选完
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                {rule.positionBased
                                  ? `请为每位数字各选 1 个（${rule.frontLabel}${hasBack ? ` + ${rule.backLabel}` : ""}）`
                                  : `请选择至少${rule.frontCount}个${rule.frontLabel}${hasBack ? `和至少${rule.backCount}个${rule.backLabel}` : ""}`}
                              </span>
                            )}
                            {collapsedTickets.has(ticketIdx) ? (
                              <ChevronDown className="h-4 w-4 text-zinc-500" />
                            ) : (
                              <ChevronUp className="h-4 w-4 text-zinc-500" />
                            )}
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleGenerateTicket(ticketIdx)}
                              disabled={generating}
                              className="btn btn-sm"
                              title={keepRandomUntilPrize ? `随机至中${effectiveTargetPrizeLevel}（或更高）` : "随机生成"}
                            >
                              <Shuffle className={cn("h-3 w-3", generating && "animate-pulse")} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleClearTicket(ticketIdx)}
                              disabled={generating}
                              className="btn btn-sm text-zinc-500 hover:text-crimson dark:text-zinc-400"
                              title="清空本注"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                            {customTickets.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTicket(ticketIdx)}
                                className="btn btn-sm text-zinc-500 hover:text-crimson dark:text-zinc-400"
                                title="删除本注"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {collapsedTickets.has(ticketIdx) ? (
                          <div className="flex flex-wrap items-center gap-1.5 py-1">
                            {ticket.front.filter(Boolean).length === 0 && ticket.back.filter(Boolean).length === 0 ? (
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">未选号</span>
                            ) : (
                              <>
                                {ticket.front.filter(Boolean).map((n, i) => (
                                  <LotteryBall key={`cf-${i}`} number={n} variant="front" size="sm" />
                                ))}
                                {hasBack && ticket.back.filter(Boolean).length > 0 && (
                                  <span className="mx-1 h-3 w-px bg-ink-600" />
                                )}
                                {ticket.back.filter(Boolean).map((n, i) => (
                                  <LotteryBall key={`cb-${i}`} number={n} variant="back" size="sm" />
                                ))}
                              </>
                            )}
                          </div>
                        ) : rule.positionBased ? (
                          <>
                            {/* 按位选号：每位独立选 1 个数字，顺序即位置，不可排序 */}
                            <div className="mb-3 space-y-2">
                              <div className="mb-1 flex items-center gap-2">
                                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                  {rule.frontLabel}（每位选 1 个，共 {rule.frontCount} 位，{frontMin}-{rule.frontMax}）
                                </span>
                              </div>
                              {Array.from({ length: rule.frontCount }, (_, pos) => (
                                <div key={pos} className="flex items-center gap-2">
                                  <span className="w-9 shrink-0 text-right text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                                    第{pos + 1}位
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {Array.from({ length: rule.frontMax - frontMin + 1 }, (_, i) => {
                                      const num = String(i + frontMin).padStart(2, "0");
                                      const selected = ticket.front[pos] === num;
                                      return (
                                        <button
                                          key={num}
                                          type="button"
                                          className={cn(
                                            "flex h-7 w-7 items-center justify-center rounded-lg text-xs font-mono font-medium transition-colors",
                                            selected
                                              ? "bg-crimson text-white"
                                              : "bg-ink-800 text-zinc-600 hover:bg-ink-700 dark:text-zinc-300",
                                          )}
                                          onClick={() => handlePickPosition(ticketIdx, "front", pos, num)}
                                        >
                                          {Number(num)}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {hasBack && (
                              <div className="space-y-2">
                                <div className="mb-1 flex items-center gap-2">
                                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                    {rule.backLabel}（选 1 个，{backMin}-{rule.backMax}）
                                  </span>
                                </div>
                                {Array.from({ length: rule.backCount }, (_, pos) => (
                                  <div key={pos} className="flex items-center gap-2">
                                    <span className="w-9 shrink-0 text-right text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                                      {rule.backLabel}
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                      {Array.from({ length: rule.backMax - backMin + 1 }, (_, i) => {
                                        const num = String(i + backMin).padStart(2, "0");
                                        const selected = ticket.back[pos] === num;
                                        return (
                                          <button
                                            key={num}
                                            type="button"
                                            className={cn(
                                              "flex h-7 w-7 items-center justify-center rounded-lg text-xs font-mono font-medium transition-colors",
                                              selected
                                                ? "bg-indigo text-white"
                                                : "bg-ink-800 text-zinc-600 hover:bg-ink-700 dark:text-zinc-300",
                                            )}
                                            onClick={() => handlePickPosition(ticketIdx, "back", pos, num)}
                                          >
                                            {Number(num)}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="mb-3">
                              <div className="mb-2 flex items-center gap-2">
                                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                  {rule.frontLabel} ({ticket.front.length}/{rule.frontMax}，最少{rule.frontCount})
                                </span>
                              </div>
                              <div className={cn("grid gap-1", lottery.pickGridCols.front)}>
                                {Array.from({ length: rule.frontMax - frontMin + 1 }, (_, i) => String(i + frontMin).padStart(2, "0")).map((num) => (
                                  <button
                                    key={num}
                                    type="button"
                                    className={cn(
                                      "flex h-8 w-8 items-center justify-center justify-self-center rounded-full text-sm font-medium transition-colors",
                                      ticket.front.includes(num)
                                        ? "bg-crimson text-white"
                                        : "bg-ink-800 text-zinc-600 hover:bg-ink-700 dark:text-zinc-300"
                                    )}
                                    onClick={() => handleToggleNumber(ticketIdx, "front", num)}
                                  >
                                    {Number(num)}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {hasBack && (
                              <div>
                                <div className="mb-2 flex items-center gap-2">
                                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                    {rule.backLabel} ({ticket.back.length}/{rule.backMax}，最少{rule.backCount})
                                  </span>
                                </div>
                                <div className={cn("grid gap-1", lottery.pickGridCols.back)}>
                                  {Array.from({ length: rule.backMax - backMin + 1 }, (_, i) => String(i + backMin).padStart(2, "0")).map((num) => (
                                    <button
                                      key={num}
                                      type="button"
                                      className={cn(
                                        "flex h-8 w-8 items-center justify-center justify-self-center rounded-full text-sm font-medium transition-colors",
                                        ticket.back.includes(num)
                                          ? "bg-indigo text-white"
                                          : "bg-ink-800 text-zinc-600 hover:bg-ink-700 dark:text-zinc-300"
                                      )}
                                      onClick={() => handleToggleNumber(ticketIdx, "back", num)}
                                    >
                                      {Number(num)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddTicket}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-600 py-3 text-zinc-500 hover:border-crimson hover:text-crimson transition-colors dark:text-zinc-400"
                    >
                      <Plus className="h-4 w-4" />
                      添加一注
                    </button>
                    {customTickets.some(t => t.front.length > 0 || t.back.length > 0) && (
                      <button
                        type="button"
                        onClick={() => exportTicketsToImage(customTickets, type)}
                        className="btn btn-sm text-zinc-500 hover:text-indigo dark:text-zinc-400"
                      >
                        <Download className="h-3 w-3" />
                        导出
                      </button>
                    )}
                  </div>
                </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 右侧：匹配结果（桌面端与选号区并排，移动端堆叠在下方） */}
              <div className="space-y-4">
              {!allTicketsComplete ? (
                <div className="card text-center py-8">
                  <BarChart3 className="mx-auto h-10 w-10 text-zinc-400 mb-3" />
                  <p className="text-zinc-500 dark:text-zinc-400 mb-2">请先选择完整的号码</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    选完 {rule.frontCount} 个{rule.frontLabel}{hasBack ? `和 ${rule.backCount} 个${rule.backLabel}` : ""}后自动开始对比
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="card flex items-center gap-3 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10">
                        <Trophy className="h-5 w-5 text-gold" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">中奖次数</p>
                        <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{grandTotal}</p>
                      </div>
                    </div>
                    <div className="card flex items-center gap-3 p-4">
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", bestPrize && PRIZE_COLORS[bestPrize]?.bg || "bg-yellow-100")}>
                        <span className={cn("font-serif text-lg font-bold", bestPrize && PRIZE_COLORS[bestPrize]?.text || "text-yellow-600")}>奖</span>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">最高奖项</p>
                        <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                          {bestPrize || "-"}
                        </p>
                      </div>
                    </div>
                    <div className="card flex items-center gap-3 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo/10">
                        <TrendingDown className="h-5 w-5 text-indigo" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">查询期数</p>
                        <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{getFilteredData().length}期</p>
                      </div>
                    </div>
                    <div className="card flex items-center gap-3 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green/10">
                        <span className="font-serif text-lg font-bold text-green">注</span>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">投注数量</p>
                        <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                          {customTickets.reduce((sum, t) => sum + getTotalCombinations(t), 0)}注
                        </p>
                      </div>
                    </div>
                  </div>

                  {customTickets.map((ticket, ticketIdx) => {
                    const compound = isCompoundTicket(ticket, rule);
                    const matchResult = totalMatches[ticketIdx];
                    if (!matchResult || matchResult.matches.length === 0) return null;

                    const isMatchCollapsed = collapsedMatches.has(ticketIdx);
                    const toggleMatch = () =>
                      setCollapsedMatches((prev) => {
                        const next = new Set(prev);
                        if (next.has(ticketIdx)) next.delete(ticketIdx);
                        else next.add(ticketIdx);
                        return next;
                      });

                    return (
                      <div key={ticketIdx} className="card overflow-hidden">
                        <button
                          type="button"
                          onClick={toggleMatch}
                          className="flex w-full flex-col gap-2 border-b border-ink-700/60 px-4 py-3 text-left transition-colors hover:bg-ink-900/30"
                        >
                          {/* 第一行：注号标签 + 奖项 / 中奖次数 / 折叠箭头 */}
                          <div className="flex items-center justify-between">
                            <span className="rounded-full bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">
                              第{ticketIdx + 1}注 {compound && `(复式${getTotalCombinations(ticket)}注)`}
                            </span>
                            <div className="flex items-center gap-2">
                              {matchResult.prizeLevel && (
                                <span className={cn("rounded-full px-3 py-1 text-xs font-bold",
                                  PRIZE_COLORS[matchResult.prizeLevel]?.bg,
                                  PRIZE_COLORS[matchResult.prizeLevel]?.text)}>
                                  {matchResult.prizeLevel}
                                </span>
                              )}
                              <span className="rounded-full bg-ink-800 px-3 py-1 text-xs font-medium text-zinc-400 dark:text-zinc-300">
                                中奖{matchResult.total}次
                              </span>
                              {isMatchCollapsed ? (
                                <ChevronDown className="h-4 w-4 text-zinc-500" />
                              ) : (
                                <ChevronUp className="h-4 w-4 text-zinc-500" />
                              )}
                            </div>
                          </div>
                          {/* 第二行：本注号码 */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {ticket.front.map((n, i) => (
                              <LotteryBall key={`f-${i}`} number={n} variant="front" size="sm" />
                            ))}
                            {hasBack && <span className="mx-1 h-3 w-px bg-ink-600" />}
                            {ticket.back.map((n, i) => (
                              <LotteryBall key={`b-${i}`} number={n} variant="back" size="sm" />
                            ))}
                          </div>
                        </button>

                        {!isMatchCollapsed && (
                          <div className="divide-y divide-ink-700/60">
                          {matchResult.matches.slice(0, 30).map((m, i) => {
                            const prize = m.prize;
                            const item = m.item as LotteryItem;
                            return (
                              <div key={i} className="px-4 py-3 hover:bg-ink-900/30">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-4">
                                    <span className="font-mono text-sm text-zinc-600 dark:text-zinc-400">
                                      {m.term}期
                                    </span>
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                      {m.date}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                      <span className={cn("rounded-md px-2 py-0.5 text-xs",
                                        m.frontMatch === rule.frontCount ? "bg-crimson/20 text-crimson" : "bg-ink-800 text-zinc-500 dark:text-zinc-400")}>
                                        {rule.frontLabel}{m.frontMatch}
                                      </span>
                                      {hasBackDraw && (
                                        <span className={cn("rounded-md px-2 py-0.5 text-xs",
                                          m.backMatch === backDrawTotal ? "bg-indigo/20 text-indigo" : "bg-ink-800 text-zinc-500 dark:text-zinc-400")}>
                                          {rule.backLabel}{m.backMatch}
                                        </span>
                                      )}
                                    </div>
                                    {prize && (
                                      <span className={cn("font-bold text-sm px-2 py-0.5 rounded", prize.bg, prize.text)}>
                                        {prize.level}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {item.front_numbers.map((n, ni) => (
                                    <LotteryBall
                                      key={`fn-${ni}`}
                                      number={n}
                                      variant="front"
                                      size="sm"
                                      highlight={rule.positionBased ? ticket.front[ni] === n : ticket.front.includes(n)}
                                    />
                                  ))}
                                  {hasBackDraw && <span className="mx-2 h-3 w-px bg-ink-600" />}
                                  {item.back_numbers.map((n, ni) => (
                                    <LotteryBall
                                      key={`bn-${ni}`}
                                      number={n}
                                      variant="back"
                                      size="sm"
                                      highlight={rule.positionBased ? ticket.back[ni] === n : rule.backMatchFromFront ? ticket.front.includes(n) : ticket.back.includes(n)}
                                    />
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                          {matchResult.matches.length > 30 && (
                            <div className="px-4 py-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
                              还有 {matchResult.matches.length - 30} 条中奖记录...
                            </div>
                          )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {customTickets.length > 0 && grandTotal === 0 && (
                    <div className="card text-center py-8">
                      <Target className="mx-auto h-10 w-10 text-zinc-400 mb-3" />
                      <p className="text-zinc-500 dark:text-zinc-400">未查询到中奖记录</p>
                    </div>
                  )}
                </>
              )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}