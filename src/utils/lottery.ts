import type { LotteryRule, RandomTicket, PrizeTier } from "@/types/lottery";

// ──────────────────────────────────────────────
// 彩种注册表（单一数据源）
// 新增彩种只需在此追加一条配置，无需改动其它文件。
// 下方 LOTTERY_RULES / PRIZE_TABLE / REMOTE_JSON_URLS / GITEE_CSV_URLS
// 均由本注册表派生，保持向后兼容。
// ──────────────────────────────────────────────

/** 单个号码球渐变配色（用于 canvas 导出图片） */
export interface BallColors {
  /** 渐变起始色 */
  from: string;
  /** 渐变结束色 */
  to: string;
}

/** 奖级配色（tailwind class 片段，用于奖级徽章/标签） */
export interface PrizeColor {
  bg: string;
  text: string;
  border: string;
}

/** 套餐票组合部件：单式或复式 */
export interface LotteryPackagePart {
  /** "single" 单式 / "compound" 复式 */
  kind: "single" | "compound";
  /** 前区个数 */
  front: number;
  /** 后区个数 */
  back: number;
  /** 生成几注（单式为注数，复式为 1 组） */
  count: number;
}

/** 套餐票（固定面值组合，如大乐透 18/28/58/88 元套餐） */
export interface LotteryPackage {
  id: string;
  name: string;
  price: number;
  parts: LotteryPackagePart[];
}

/**
 * 奖级配色共享调色板：按中文奖级名查表。
 * 一等奖=金色为体彩/福彩通用视觉约定，各彩种共享；新彩种奖级名若不同可在其 prizeColors 自行补充。
 * 保留八等奖/九等奖以备九级制彩种（如七乐彩）使用。
 */
export const PRIZE_LEVEL_COLORS: Record<string, PrizeColor> = {
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

/**
 * 彩种主题色样式映射（tailwind class 片段）。
 * 新增彩种若需新主题色，只需在此追加一条（key 即 LotteryRule.accent 取值），
 * `Accent` 类型会自动派生，无需改 types/lottery.ts 的联合类型。
 *  - text / border：主色文本与边框（用于面板头）
 *  - text400：主色 400 色阶（用于列表前区标签）
 *  - text400Alt：对比色 400 色阶（用于列表后区标签，与主色互补）
 */
export const ACCENT_STYLES = {
  crimson: { text: "text-crimson", border: "border-crimson/40", text400: "text-crimson-400", text400Alt: "text-indigo-400" },
  indigo: { text: "text-indigo", border: "border-indigo/40", text400: "text-indigo-400", text400Alt: "text-crimson-400" },
};

/** 主题色键：从 ACCENT_STYLES 派生，新增主题色只需扩映射表 */
export type Accent = keyof typeof ACCENT_STYLES;

/** 彩种 Logo 配置（驱动 LotteryLogo 统一渲染） */
export interface LotteryLogoConfig {
  /** 顶部小字（如「超级」「中国」） */
  topText: string;
  /** 圆形背景渐变起始色 */
  gradientFrom: string;
  /** 圆形背景渐变结束色 */
  gradientTo: string;
  /** 底部号码范围文案颜色 */
  rangeColor: string;
}

/** 彩种完整配置（注册表单条目） */
export interface LotteryConfig {
  /** 彩种规则 */
  rule: LotteryRule;
  /** 奖级表 */
  prizeTable: PrizeTier[];
  /** 远程 JSON 数据地址（GitHub） */
  remoteJsonUrl: string;
  /** Gitee 备用 CSV 数据地址 */
  giteeCsvUrl: string;
  /** 前区球渐变色（canvas 导出用） */
  frontBallColors: BallColors;
  /** 后区球渐变色（canvas 导出用） */
  backBallColors: BallColors;
  /** Logo 配置（LotteryLogo 渲染用） */
  logo: LotteryLogoConfig;
  /** 奖级配色（按奖级名查表，通常引用 PRIZE_LEVEL_COLORS） */
  prizeColors: Record<string, PrizeColor>;
  /** 套餐票（可选，无则 MatchResultPage 不渲染套餐区） */
  packages?: LotteryPackage[];
  /** 奖级表底部新规备注（可选，无则不渲染备注条） */
  ruleNote?: string;
  /** 选号网格列数（tailwind grid-cols 类，前/后区各一条） */
  pickGridCols: { front: string; back: string };
}

// 各彩种配置：先以 LotteryConfig 类型注解声明（确保 accent 字面量窄化、数组可变），
// 再聚合为 LOTTERIES，使 keyof typeof LOTTERIES 自动派生为 "dlt" | "ssq"。
// 新增彩种：声明一个 xxxConfig 并加入下方 LOTTERIES 即可。

/** 大乐透配置 */
const dltConfig: LotteryConfig = {
  rule: {
    frontCount: 5,
    frontMax: 35,
    backCount: 2,
    backMax: 12,
    name: "大乐透",
    frontLabel: "前区",
    backLabel: "后区",
    accent: "crimson",
  },
  prizeTable: [
    { level: "一等奖", conditions: [{ front: 5, back: 2 }], bonus: "浮动（单注封顶 500 万）", kind: "floating", note: "单期总额封顶 1 亿" },
    { level: "二等奖", conditions: [{ front: 5, back: 1 }], bonus: "浮动（单注封顶 500 万）", kind: "floating", note: "单期总额封顶 1 亿" },
    { level: "三等奖", conditions: [{ front: 5, back: 0 }, { front: 4, back: 2 }], bonus: "5,000 元（奖池≥8亿时 6,666 元）", kind: "fixed" },
    { level: "四等奖", conditions: [{ front: 4, back: 1 }], bonus: "300 元（奖池≥8亿时 380 元）", kind: "fixed" },
    { level: "五等奖", conditions: [{ front: 4, back: 0 }, { front: 3, back: 2 }], bonus: "150 元（奖池≥8亿时 200 元）", kind: "fixed" },
    { level: "六等奖", conditions: [{ front: 3, back: 1 }, { front: 2, back: 2 }], bonus: "15 元（奖池≥8亿时 18 元）", kind: "fixed" },
    { level: "七等奖", conditions: [{ front: 3, back: 0 }, { front: 2, back: 1 }, { front: 1, back: 2 }, { front: 0, back: 2 }], bonus: "5 元（奖池≥8亿时 7 元）", kind: "fixed" },
  ],
  remoteJsonUrl: "https://raw.githubusercontent.com/Neko569/get_lottery_data/main/data/dlt_history.json",
  giteeCsvUrl: "https://raw.giteeusercontent.com/retro569/get_lottery_data/raw/main/data/dlt_history.csv",
  frontBallColors: { from: "#ef4444", to: "#b91c1c" },
  backBallColors: { from: "#818cf8", to: "#4f46e5" },
  logo: { topText: "超级", gradientFrom: "#E63946", gradientTo: "#9B2335", rangeColor: "#FFD700" },
  prizeColors: PRIZE_LEVEL_COLORS,
  packages: [
    { id: "p18", name: "崭露头角", price: 18, parts: [
      { kind: "single", front: 5, back: 2, count: 6 },
      { kind: "compound", front: 5, back: 3, count: 1 },
    ] },
    { id: "p28", name: "鱼跃龙门", price: 28, parts: [
      { kind: "single", front: 5, back: 2, count: 8 },
      { kind: "compound", front: 6, back: 2, count: 1 },
    ] },
    { id: "p58", name: "马到功成", price: 58, parts: [
      { kind: "single", front: 5, back: 2, count: 8 },
      { kind: "compound", front: 7, back: 2, count: 1 },
    ] },
    { id: "p88", name: "高飞远翔", price: 88, parts: [
      { kind: "single", front: 5, back: 2, count: 5 },
      { kind: "compound", front: 6, back: 3, count: 1 },
      { kind: "compound", front: 7, back: 2, count: 1 },
    ] },
  ],
  ruleNote: "新规：当奖池资金高于 8 亿元（含）时，三~七等奖按更高固定金额派奖（详见各奖级奖金列）。",
  pickGridCols: { front: "grid-cols-7 lg:grid-cols-11", back: "grid-cols-6" },
};

/** 双色球配置 */
const ssqConfig: LotteryConfig = {
  rule: {
    frontCount: 6,
    frontMax: 33,
    backCount: 1,
    backMax: 16,
    name: "双色球",
    frontLabel: "红球",
    backLabel: "蓝球",
    accent: "indigo",
  },
  prizeTable: [
    { level: "一等奖", conditions: [{ front: 6, back: 1 }], bonus: "浮动（封顶 500 万）", kind: "floating", note: "2026 新规：单期总额封顶 1 亿" },
    { level: "二等奖", conditions: [{ front: 6, back: 0 }], bonus: "浮动（30%，封顶 500 万）", kind: "floating", note: "2026 新规：单期封顶 7000 万" },
    { level: "三等奖", conditions: [{ front: 5, back: 1 }], bonus: "3,000 元", kind: "fixed" },
    { level: "四等奖", conditions: [{ front: 5, back: 0 }, { front: 4, back: 1 }], bonus: "200 元", kind: "fixed" },
    { level: "五等奖", conditions: [{ front: 4, back: 0 }, { front: 3, back: 1 }], bonus: "10 元", kind: "fixed" },
    { level: "六等奖", conditions: [{ front: 2, back: 1 }, { front: 1, back: 1 }, { front: 0, back: 1 }], bonus: "5 元", kind: "fixed" },
  ],
  remoteJsonUrl: "https://raw.githubusercontent.com/Neko569/get_lottery_data/main/data/ssq_history.json",
  giteeCsvUrl: "https://raw.giteeusercontent.com/retro569/get_lottery_data/raw/main/data/ssq_history.csv",
  frontBallColors: { from: "#ef4444", to: "#b91c1c" },
  backBallColors: { from: "#3b82f6", to: "#1d4ed8" },
  logo: { topText: "中国", gradientFrom: "#E63946", gradientTo: "#9B2335", rangeColor: "#3A86FF" },
  prizeColors: PRIZE_LEVEL_COLORS,
  ruleNote: "2026 新规：当奖池高于 15 亿元（含）执行特别规定期间，固定奖级增设「福运奖」（命中 3 个红球，即 3+0，单注 5 元），直至奖池资金低于 3 亿元时停止。",
  pickGridCols: { front: "grid-cols-7 sm:grid-cols-11", back: "grid-cols-8" },
};

/**
 * 彩种注册表：所有彩种相关配置的唯一数据源
 *  - 新增彩种：声明一个 `xxxConfig: LotteryConfig` 并加入此对象即可
 */
export const LOTTERIES = {
  dlt: dltConfig,
  ssq: ssqConfig,
};

/** 全部彩种 key（顺序与注册表一致） */
export const LOTTERY_TYPES = Object.keys(LOTTERIES) as LotteryType[];

/**
 * 彩种类型：从注册表 key 派生。
 * 新增彩种无需修改此类型，自动包含新 key。
 */
export type LotteryType = keyof typeof LOTTERIES;

/** 当前彩种的奖级名称列表（按奖级高低排序，一等奖在最前） */
export function getPrizeLevels(type: LotteryType): string[] {
  return LOTTERIES[type].prizeTable.map((t) => t.level);
}

/** 根据命中数判定奖级；未中奖返回 null */
export function getPrizeTierByMatch(type: LotteryType, frontMatch: number, backMatch: number): PrizeTier | null {
  return LOTTERIES[type].prizeTable.find((t) => t.conditions.some((c) => c.front === frontMatch && c.back === backMatch)) ?? null;
}

// ──────────────────────────────────────────────
// 以下为向后兼容的派生导出（调用方无需改动）
// ──────────────────────────────────────────────

/** 彩种规则映射（由注册表派生） */
export const LOTTERY_RULES: Record<LotteryType, LotteryRule> = Object.fromEntries(
  LOTTERY_TYPES.map((k) => [k, LOTTERIES[k].rule]),
) as Record<LotteryType, LotteryRule>;

/**
 * 各彩种奖级表（依据官方最新规则）
 *  - 大乐透：共 7 个奖级，一/二等奖为浮动奖（单期总额封顶 1 亿），三~七等为固定奖
 *    奖池≥8亿时三~七等固定奖执行更高派奖；来源：中国体彩网《超级大乐透游戏规则》
 *  - 双色球：共 6 个奖级，一/二等奖为浮动奖，三~六等为固定奖
 *    来源：中国福彩《双色球游戏规则》第十六条；2026 新规（26014 期起）一/二等奖单期总额封顶
 */
export const PRIZE_TABLE: Record<LotteryType, PrizeTier[]> = Object.fromEntries(
  LOTTERY_TYPES.map((k) => [k, LOTTERIES[k].prizeTable]),
) as Record<LotteryType, PrizeTier[]>;

/** 远程数据地址（GitHub JSON，优先使用） — 由注册表派生 */
export const REMOTE_JSON_URLS: Record<LotteryType, string> = Object.fromEntries(
  LOTTERY_TYPES.map((k) => [k, LOTTERIES[k].remoteJsonUrl]),
) as Record<LotteryType, string>;

/** Gitee 备用远程数据地址（GitHub JSON 获取失败时的 CSV fallback） — 由注册表派生 */
export const GITEE_CSV_URLS: Record<LotteryType, string> = Object.fromEntries(
  LOTTERY_TYPES.map((k) => [k, LOTTERIES[k].giteeCsvUrl]),
) as Record<LotteryType, string>;

/** 数据源仓库地址（展示用，所有彩种共用同一仓库） */
export const DATA_REPO_URLS = {
  github: "https://github.com/Neko569/get_lottery_data/tree/main/data",
  gitee: "https://gitee.com/retro569/get_lottery_data/tree/main/data",
};

/** 将数字补零为两位字符串 */
export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** 在 [1, max] 范围内随机抽取 count 个不重复号码（升序、补零）
 *  防御：count 超过 max 时 clamp 到 max，count <= 0 时返回空数组，避免无限循环 */
export function pickNumbers(count: number, max: number): string[] {
  const safeCount = Math.min(Math.max(count, 0), max);
  if (safeCount === 0) return [];
  const pool = new Set<number>();
  while (pool.size < safeCount) {
    pool.add(Math.floor(Math.random() * max) + 1);
  }
  return Array.from(pool)
    .sort((a, b) => a - b)
    .map(pad2);
}

/** 运行时校验字符串是否为合法彩种类型（基于注册表，新增彩种自动识别） */
export function isLotteryType(value: unknown): value is LotteryType {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LOTTERIES, value);
}

/** 将任意值安全转为 LotteryType，非法值回退到 fallback（默认 dlt） */
export function toLotteryType(value: unknown, fallback: LotteryType = "dlt"): LotteryType {
  return isLotteryType(value) ? value : fallback;
}

/** 生成一注符合规则的随机号码 */
export function generateTicket(type: LotteryType): RandomTicket {
  const rule = LOTTERY_RULES[type];
  return {
    front: pickNumbers(rule.frontCount, rule.frontMax),
    back: pickNumbers(rule.backCount, rule.backMax),
  };
}

/** 生成多注随机号码 */
export function generateTickets(type: LotteryType, count: number): RandomTicket[] {
  return Array.from({ length: count }, () => generateTicket(type));
}

/** 生成一注指定前后区个数的随机号码（用于套餐票/复式） */
export function generateTicketWithCounts(type: LotteryType, frontCount: number, backCount: number): RandomTicket {
  const rule = LOTTERY_RULES[type];
  return {
    front: pickNumbers(frontCount, rule.frontMax),
    back: pickNumbers(backCount, rule.backMax),
  };
}

/** 每页条数可选项 */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/** 默认每页条数 */
export const DEFAULT_PAGE_SIZE = 25;

/** 走势图可选显示期数 */
export const TREND_PERIOD_OPTIONS = [20, 30, 50, 100];
