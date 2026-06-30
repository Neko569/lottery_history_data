// 彩票数据类型定义

/**
 * 彩种类型：从 `LOTTERIES` 注册表派生（见 src/utils/lottery.ts）。
 * 新增彩种只需在注册表追加条目，此处自动同步，无需手动维护联合类型。
 */
export type { LotteryType } from "@/utils/lottery";

// 主题色键：从 ACCENT_STYLES 映射表派生（见 src/utils/lottery.ts）。
// 本地 import 用于 LotteryRule.accent 字段，同时 re-export 供外部引用。
import type { Accent } from "@/utils/lottery";
export type { Accent };

/** 单期开奖记录 */
export interface LotteryItem {
  /** 期号：大乐透为 string，双色球为 number */
  term: string | number;
  /** 开奖日期 YYYY-MM-DD */
  draw_time: string;
  /** 开奖结果原始字符串，如 "12 19 21 24 29 03 10" */
  draw_result: string;
  /** 前区/红球号码（大乐透5个 / 双色球6个） */
  front_numbers: string[];
  /** 后区/蓝球号码（大乐透2个 / 双色球1个） */
  back_numbers: string[];
}

/** 彩票数据集合 */
export interface LotteryData {
  generated_at: string;
  source: string;
  game: string;
  game_no: string;
  total: number;
  items: LotteryItem[];
}

/** 彩种规则配置 */
export interface LotteryRule {
  /** 前区/红球个数 */
  frontCount: number;
  /** 前区/红球号码范围上限 */
  frontMax: number;
  /** 后区/蓝球个数 */
  backCount: number;
  /** 后区/蓝球号码范围上限 */
  backMax: number;
  /** 彩种中文名 */
  name: string;
  /** 前区标签 */
  frontLabel: string;
  /** 后区标签 */
  backLabel: string;
  /** 主题色键（取值见 `ACCENT_STYLES`，新增主题色只需扩映射表） */
  accent: Accent;
}

/** 随机生成的一注号码 */
export interface RandomTicket {
  front: string[];
  back: string[];
}

/** 单个奖级的中奖条件（前区/红球命中数 + 后区/蓝球命中数） */
export interface PrizeCondition {
  front: number;
  back: number;
}

/** 奖级定义：奖级名称、中奖条件、奖金及类型 */
export interface PrizeTier {
  /** 奖级名称，如 "一等奖" */
  level: string;
  /** 命中条件列表，满足任一即中该奖级 */
  conditions: PrizeCondition[];
  /** 奖金描述（浮动奖为说明，固定奖为金额） */
  bonus: string;
  /** 奖级类型：浮动奖 / 固定奖 */
  kind: "floating" | "fixed";
  /** 备注（如 2026 新规特别说明） */
  note?: string;
}
