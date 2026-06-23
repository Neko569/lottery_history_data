// 彩票数据类型定义

/** 彩种类型：dlt 大乐透 / ssq 双色球 */
export type LotteryType = "dlt" | "ssq";

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
  /** 主题色 */
  accent: "crimson" | "indigo";
}

/** 随机生成的一注号码 */
export interface RandomTicket {
  front: string[];
  back: string[];
}
