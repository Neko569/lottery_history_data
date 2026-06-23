import type { LotteryData, LotteryItem } from "@/types/lottery";

/** 校验并解析彩票 JSON 数据，兼容数组与对象两种结构 */
export function parseLotteryData(raw: unknown): LotteryData {
  if (Array.isArray(raw)) {
    // 兼容纯数组结构
    return wrapItems(raw.map(normalizeItem));
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const itemsRaw = obj.items;
    if (Array.isArray(itemsRaw)) {
      const items = itemsRaw.map(normalizeItem);
      return {
        generated_at: typeof obj.generated_at === "string" ? obj.generated_at : "",
        source: typeof obj.source === "string" ? obj.source : "",
        game: typeof obj.game === "string" ? obj.game : "",
        game_no: typeof obj.game_no === "string" ? obj.game_no : "",
        total: typeof obj.total === "number" ? obj.total : items.length,
        items,
      };
    }
  }

  throw new Error("数据格式不正确：缺少 items 数组");
}

/** 规整单条记录，确保字段类型正确 */
function normalizeItem(raw: unknown): LotteryItem {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const front = toStringArray(obj.front_numbers);
  const back = toStringArray(obj.back_numbers);
  return {
    term: (obj.term as string | number) ?? "",
    draw_time: typeof obj.draw_time === "string" ? obj.draw_time : "",
    draw_result: typeof obj.draw_result === "string" ? obj.draw_result : "",
    front_numbers: front,
    back_numbers: back,
  };
}

function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.map((v) => (typeof v === "number" ? String(v) : String(v ?? "")));
  }
  return [];
}

function wrapItems(items: LotteryItem[]): LotteryData {
  return {
    generated_at: "",
    source: "",
    game: "",
    game_no: "",
    total: items.length,
    items,
  };
}

/** 读取文件为文本 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("文件读取失败"));
    reader.readAsText(file);
  });
}
