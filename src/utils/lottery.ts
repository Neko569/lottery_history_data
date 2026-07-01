import type { LotteryRule, RandomTicket, PrizeTier, LotteryItem } from "@/types/lottery";

// ──────────────────────────────────────────────
// 彩种注册表（单一数据源）
// 新增彩种只需在此追加一条配置，无需改动其它文件。
// 下方 LOTTERY_RULES / PRIZE_TABLE / REMOTE_JSON_URLS / JSDELIVR_JSON_URLS
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
  blue: { text: "text-blue-600", border: "border-blue-400/40", text400: "text-blue-400", text400Alt: "text-red-400" },
  emerald: { text: "text-emerald-600", border: "border-emerald-400/40", text400: "text-emerald-400", text400Alt: "text-orange-400" },
  violet: { text: "text-violet-600", border: "border-violet-400/40", text400: "text-violet-400", text400Alt: "text-amber-400" },
  orange: { text: "text-orange-600", border: "border-orange-400/40", text400: "text-orange-400", text400Alt: "text-teal-400" },
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
  /** 远程 JSON 数据地址（GitHub raw） */
  remoteJsonUrl: string;
  /** 备用 JSON 数据地址（jsDelivr 镜像 GitHub） */
  jsdelivrJsonUrl: string;
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
  /** 彩种大类：体育彩票 / 福利彩票 */
  category: "sports" | "welfare";
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
  jsdelivrJsonUrl: "https://cdn.jsdelivr.net/gh/Neko569/get_lottery_data@main/data/dlt_history.json",
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
  category: "sports",
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
  jsdelivrJsonUrl: "https://cdn.jsdelivr.net/gh/Neko569/get_lottery_data@main/data/ssq_history.json",
  frontBallColors: { from: "#ef4444", to: "#b91c1c" },
  backBallColors: { from: "#3b82f6", to: "#1d4ed8" },
  logo: { topText: "中国", gradientFrom: "#E63946", gradientTo: "#9B2335", rangeColor: "#3A86FF" },
  prizeColors: PRIZE_LEVEL_COLORS,
  ruleNote: "2026 新规：当奖池高于 15 亿元（含）执行特别规定期间，固定奖级增设「福运奖」（命中 3 个红球，即 3+0，单注 5 元），直至奖池资金低于 3 亿元时停止。",
  pickGridCols: { front: "grid-cols-7 sm:grid-cols-11", back: "grid-cols-8" },
  category: "welfare",
};

/**
 * 彩种注册表：所有彩种相关配置的唯一数据源
 *  - 新增彩种：声明一个 `xxxConfig: LotteryConfig` 并加入此对象即可
 */

/** 七星彩配置（体彩，前 6 位各 0-9 + 后区 1 位 0-14，按位匹配） */
const qxcConfig: LotteryConfig = {
  rule: {
    frontCount: 6,
    frontMax: 9,
    frontMin: 0,
    backCount: 1,
    backMax: 14,
    backMin: 0,
    name: "七星彩",
    frontLabel: "前区",
    backLabel: "后区",
    accent: "crimson",
    positionBased: true,
  },
  prizeTable: [
    { level: "一等奖", conditions: [{ front: 6, back: 1 }], bonus: "浮动（封顶 500 万）", kind: "floating", note: "7 位号码全部对位相同" },
    { level: "二等奖", conditions: [{ front: 6, back: 0 }], bonus: "浮动（封顶 500 万）", kind: "floating", note: "前 6 位全部对位相同" },
    { level: "三等奖", conditions: [{ front: 5, back: 1 }], bonus: "3,000 元", kind: "fixed", note: "前区任意 5 位对位 + 后区对位" },
    { level: "四等奖", conditions: [{ front: 5, back: 0 }, { front: 4, back: 1 }], bonus: "500 元", kind: "fixed" },
    { level: "五等奖", conditions: [{ front: 4, back: 0 }, { front: 3, back: 1 }], bonus: "30 元", kind: "fixed" },
    { level: "六等奖", conditions: [{ front: 3, back: 0 }, { front: 2, back: 1 }, { front: 1, back: 1 }, { front: 0, back: 1 }], bonus: "5 元", kind: "fixed" },
  ],
  remoteJsonUrl: "https://raw.githubusercontent.com/Neko569/get_lottery_data/main/data/qxc_history.json",
  jsdelivrJsonUrl: "https://cdn.jsdelivr.net/gh/Neko569/get_lottery_data@main/data/qxc_history.json",
  frontBallColors: { from: "#ef4444", to: "#b91c1c" },
  backBallColors: { from: "#818cf8", to: "#4f46e5" },
  logo: { topText: "体彩", gradientFrom: "#E63946", gradientTo: "#9B2335", rangeColor: "#FFD700" },
  prizeColors: PRIZE_LEVEL_COLORS,
  ruleNote: "七星彩前 6 位每位 0-9，后区 1 位 0-14，按位置对位中奖；不兼中兼得，每注只取最高奖级。奖池超 3 亿时一、二等奖比例倒置（一 10% / 二 90%）。",
  pickGridCols: { front: "grid-cols-5 sm:grid-cols-10", back: "grid-cols-8" },
  category: "sports",
};

/** 排列三配置（体彩，3 位数字 0-9，按位匹配）
 *  仅保留直选玩法（每位数字与位置均需对位相同）；组三/组六为组选模式，
 *  本应用选号页只支持直选，故不纳入奖级表。 */
const plsConfig: LotteryConfig = {
  rule: {
    frontCount: 3,
    frontMax: 9,
    frontMin: 0,
    backCount: 0,
    backMax: 0,
    name: "排列三",
    frontLabel: "号码",
    backLabel: "后区",
    accent: "blue",
    positionBased: true,
  },
  prizeTable: [
    { level: "一等奖", conditions: [{ front: 3, back: 0 }], bonus: "1,040 元（直选）", kind: "fixed" },
  ],
  remoteJsonUrl: "https://raw.githubusercontent.com/Neko569/get_lottery_data/main/data/pls_history.json",
  jsdelivrJsonUrl: "https://cdn.jsdelivr.net/gh/Neko569/get_lottery_data@main/data/pls_history.json",
  frontBallColors: { from: "#3b82f6", to: "#1d4ed8" },
  backBallColors: { from: "#818cf8", to: "#4f46e5" },
  logo: { topText: "体彩", gradientFrom: "#2563EB", gradientTo: "#1D4ED8", rangeColor: "#FFD700" },
  prizeColors: PRIZE_LEVEL_COLORS,
  ruleNote: "排列三共 3 位号码，每位 0-9，直选 3 位全部对位命中即 1,040 元。组三/组六为组选玩法，本应用仅支持直选，未纳入奖级表。",
  pickGridCols: { front: "grid-cols-5 sm:grid-cols-10", back: "grid-cols-6" },
  category: "sports",
};

/** 排列五配置（体彩，5 位数字 0-9，按位匹配） */
const plwConfig: LotteryConfig = {
  rule: {
    frontCount: 5,
    frontMax: 9,
    frontMin: 0,
    backCount: 0,
    backMax: 0,
    name: "排列五",
    frontLabel: "号码",
    backLabel: "后区",
    accent: "emerald",
    positionBased: true,
  },
  prizeTable: [
    { level: "一等奖", conditions: [{ front: 5, back: 0 }], bonus: "10,000 元", kind: "fixed" },
  ],
  remoteJsonUrl: "https://raw.githubusercontent.com/Neko569/get_lottery_data/main/data/plw_history.json",
  jsdelivrJsonUrl: "https://cdn.jsdelivr.net/gh/Neko569/get_lottery_data@main/data/plw_history.json",
  frontBallColors: { from: "#059669", to: "#047857" },
  backBallColors: { from: "#818cf8", to: "#4f46e5" },
  logo: { topText: "体彩", gradientFrom: "#059669", gradientTo: "#047857", rangeColor: "#FFD700" },
  prizeColors: PRIZE_LEVEL_COLORS,
  ruleNote: "排列五共 5 位号码，每位 0-9，全部命中即中 10,000 元。",
  pickGridCols: { front: "grid-cols-5 sm:grid-cols-10", back: "grid-cols-6" },
  category: "sports",
};

/** 福彩3D配置（福彩，3 位数字 0-9，按位匹配）
 *  仅保留直选玩法（每位数字与位置均需对位相同）；组三/组六为组选模式，
 *  本应用选号页只支持直选，故不纳入奖级表。 */
const fc3dConfig: LotteryConfig = {
  rule: {
    frontCount: 3,
    frontMax: 9,
    frontMin: 0,
    backCount: 0,
    backMax: 0,
    name: "福彩3D",
    frontLabel: "号码",
    backLabel: "后区",
    accent: "crimson",
    positionBased: true,
  },
  prizeTable: [
    { level: "一等奖", conditions: [{ front: 3, back: 0 }], bonus: "1,040 元（直选）", kind: "fixed" },
  ],
  remoteJsonUrl: "https://raw.githubusercontent.com/Neko569/get_lottery_data/main/data/fc3d_history.json",
  jsdelivrJsonUrl: "https://cdn.jsdelivr.net/gh/Neko569/get_lottery_data@main/data/fc3d_history.json",
  frontBallColors: { from: "#ef4444", to: "#b91c1c" },
  backBallColors: { from: "#818cf8", to: "#4f46e5" },
  logo: { topText: "", gradientFrom: "#E63946", gradientTo: "#9B2335", rangeColor: "#3A86FF" },
  prizeColors: PRIZE_LEVEL_COLORS,
  ruleNote: "福彩3D共 3 位号码，每位 0-9，直选 3 位全部对位命中即 1,040 元。组三/组六为组选玩法，本应用仅支持直选，未纳入奖级表。",
  pickGridCols: { front: "grid-cols-5 sm:grid-cols-10", back: "grid-cols-6" },
  category: "welfare",
};

/** 七乐彩配置（福彩，玩家选 7 个基本号 1-30，开奖 7 基本号 + 1 特别号）
 *  特别号由开奖给出，玩家不单独选；命中=玩家任一基本号==开奖特别号（backMatchFromFront）。
 *  奖级表依据 2026 官方规则：一/二/三等奖浮动，四~七等奖固定。 */
const qlcConfig: LotteryConfig = {
  rule: {
    frontCount: 7,
    frontMax: 30,
    backCount: 0,
    backDrawCount: 1,
    backMax: 30,
    name: "七乐彩",
    frontLabel: "基本号",
    backLabel: "特别号",
    accent: "violet",
    backMatchFromFront: true,
  },
  prizeTable: [
    { level: "一等奖", conditions: [{ front: 7, back: 0 }], bonus: "浮动（封顶 500 万）", kind: "floating", note: "7 个基本号全中" },
    { level: "二等奖", conditions: [{ front: 6, back: 1 }], bonus: "浮动", kind: "floating", note: "6 基本号 + 特别号" },
    { level: "三等奖", conditions: [{ front: 6, back: 0 }], bonus: "浮动", kind: "floating", note: "6 基本号" },
    { level: "四等奖", conditions: [{ front: 5, back: 1 }], bonus: "200 元", kind: "fixed", note: "5 基本号 + 特别号" },
    { level: "五等奖", conditions: [{ front: 5, back: 0 }], bonus: "50 元", kind: "fixed", note: "5 基本号" },
    { level: "六等奖", conditions: [{ front: 4, back: 1 }], bonus: "10 元", kind: "fixed", note: "4 基本号 + 特别号" },
    { level: "七等奖", conditions: [{ front: 4, back: 0 }], bonus: "5 元", kind: "fixed", note: "4 基本号" },
  ],
  remoteJsonUrl: "https://raw.githubusercontent.com/Neko569/get_lottery_data/main/data/qlc_history.json",
  jsdelivrJsonUrl: "https://cdn.jsdelivr.net/gh/Neko569/get_lottery_data@main/data/qlc_history.json",
  frontBallColors: { from: "#ef4444", to: "#b91c1c" },
  backBallColors: { from: "#7c3aed", to: "#5b21b6" },
  logo: { topText: "福彩", gradientFrom: "#7C3AED", gradientTo: "#5B21B6", rangeColor: "#FFD700" },
  prizeColors: PRIZE_LEVEL_COLORS,
  ruleNote: "七乐彩：从 1-30 选 7 个基本号，每期开 7 基本号 + 1 特别号；特别号命中=玩家任一号码==开奖特别号。一/二/三等奖为浮动奖，四~七等奖为固定奖。",
  pickGridCols: { front: "grid-cols-6 sm:grid-cols-10", back: "grid-cols-6 sm:grid-cols-10" },
  category: "welfare",
};

/** 快乐八配置（福彩，玩家选 10 个号码 1-80，开奖 20 个） */
const kl8Config: LotteryConfig = {
  rule: {
    frontCount: 10,
    frontMax: 80,
    frontDrawCount: 20,
    backCount: 0,
    backMax: 0,
    name: "快乐八",
    frontLabel: "号码",
    backLabel: "后区",
    accent: "orange",
  },
  prizeTable: [
    { level: "一等奖", conditions: [{ front: 10, back: 0 }], bonus: "5,000,000 元（封顶）", kind: "floating", note: "选十中十，浮动奖" },
    { level: "二等奖", conditions: [{ front: 9, back: 0 }], bonus: "8,000 元", kind: "fixed", note: "选十中九" },
    { level: "三等奖", conditions: [{ front: 8, back: 0 }], bonus: "720 元", kind: "fixed", note: "选十中八" },
    { level: "四等奖", conditions: [{ front: 7, back: 0 }], bonus: "80 元", kind: "fixed", note: "选十中七" },
    { level: "五等奖", conditions: [{ front: 6, back: 0 }], bonus: "5 元", kind: "fixed", note: "选十中六" },
    { level: "六等奖", conditions: [{ front: 5, back: 0 }], bonus: "3 元", kind: "fixed", note: "选十中五" },
    { level: "七等奖", conditions: [{ front: 0, back: 0 }], bonus: "2 元", kind: "fixed", note: "选十全不中" },
  ],
  remoteJsonUrl: "https://raw.githubusercontent.com/Neko569/get_lottery_data/main/data/kl8_history.json",
  jsdelivrJsonUrl: "https://cdn.jsdelivr.net/gh/Neko569/get_lottery_data@main/data/kl8_history.json",
  frontBallColors: { from: "#ea580c", to: "#c2410c" },
  backBallColors: { from: "#818cf8", to: "#4f46e5" },
  logo: { topText: "福彩", gradientFrom: "#EA580C", gradientTo: "#C2410C", rangeColor: "#3A86FF" },
  prizeColors: PRIZE_LEVEL_COLORS,
  ruleNote: "快乐八选十玩法：每期开奖 20 个号码（1-80），玩家选 10 个，按命中数对应奖级；全不中（0 中）亦中 2 元。共 7 个奖级。",
  pickGridCols: { front: "grid-cols-8 sm:grid-cols-10 lg:grid-cols-16", back: "grid-cols-6" },
  category: "welfare",
};

export const LOTTERIES = {
  dlt: dltConfig,
  ssq: ssqConfig,
  qxc: qxcConfig,
  pls: plsConfig,
  plw: plwConfig,
  fc3d: fc3dConfig,
  qlc: qlcConfig,
  kl8: kl8Config,
};

/** 全部彩种 key（顺序与注册表一致） */
export const LOTTERY_TYPES = Object.keys(LOTTERIES) as LotteryType[];

/**
 * 彩种类型：从注册表 key 派生。
 * 新增彩种无需修改此类型，自动包含新 key。
 */
export type LotteryType = keyof typeof LOTTERIES;

/** 彩种大类 */
export type LotteryCategory = "sports" | "welfare";

/** 大分类元数据：名称 + 包含的彩种 key（由注册表派生顺序） */
export const LOTTERY_CATEGORIES: { key: LotteryCategory; name: string; lotteries: LotteryType[] }[] = [
  { key: "sports", name: "体育彩票", lotteries: LOTTERY_TYPES.filter((t) => LOTTERIES[t].category === "sports") },
  { key: "welfare", name: "福利彩票", lotteries: LOTTERY_TYPES.filter((t) => LOTTERIES[t].category === "welfare") },
];

/** 根据彩种 key 查询其大类 */
export function getCategoryOf(type: LotteryType): LotteryCategory {
  return LOTTERIES[type].category;
}

/** 当前彩种的奖级名称列表（按奖级高低排序，一等奖在最前） */
export function getPrizeLevels(type: LotteryType): string[] {
  return LOTTERIES[type].prizeTable.map((t) => t.level);
}

/** 根据命中数判定奖级；未中奖返回 null */
export function getPrizeTierByMatch(type: LotteryType, frontMatch: number, backMatch: number): PrizeTier | null {
  return LOTTERIES[type].prizeTable.find((t) => t.conditions.some((c) => c.front === frontMatch && c.back === backMatch)) ?? null;
}

/**
 * 计算一注彩票与一期开奖号码的命中数。
 *  - 普通彩种（大乐透/双色球/七乐彩/快乐八）：集合交集命中数
 *  - 按位彩种（排列三/排列五/七星彩/福彩3D）：每位数字与位置均需对位相同才算命中
 *    ticket.front[i] 为玩家选的第 i 位数字（顺序即位置，不可排序）
 */
export function matchTicket(
  type: LotteryType,
  ticket: { front: string[]; back: string[] },
  draw: LotteryItem,
): { frontMatch: number; backMatch: number } {
  const rule = LOTTERY_RULES[type];
  if (rule.positionBased) {
    let frontMatch = 0;
    for (let i = 0; i < rule.frontCount; i++) {
      if (ticket.front[i] != null && ticket.front[i] === draw.front_numbers[i]) frontMatch++;
    }
    const backMatch = rule.backCount > 0
      ? (ticket.back[0] != null && ticket.back[0] === draw.back_numbers[0] ? 1 : 0)
      : 0;
    return { frontMatch, backMatch };
  }
  const fSet = new Set(ticket.front);
  // 七乐彩等特别号从前区推导：玩家不选后区，特别号命中=玩家任一号码==开奖特别号
  if (rule.backMatchFromFront) {
    return {
      frontMatch: draw.front_numbers.filter((n) => fSet.has(n)).length,
      backMatch: draw.back_numbers.filter((n) => fSet.has(n)).length > 0 ? 1 : 0,
    };
  }
  const bSet = new Set(ticket.back);
  return {
    frontMatch: draw.front_numbers.filter((n) => fSet.has(n)).length,
    backMatch: draw.back_numbers.filter((n) => bSet.has(n)).length,
  };
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

/** 备用远程数据地址（jsDelivr JSON，GitHub JSON 获取失败时的 fallback） — 由注册表派生 */
export const JSDELIVR_JSON_URLS: Record<LotteryType, string> = Object.fromEntries(
  LOTTERY_TYPES.map((k) => [k, LOTTERIES[k].jsdelivrJsonUrl]),
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

/** 在 [min, max] 范围内随机抽取 count 个不重复号码（升序、补零）
 *  防御：count 超过可选范围时 clamp，count <= 0 时返回空数组，避免无限循环 */
export function pickNumbers(count: number, max: number, min: number = 1): string[] {
  const range = max - min + 1;
  const safeCount = Math.min(Math.max(count, 0), range);
  if (safeCount === 0) return [];
  const pool = new Set<number>();
  while (pool.size < safeCount) {
    pool.add(Math.floor(Math.random() * range) + min);
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

/** 在 [min, max] 范围内随机生成 1 个号码（补零，可重复，用于按位彩种） */
function pickOne(max: number, min: number = 1): string {
  const range = max - min + 1;
  return pad2(Math.floor(Math.random() * range) + min);
}

/** 生成一注符合规则的随机号码 */
export function generateTicket(type: LotteryType): RandomTicket {
  const rule = LOTTERY_RULES[type];
  // 按位彩种：每位独立取 1 个数字（允许重复，顺序即位置，不可排序）
  if (rule.positionBased) {
    const frontMin = rule.frontMin ?? 1;
    const backMin = rule.backMin ?? 1;
    return {
      front: Array.from({ length: rule.frontCount }, () => pickOne(rule.frontMax, frontMin)),
      back: rule.backCount > 0
        ? Array.from({ length: rule.backCount }, () => pickOne(rule.backMax, backMin))
        : [],
    };
  }
  return {
    front: pickNumbers(rule.frontCount, rule.frontMax, rule.frontMin ?? 1),
    back: pickNumbers(rule.backCount, rule.backMax, rule.backMin ?? 1),
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
    front: pickNumbers(frontCount, rule.frontMax, rule.frontMin ?? 1),
    back: pickNumbers(backCount, rule.backMax, rule.backMin ?? 1),
  };
}

/** 每页条数可选项 */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/** 默认每页条数 */
export const DEFAULT_PAGE_SIZE = 25;

/** 走势图可选显示期数 */
export const TREND_PERIOD_OPTIONS = [20, 30, 50, 100];
