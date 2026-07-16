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
  /** 前区/红球个数（玩家选号个数） */
  frontCount: number;
  /** 前区/红球号码范围上限 */
  frontMax: number;
  /** 前区/红球号码范围下限（默认 1，0-9 数字型彩种设为 0） */
  frontMin?: number;
  /** 前区实际开奖个数（默认等于 frontCount，如快乐八玩家选 10 但开奖 20） */
  frontDrawCount?: number;
  /** 后区/蓝球个数 */
  backCount: number;
  /** 后区/蓝球号码范围上限 */
  backMax: number;
  /** 后区/蓝球号码范围下限（默认 1） */
  backMin?: number;
  /** 后区实际开奖个数（默认等于 backCount） */
  backDrawCount?: number;
  /** 彩种中文名 */
  name: string;
  /** 前区标签 */
  frontLabel: string;
  /** 后区标签 */
  backLabel: string;
  /** 主题色键（取值见 `ACCENT_STYLES`，新增主题色只需扩映射表） */
  accent: Accent;
  /** 是否按位匹配（数字型彩种如排列三/排列五/七星彩/福彩3D：每位数字与位置均需对位相同才算命中） */
  positionBased?: boolean;
  /** 特别号从前区选号中匹配（七乐彩：玩家只选 7 个基本号，特别号命中=玩家任一号码==开奖特别号）。
   *  开启后 backCount 应为 0（玩家不选后区），backDrawCount 为开奖特别号个数，匹配时 backMatch 由前区号码推导。 */
  backMatchFromFront?: boolean;
}

/** 玩法类型：直选（默认）/ 组选三 / 组选六（仅排列三等按位数字彩适用） */
export type PlayType = "direct" | "group3" | "group6";

/** 随机生成的一注号码 */
export interface RandomTicket {
  front: string[];
  back: string[];
  /** 玩法：默认直选。排列三组选三/组选六时区分 */
  playType?: PlayType;
}

/** 单个奖级的中奖条件（前区/红球命中数 + 后区/蓝球命中数） */
export interface PrizeCondition {
  front: number;
  back: number;
  /** 该条件对应的玩法（组选三/六），默认直选 */
  playType?: PlayType;
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
