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

/** 解析彩票 CSV 文本为 LotteryData
 *  CSV 格式：term,draw_time,draw_result,front_numbers,back_numbers
 *  front_numbers/back_numbers 为 Python 列表字符串，如 "['04', '05']"
 */
export function parseCSVLotteryData(text: string, type: string): LotteryData {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    throw new Error("CSV 数据为空或格式不正确");
  }

  const items: LotteryItem[] = [];

  // 从第二行开始（跳过表头）
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 5) continue;

    const term = fields[0];
    const draw_time = fields[1];
    const draw_result = fields[2];
    const front_numbers = parsePythonList(fields[3]);
    const back_numbers = parsePythonList(fields[4]);

    items.push({
      term,
      draw_time,
      draw_result,
      front_numbers,
      back_numbers,
    });
  }

  if (items.length === 0) {
    throw new Error("CSV 中未解析到任何有效记录");
  }

  return {
    generated_at: "",
    source: "CSV",
    game: type,
    game_no: "",
    total: items.length,
    items,
  };
}

/** 自动检测文本格式并解析（JSON 或 CSV）
 *  优先尝试 JSON，失败则尝试 CSV
 */
export function parseLotteryText(text: string, type: string): LotteryData {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    // 尝试 JSON 解析
    try {
      const json = JSON.parse(trimmed);
      return parseLotteryData(json);
    } catch {
      // JSON 解析失败，继续尝试 CSV
    }
  }
  // 尝试 CSV 解析
  return parseCSVLotteryData(trimmed, type);
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

/** 解析单个 CSV 行，正确处理引号包裹的字段
 *  支持字段内包含逗号（字段用双引号包裹）
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      // 引号包裹的字段
      let field = "";
      i++; // 跳过开头引号
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            // 转义引号：""
            field += '"';
            i += 2;
          } else {
            // 结束引号
            i++; // 跳过结束引号
            break;
          }
        } else {
          field += line[i];
          i++;
        }
      }
      fields.push(field);
    } else {
      // 未引号包裹的字段
      let field = "";
      while (i < line.length && line[i] !== ",") {
        field += line[i];
        i++;
      }
      fields.push(field);
    }
    // 跳过字段间的逗号
    if (i < line.length && line[i] === ",") {
      i++;
    }
  }
  return fields;
}

/** 解析 Python 列表字符串，如 "['04', '05', '15']" 或 ['05]
 *  提取所有单引号包裹的片段，返回字符串数组
 */
function parsePythonList(str: string): string[] {
  const matches = str.match(/'([^']+)'/g);
  if (matches) {
    return matches.map((m) => m.slice(1, -1));
  }
  return [];
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
