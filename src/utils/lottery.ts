import type { LotteryRule, LotteryType, RandomTicket, PrizeTier } from "@/types/lottery";

/** 彩种规则映射 */
export const LOTTERY_RULES: Record<LotteryType, LotteryRule> = {
  dlt: {
    frontCount: 5,
    frontMax: 35,
    backCount: 2,
    backMax: 12,
    name: "大乐透",
    frontLabel: "前区",
    backLabel: "后区",
    accent: "crimson",
  },
  ssq: {
    frontCount: 6,
    frontMax: 33,
    backCount: 1,
    backMax: 16,
    name: "双色球",
    frontLabel: "红球",
    backLabel: "蓝球",
    accent: "indigo",
  },
};

/**
 * 各彩种奖级表（依据官方最新规则）
 *  - 大乐透：共 7 个奖级，一/二等奖为浮动奖（单期总额封顶 1 亿），三~七等为固定奖
 *    奖池≥8亿时三~七等固定奖执行更高派奖；来源：中国体彩网《超级大乐透游戏规则》
 *  - 双色球：共 6 个奖级，一/二等奖为浮动奖，三~六等为固定奖
 *    来源：中国福彩《双色球游戏规则》第十六条；2026 新规（26014 期起）一/二等奖单期总额封顶
 */
export const PRIZE_TABLE: Record<LotteryType, PrizeTier[]> = {
  dlt: [
    { level: "一等奖", conditions: [{ front: 5, back: 2 }], bonus: "浮动（单注封顶 500 万）", kind: "floating", note: "单期总额封顶 1 亿" },
    { level: "二等奖", conditions: [{ front: 5, back: 1 }], bonus: "浮动（单注封顶 500 万）", kind: "floating", note: "单期总额封顶 1 亿" },
    { level: "三等奖", conditions: [{ front: 5, back: 0 }, { front: 4, back: 2 }], bonus: "5,000 元（奖池≥8亿时 6,666 元）", kind: "fixed" },
    { level: "四等奖", conditions: [{ front: 4, back: 1 }], bonus: "300 元（奖池≥8亿时 380 元）", kind: "fixed" },
    { level: "五等奖", conditions: [{ front: 4, back: 0 }, { front: 3, back: 2 }], bonus: "150 元（奖池≥8亿时 200 元）", kind: "fixed" },
    { level: "六等奖", conditions: [{ front: 3, back: 1 }, { front: 2, back: 2 }], bonus: "15 元（奖池≥8亿时 18 元）", kind: "fixed" },
    { level: "七等奖", conditions: [{ front: 3, back: 0 }, { front: 2, back: 1 }, { front: 1, back: 2 }, { front: 0, back: 2 }], bonus: "5 元（奖池≥8亿时 7 元）", kind: "fixed" },
  ],
  ssq: [
    { level: "一等奖", conditions: [{ front: 6, back: 1 }], bonus: "浮动（封顶 500 万）", kind: "floating", note: "2026 新规：单期总额封顶 1 亿" },
    { level: "二等奖", conditions: [{ front: 6, back: 0 }], bonus: "浮动（30%，封顶 500 万）", kind: "floating", note: "2026 新规：单期封顶 7000 万" },
    { level: "三等奖", conditions: [{ front: 5, back: 1 }], bonus: "3,000 元", kind: "fixed" },
    { level: "四等奖", conditions: [{ front: 5, back: 0 }, { front: 4, back: 1 }], bonus: "200 元", kind: "fixed" },
    { level: "五等奖", conditions: [{ front: 4, back: 0 }, { front: 3, back: 1 }], bonus: "10 元", kind: "fixed" },
    { level: "六等奖", conditions: [{ front: 2, back: 1 }, { front: 1, back: 1 }, { front: 0, back: 1 }], bonus: "5 元", kind: "fixed" },
  ],
};

/** 当前彩种的奖级名称列表（按奖级高低排序，一等奖在最前） */
export function getPrizeLevels(type: LotteryType): string[] {
  return PRIZE_TABLE[type].map((t) => t.level);
}

/** 根据命中数判定奖级；未中奖返回 null */
export function getPrizeTierByMatch(type: LotteryType, frontMatch: number, backMatch: number): PrizeTier | null {
  return PRIZE_TABLE[type].find((t) => t.conditions.some((c) => c.front === frontMatch && c.back === backMatch)) ?? null;
}

/** 远程数据地址（GitHub JSON，优先使用） */
export const REMOTE_JSON_URLS: Record<LotteryType, string> = {
  dlt: "https://raw.githubusercontent.com/Neko569/get_lottery_data/main/data/dlt_history.json",
  ssq: "https://raw.githubusercontent.com/Neko569/get_lottery_data/main/data/ssq_history.json",
};

/** Gitee 备用远程数据地址（GitHub JSON 获取失败时的 CSV fallback） */
export const GITEE_CSV_URLS: Record<LotteryType, string> = {
  dlt: "https://raw.giteeusercontent.com/retro569/get_lottery_data/raw/main/data/dlt_history.csv",
  ssq: "https://raw.giteeusercontent.com/retro569/get_lottery_data/raw/main/data/ssq_history.csv",
};

/** 数据源仓库地址（展示用） */
export const DATA_REPO_URLS = {
  github: "https://github.com/Neko569/get_lottery_data/tree/main/data",
  gitee: "https://gitee.com/retro569/get_lottery_data/tree/main/data",
};

/** 将数字补零为两位字符串 */
export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** 在 [1, max] 范围内随机抽取 count 个不重复号码（升序、补零） */
export function pickNumbers(count: number, max: number): string[] {
  const pool = new Set<number>();
  while (pool.size < count) {
    pool.add(Math.floor(Math.random() * max) + 1);
  }
  return Array.from(pool)
    .sort((a, b) => a - b)
    .map(pad2);
}

/** 运行时校验字符串是否为合法彩种类型 */
export function isLotteryType(value: unknown): value is LotteryType {
  return value === "dlt" || value === "ssq";
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
