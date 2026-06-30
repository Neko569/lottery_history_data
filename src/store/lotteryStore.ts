import { create } from "zustand";
import type { LotteryData, LotteryType } from "@/types/lottery";
import {
  REMOTE_JSON_URLS,
  GITEE_CSV_URLS,
  DATA_REPO_URLS,
  DEFAULT_PAGE_SIZE,
  LOTTERY_TYPES,
} from "@/utils/lottery";
import {
  parseLotteryData,
  parseCSVLotteryData,
  parseLotteryText,
  readFileAsText,
} from "@/utils/dataParser";

/** 单个彩种的运行时状态 */
interface LotteryState {
  data: LotteryData | null;
  currentPage: number;
  loading: boolean;
  error: string | null;
  /** 该彩种数据来源 */
  source: "remote" | "upload" | null;
}

const initialLotteryState: LotteryState = {
  data: null,
  currentPage: 1,
  loading: false,
  error: null,
  source: null,
};

// ──────────────────────────────────────────────
// 竞态控制：每个彩种维护一个递增的请求 token，
// fetch / upload 共用同一 token 互斥。
// 异步操作返回时若 token 已过期，说明被新请求取代，丢弃结果。
// 初始 token 表由注册表派生，新增彩种自动纳入。
// ──────────────────────────────────────────────
const reqTokens: Record<LotteryType, number> = Object.fromEntries(
  LOTTERY_TYPES.map((t) => [t, 0]),
) as Record<LotteryType, number>;

/** 单次请求超时时间（毫秒） */
const FETCH_TIMEOUT = 6000;

/** GitHub JSON 获取失败时的最大重试次数 */
const MAX_RETRY = 1;

interface LotteryStore {
  states: Record<LotteryType, LotteryState>;
  activeLottery: LotteryType;
  splitView: boolean;
  pageSize: number;
  isDesktop: boolean;

  fetchRemoteData: (type: LotteryType) => Promise<void>;
  fetchAllRemote: () => Promise<void>;
  uploadData: (type: LotteryType, file: File) => Promise<void>;
  setActiveLottery: (type: LotteryType) => void;
  setSplitView: (on: boolean) => void;
  setPageSize: (size: number) => void;
  setCurrentPage: (type: LotteryType, page: number) => void;
  setDesktop: (isDesktop: boolean) => void;
}

/** 带超时的 fetch：先尝试 GitHub JSON，失败后 fallback 到 Gitee CSV */
/** 发起单次带超时的 fetch，返回 Response；超时或失败抛异常 */
/** 发起单次带超时的 fetch，超时或失败抛异常（使用 Promise.race 实现可靠超时） */
async function fetchOnce(url: string): Promise<Response> {
  const timeoutPromise = new Promise<Response>((_, reject) => {
    setTimeout(() => reject(new DOMException("Timeout", "AbortError")), FETCH_TIMEOUT);
  });
  const fetchPromise = fetch(url, { cache: "no-cache" });
  const res = await Promise.race([fetchPromise, timeoutPromise]);
  if (!res.ok) throw new Error(`请求失败 (${res.status})`);
  return res;
}

/** 带重试的 fetch：先尝试 GitHub JSON（重试 MAX_RETRY 次），全部失败则 fallback 到 Gitee CSV */
async function fetchWithFallback(
  type: LotteryType,
): Promise<{ data: LotteryData; source: string }> {
  // 第 1 步：尝试 GitHub JSON，失败重试最多 MAX_RETRY 次
  let githubLastErr: unknown = null;
  for (let i = 0; i <= MAX_RETRY; i++) {
    try {
      const res = await fetchOnce(REMOTE_JSON_URLS[type]);
      if (res.ok) {
        const text = await res.text();
        const json = JSON.parse(text);
        const data = parseLotteryData(json);
        return { data, source: "GitHub JSON" };
      }
      githubLastErr = new Error(`GitHub JSON 请求失败 (${res.status})`);
    } catch (err) {
      githubLastErr = err;
    }
  }

  // 第 2 步：GitHub JSON 全部失败，尝试 Gitee CSV（不重试）
  try {
    const res = await fetchOnce(GITEE_CSV_URLS[type]);
    if (res.ok) {
      const text = await res.text();
      const data = parseCSVLotteryData(text, type);
      return { data, source: "Gitee CSV" };
    }
    throw new Error(`Gitee CSV 请求失败 (${res.status})`);
  } catch (giteeErr) {
    // 第 3 步：两个源都失败，抛出带数据源链接的错误
    const githubMsg =
      githubLastErr instanceof DOMException && (githubLastErr as DOMException).name === "AbortError"
        ? "超时"
        : githubLastErr instanceof Error
          ? (githubLastErr as Error).message
          : String(githubLastErr);
    const giteeMsg =
      giteeErr instanceof DOMException && (giteeErr as DOMException).name === "AbortError"
        ? "超时"
        : giteeErr instanceof Error
          ? (giteeErr as Error).message
          : String(giteeErr);
    throw new Error(
      `远程数据加载失败：GitHub JSON(${githubMsg})、Gitee CSV(${giteeMsg})`,
    );
  }
}

/** 初始 states：由注册表派生，每个彩种一份独立运行时状态 */
const initialStates: Record<LotteryType, LotteryState> = Object.fromEntries(
  LOTTERY_TYPES.map((t) => [t, { ...initialLotteryState }]),
) as Record<LotteryType, LotteryState>;

export const useLotteryStore = create<LotteryStore>((set, get) => ({
  states: initialStates,
  activeLottery: LOTTERY_TYPES[0],
  splitView: false,
  pageSize: DEFAULT_PAGE_SIZE,
  isDesktop: true,

  fetchRemoteData: async (type) => {
    const myToken = ++reqTokens[type];
    set((s) => ({
      states: {
        ...s.states,
        [type]: { ...s.states[type], loading: true, error: null },
      },
    }));
    try {
      const { data, source } = await fetchWithFallback(type);
      // 远程数据默认按期号倒序，确保最新在前
      data.items = sortDesc(data.items);
      // 若已被新请求取代（如用户再次刷新或上传了文件），丢弃本次结果
      if (myToken !== reqTokens[type]) return;
      set((s) => ({
        states: {
          ...s.states,
          [type]: {
            data,
            currentPage: 1,
            loading: false,
            error: null,
            source: "remote",
          },
        },
      }));
    } catch (err) {
      if (myToken !== reqTokens[type]) return;
      const msg =
        err instanceof Error ? err.message : "未知错误";
      set((s) => ({
        states: {
          ...s.states,
          [type]: {
            ...s.states[type],
            loading: false,
            error: buildErrorMessage(msg),
          },
        },
      }));
    }
  },

  fetchAllRemote: async () => {
    const { fetchRemoteData } = get();
    // 遍历注册表全部彩种并发拉取，新增彩种自动纳入
    await Promise.all(LOTTERY_TYPES.map((t) => fetchRemoteData(t)));
  },

  uploadData: async (type, file) => {
    const myToken = ++reqTokens[type];
    set((s) => ({
      states: {
        ...s.states,
        [type]: { ...s.states[type], loading: true, error: null },
      },
    }));
    try {
      const text = await readFileAsText(file);
      const data = parseLotteryText(text, type);
      data.items = sortDesc(data.items);
      // 若已被新请求取代，丢弃本次结果
      if (myToken !== reqTokens[type]) return;
      set((s) => ({
        states: {
          ...s.states,
          [type]: {
            data,
            currentPage: 1,
            loading: false,
            error: null,
            source: "upload",
          },
        },
      }));
    } catch (err) {
      if (myToken !== reqTokens[type]) return;
      const msg = err instanceof Error ? err.message : "未知错误";
      set((s) => ({
        states: {
          ...s.states,
          [type]: {
            ...s.states[type],
            loading: false,
            error: `文件解析失败：${msg}`,
          },
        },
      }));
    }
  },

  setActiveLottery: (type) => set({ activeLottery: type }),
  setSplitView: (on) => set({ splitView: on }),
  setPageSize: (size) =>
    set((s) => ({
      pageSize: size,
      // 重置所有彩种页码为 1：遍历注册表，新增彩种自动纳入
      states: Object.fromEntries(
        LOTTERY_TYPES.map((t) => [t, { ...s.states[t], currentPage: 1 }]),
      ) as Record<LotteryType, LotteryState>,
    })),
  setCurrentPage: (type, page) =>
    set((s) => ({
      states: {
        ...s.states,
        [type]: { ...s.states[type], currentPage: page },
      },
    })),
  setDesktop: (isDesktop) => set({ isDesktop }),
}));

/** 构建包含数据源链接的错误提示信息 */
function buildErrorMessage(msg: string): string {
  return `${msg}。\n\n可从以下地址下载数据文件后手动上传：\n• GitHub：${DATA_REPO_URLS.github}\n• Gitee：${DATA_REPO_URLS.gitee}`;
}

/** 将开奖记录按期号倒序排列（最新在前） */
function sortDesc(items: LotteryData["items"]): LotteryData["items"] {
  return [...items].sort((a, b) => {
    const ta = typeof a.term === "number" ? a.term : Number(a.term);
    const tb = typeof b.term === "number" ? b.term : Number(b.term);
    return tb - ta;
  });
}
