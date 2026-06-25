import type { LotteryRule, LotteryType, RandomTicket } from "@/types/lottery";

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

/** 远程数据地址 */
export const REMOTE_URLS: Record<LotteryType, string> = {
  dlt: "https://raw.githubusercontent.com/Neko569/get_lottery_data/main/data/dlt_history.json",
  ssq: "https://raw.githubusercontent.com/Neko569/get_lottery_data/main/data/ssq_history.json",
};

/** 数据源仓库地址（用于展示与跳转） */
export const DATA_REPO_URL =
  "https://github.com/Neko569/get_lottery_data/tree/main/data";

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
