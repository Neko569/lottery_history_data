import { useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Trophy, TrendingDown, Target, Plus, Minus, Shuffle, RefreshCw, Upload, AlertCircle, CheckCircle2, Cloud, BarChart3, Download, Package, ChevronDown, ChevronUp, FileText, FileUp } from "lucide-react";
import type { LotteryType, RandomTicket, LotteryItem } from "@/types/lottery";
import { LOTTERY_RULES, DATA_REPO_URLS, generateTickets, generateTicketWithCounts, toLotteryType } from "@/utils/lottery";
import { useLotteryStore } from "@/store/lotteryStore";
import LotteryBall from "@/components/LotteryBall";
import { isDarkMode } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

type RangeOption = 30 | 50 | 100 | "all";

const RANGE_OPTIONS: { value: RangeOption; label: string }[] = [
  { value: 30, label: "近30期" },
  { value: 50, label: "近50期" },
  { value: 100, label: "近100期" },
  { value: "all", label: "所有期数" },
];

/** 号码选择网格每行列数：保证每行数字数量一致（优先整除）
 *  dlt 前区 35 → 移动端 7 列（5 行整除）；桌面端 11 列（更紧凑，末行 2 个居中）
 *  dlt 后区 12 → 6 列（2 行整除）
 *  ssq 前区 33 → 移动端 7 列；桌面端 11 列（3 行整除）
 *  ssq 后区 16 → 8 列（2 行整除） */
const PICK_GRID_COLS: Record<LotteryType, { front: string; back: string }> = {
  dlt: { front: "grid-cols-7 lg:grid-cols-11", back: "grid-cols-6" },
  ssq: { front: "grid-cols-7 sm:grid-cols-11", back: "grid-cols-8" },
};

/** 大乐透套餐票组合部件：单式或复式 */
interface DltPackagePart {
  /** "single" 单式 5+2 / "compound" 复式 */
  kind: "single" | "compound";
  /** 前区个数 */
  front: number;
  /** 后区个数 */
  back: number;
  /** 生成几注（单式为注数，复式为1组） */
  count: number;
}

/** 大乐透套餐票（仅大乐透支持，双色球保持不变）
 *  依据体彩官方四款固定面值套餐：18/28/58/88 元，每款由若干单式 + 复式组合而成 */
interface DltPackage {
  id: string;
  name: string;
  price: number;
  parts: DltPackagePart[];
}

const DLT_PACKAGES: DltPackage[] = [
  {
    id: "p18",
    name: "崭露头角",
    price: 18,
    parts: [
      { kind: "single", front: 5, back: 2, count: 6 },
      { kind: "compound", front: 5, back: 3, count: 1 },
    ],
  },
  {
    id: "p28",
    name: "鱼跃龙门",
    price: 28,
    parts: [
      { kind: "single", front: 5, back: 2, count: 8 },
      { kind: "compound", front: 6, back: 2, count: 1 },
    ],
  },
  {
    id: "p58",
    name: "马到功成",
    price: 58,
    parts: [
      { kind: "single", front: 5, back: 2, count: 8 },
      { kind: "compound", front: 7, back: 2, count: 1 },
    ],
  },
  {
    id: "p88",
    name: "高飞远翔",
    price: 88,
    parts: [
      { kind: "single", front: 5, back: 2, count: 5 },
      { kind: "compound", front: 6, back: 3, count: 1 },
      { kind: "compound", front: 7, back: 2, count: 1 },
    ],
  },
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

/** 导出号码为图片（颜色随当前主题模式变化） */
const exportAsImage = (tickets: LotteryTicket[], type: LotteryType, rule: typeof LOTTERY_RULES.dlt) => {
  const isDlt = type === "dlt";
  const dark = isDarkMode();
  const padding = 40;
  const ballSize = 36;
  const ballGap = 8;
  const rowGap = 20;
  const separatorWidth = 30;
  const labelHeight = 60;

  // 主题相关颜色
  const bgColor = dark ? "#0a0a12" : "#ffffff";
  const titleColor = dark ? "#f4f4f5" : "#27272a";
  const indexColor = dark ? "#a1a1aa" : "#71717a";
  const separatorColor = dark ? "#3a3a4a" : "#d1d1d8";
  const compoundTagColor = "#f59e0b";

  const frontBalls = rule.frontCount;
  const backBalls = rule.backCount;

  // 按每注自身是否复式计算尺寸（复式与单式混合时各自独立）
  const getTicketWidth = (ticket: LotteryTicket) => {
    if (isCompoundTicket(ticket, rule)) {
      // 复式：上下两排，取前后区最大宽度
      const maxBalls = Math.max(ticket.front.length, ticket.back.length);
      return padding * 2 + maxBalls * ballSize + (maxBalls - 1) * ballGap;
    }
    // 单式：同一排
    return padding * 2 + frontBalls * ballSize + (frontBalls - 1) * ballGap + separatorWidth + backBalls * ballSize + (backBalls - 1) * ballGap;
  };
  const getTicketHeight = (ticket: LotteryTicket) =>
    isCompoundTicket(ticket, rule) ? ballSize * 2 + rowGap + 16 : ballSize + rowGap;

  const width = Math.max(...tickets.map(getTicketWidth));
  const height = labelHeight + tickets.reduce((sum, t) => sum + getTicketHeight(t), 0) + padding;

  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = titleColor;
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(rule.name, width / 2, 36);

  // 绘制号码的辅助函数
  const drawBall = (x: number, y: number, num: string, isFront: boolean) => {
    const gradient = ctx.createRadialGradient(x - 3, y - 3, 0, x, y, ballSize / 2);
    if (isFront) {
      gradient.addColorStop(0, "#ef4444");
      gradient.addColorStop(1, "#b91c1c");
    } else if (isDlt) {
      gradient.addColorStop(0, "#818cf8");
      gradient.addColorStop(1, "#4f46e5");
    } else {
      gradient.addColorStop(0, "#3b82f6");
      gradient.addColorStop(1, "#1d4ed8");
    }
    ctx.beginPath();
    ctx.arc(x, y, ballSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(num, x, y);
  };

  // 逐注绘制：复式上下两排，单式同一排（各自独立判断）
  let currentY = labelHeight;
  tickets.forEach((ticket, ticketIdx) => {
    if (isCompoundTicket(ticket, rule)) {
      // 复式：上下两排布局
      const centerX = width / 2;

      // 前区（上排）—— 左对齐
      const frontWidth = ticket.front.length * ballSize + (ticket.front.length - 1) * ballGap;
      const frontStartX = padding;
      ticket.front.forEach((num, i) => {
        const x = frontStartX + i * (ballSize + ballGap) + ballSize / 2;
        const y = currentY + ballSize / 2;
        drawBall(x, y, num, true);
      });

      // 后区（下排）—— 左对齐
      const backWidth = ticket.back.length * ballSize + (ticket.back.length - 1) * ballGap;
      const backStartX = padding;
      ticket.back.forEach((num, i) => {
        const x = backStartX + i * (ballSize + ballGap) + ballSize / 2;
        const y = currentY + ballSize + rowGap + ballSize / 2;
        drawBall(x, y, num, false);
      });

      // 期号
      ctx.fillStyle = indexColor;
      ctx.font = "14px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`${ticketIdx + 1}`, 8, currentY + ballSize / 2 + 4);

      // 复式标签
      ctx.fillStyle = compoundTagColor;
      ctx.font = "12px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("复式", width - 8, currentY + ballSize / 2 + 4);

      currentY += ballSize * 2 + rowGap + 16;
    } else {
      // 单式：同一排布局
      const y = currentY;

      // 前区球
      ticket.front.forEach((num, i) => {
        const x = padding + i * (ballSize + ballGap) + ballSize / 2;
        const ballY = y + ballSize / 2;
        drawBall(x, ballY, num, true);
      });

      // 分隔符
      const separatorX = padding + frontBalls * (ballSize + ballGap) - ballGap / 2;
      ctx.fillStyle = separatorColor;
      ctx.fillRect(separatorX, y + 8, 2, ballSize - 16);

      // 后区球
      ticket.back.forEach((num, i) => {
        const x = separatorX + separatorWidth + i * (ballSize + ballGap) + ballSize / 2;
        const ballY = y + ballSize / 2;
        drawBall(x, ballY, num, false);
      });

      ctx.fillStyle = indexColor;
      ctx.font = "14px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`${ticketIdx + 1}`, 8, y + ballSize / 2 + 4);

      currentY += ballSize + rowGap;
    }
  });

  const link = document.createElement("a");
  link.download = `${type}-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
};

interface LotteryTicket {
  front: string[];
  back: string[];
}

/** 判断一注是否为复式：任一区选号数超过正常一注数量即为复式 */
const isCompoundTicket = (ticket: { front: string[]; back: string[] }, rule: { frontCount: number; backCount: number }): boolean =>
  ticket.front.length > rule.frontCount || ticket.back.length > rule.backCount;

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
): { nums: string[]; error?: string } => {
  const tokens = str
    .split(/[\s,，、;；]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const nums: string[] = [];
  for (const tok of tokens) {
    const n = parseInt(tok, 10);
    if (Number.isNaN(n) || n < 1 || n > max) {
      return { nums: [], error: `${label}号码 "${tok}" 不合法（应在 1-${max} 之间）` };
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
const parseTicketsFromText = (text: string, rule: { frontCount: number; frontMax: number; backCount: number; backMax: number; frontLabel: string; backLabel: string }): ParseResult => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const tickets: LotteryTicket[] = [];
  const errors: string[] = [];

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const plusMatch = line.match(/\+/);

    if (plusMatch) {
      const [frontPart, backPart] = line.split("+");
      const frontRes = normalizeNumberGroup(frontPart, rule.frontLabel, rule.frontMax);
      if (frontRes.error) {
        errors.push(`第${lineNo}行: ${frontRes.error}`);
        return;
      }
      const backRes = normalizeNumberGroup(backPart, rule.backLabel, rule.backMax);
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
      const frontRes = normalizeNumberGroup(frontTokens.join(" "), rule.frontLabel, rule.frontMax);
      if (frontRes.error) {
        errors.push(`第${lineNo}行: ${frontRes.error}`);
        return;
      }
      const backRes = normalizeNumberGroup(backTokens.join(" "), rule.backLabel, rule.backMax);
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

  const [selectedRange, setSelectedRange] = useState<RangeOption>(30);
  const [pickCollapsed, setPickCollapsed] = useState(false);
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
  const state = useLotteryStore((s) => s.states[type]);
  const fetchRemoteData = useLotteryStore((s) => s.fetchRemoteData);
  const uploadData = useLotteryStore((s) => s.uploadData);
  const data = state.data;
  const loading = state.loading;
  const error = state.error;
  const source = state.source;

  const isTicketComplete = (ticket: LotteryTicket): boolean => {
    return ticket.front.length >= rule.frontCount && ticket.back.length >= rule.backCount;
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

    // 用 Set 加速命中判断（复式选号池可能较大，且查询期数可能为"所有"）
    const frontSet = new Set(ticket.front);
    const backSet = new Set(ticket.back);

    const results = filteredData.map((item) => {
      // 复式一整注直接匹配：命中数 = 选号池 ∩ 开奖号码
      // 对单式即为该注命中数；对复式即为该期能达到的最高命中数（决定最高奖项）
      const frontMatch = item.front_numbers.filter(n => frontSet.has(n)).length;
      const backMatch = item.back_numbers.filter(n => backSet.has(n)).length;
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

  // 复式不再展开为所有组合，直接以一整注匹配历史，避免注数过多导致卡顿
  const totalMatches = customTickets.length > 0
    ? customTickets.map(ticket => calculateMatches(ticket))
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
    setCustomTickets([...customTickets, { front: [], back: [] }]);
  };

  const handleClearAll = () => {
    setCustomTickets([{ front: [], back: [] }]);
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
        const maxCount = numType === "front" ? rule.frontMax : rule.backMax;
        if (arr.length >= maxCount) return ticket;
        return { ...ticket, [numType]: [...arr, number].sort((a, b) => Number(a) - Number(b)) };
      }
    }));
  };

  const handleGenerateTicket = (ticketIndex: number) => {
    const newTickets = generateTickets(type, 1);
    setCustomTickets(customTickets.map((ticket, idx) => {
      if (idx !== ticketIndex) return ticket;
      return { ...newTickets[0] };
    }));
  };

  /** 按套餐票生成：仅大乐透，按选定价位套餐生成全部单式+复式组合，替换当前选号 */
  const handleGeneratePackage = (pkg: DltPackage) => {
    const newTickets: LotteryTicket[] = [];
    pkg.parts.forEach((part) => {
      for (let i = 0; i < part.count; i++) {
        const t = generateTicketWithCounts(type, part.front, part.back);
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
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 sm:px-6">
          <div>
            <h1 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {rule.name}对比分析
            </h1>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">选号与历史数据匹配</p>
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
                  setCustomTickets([{ front: [], back: [] }]);
                  navigate(`/match?type=dlt`);
                }}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  type === "dlt" ? "bg-crimson text-white" : "bg-ink-900 text-zinc-400 hover:bg-ink-800 dark:text-zinc-300"
                )}
              >
                大乐透
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomTickets([{ front: [], back: [] }]);
                  navigate(`/match?type=ssq`);
                }}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  type === "ssq" ? "bg-crimson text-white" : "bg-ink-900 text-zinc-400 hover:bg-ink-800 dark:text-zinc-300"
                )}
              >
                双色球
              </button>
            </div>
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
                              placeholder={`每行一注，支持以下格式：\n04 06 07 33 34 + 05 08\n04,06,07,33,34,05,08\n\n个位号码可不补零（如 4 6 7 33 34 + 5 8）`}
                              rows={6}
                              className="w-full resize-y rounded-lg border border-ink-600 bg-ink-950/60 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo focus:outline-none focus:ring-1 focus:ring-indigo"
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
                                {rule.frontCount}个{rule.frontLabel} + {rule.backCount}个{rule.backLabel} 为一注
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
                              <div>· 用 <span className="font-mono text-zinc-300">+</span> 分隔前后区，支持复式（如 5+3）</div>
                              <div>· 无 <span className="font-mono text-zinc-300">+</span> 时按前{rule.frontCount}个为{rule.frontLabel}、其余为{rule.backLabel}自动拆分（仅单式）</div>
                              <div>· 分隔符支持空格、逗号、顿号；号码范围 {rule.frontLabel} 1-{rule.frontMax}，{rule.backLabel} 1-{rule.backMax}</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {type === "dlt" && (
                        <div className="rounded-xl border border-ink-700/60 bg-ink-900/30 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 text-gold" />
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">按套餐票生成</span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">点击生成对应价位组合（替换当前选号）</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {DLT_PACKAGES.map((pkg) => (
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
                                请选择至少{rule.frontCount}个{rule.frontLabel}和至少{rule.backCount}个{rule.backLabel}
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
                                className="btn btn-sm text-zinc-500 hover:text-crimson dark:text-zinc-400"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mb-3">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                              {rule.frontLabel} ({ticket.front.length}/{rule.frontMax}，最少{rule.frontCount})
                            </span>
                          </div>
                          <div className={cn("grid gap-1", PICK_GRID_COLS[type].front)}>
                            {Array.from({ length: rule.frontMax }, (_, i) => String(i + 1).padStart(2, "0")).map((num) => (
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

                        <div>
                          <div className="mb-2 flex items-center gap-2">
                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                              {rule.backLabel} ({ticket.back.length}/{rule.backMax}，最少{rule.backCount})
                            </span>
                          </div>
                          <div className={cn("grid gap-1", PICK_GRID_COLS[type].back)}>
                            {Array.from({ length: rule.backMax }, (_, i) => String(i + 1).padStart(2, "0")).map((num) => (
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
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="btn btn-sm text-zinc-500 hover:text-crimson dark:text-zinc-400"
                    >
                      <Minus className="h-3 w-3" />
                      清空
                    </button>
                    {customTickets.some(t => t.front.length > 0 || t.back.length > 0) && (
                      <button
                        type="button"
                        onClick={() => exportAsImage(customTickets, type, rule)}
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
                    选完 {rule.frontCount} 个{rule.frontLabel}和 {rule.backCount} 个{rule.backLabel}后自动开始对比
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
                    const matchResult = calculateMatches(ticket);
                    if (matchResult.matches.length === 0) return null;

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
                            <span className="mx-1 h-3 w-px bg-ink-600" />
                            {ticket.back.map((n, i) => (
                              <LotteryBall key={`b-${i}`} number={n} variant="back" size="sm" />
                            ))}
                          </div>
                        </button>

                        {!isMatchCollapsed && (
                          <div className="divide-y divide-ink-700/60">
                          {matchResult.matches.slice(0, 30).map((m, i) => {
                            const prize = getPrizeLevel(m.frontMatch, m.backMatch);
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
                                        前{m.frontMatch}
                                      </span>
                                      <span className={cn("rounded-md px-2 py-0.5 text-xs",
                                        m.backMatch === rule.backCount ? "bg-indigo/20 text-indigo" : "bg-ink-800 text-zinc-500 dark:text-zinc-400")}>
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
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {item.front_numbers.map((n, ni) => (
                                    <LotteryBall
                                      key={`fn-${ni}`}
                                      number={n}
                                      variant="front"
                                      size="sm"
                                      highlight={ticket.front.includes(n)}
                                    />
                                  ))}
                                  <span className="mx-2 h-3 w-px bg-ink-600" />
                                  {item.back_numbers.map((n, ni) => (
                                    <LotteryBall
                                      key={`bn-${ni}`}
                                      number={n}
                                      variant="back"
                                      size="sm"
                                      highlight={ticket.back.includes(n)}
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