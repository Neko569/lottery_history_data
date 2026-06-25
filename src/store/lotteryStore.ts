import { create } from "zustand";
import type { LotteryData, LotteryType } from "@/types/lottery";
import {
  REMOTE_URLS,
  GITEE_URLS,
  DATA_REPO_URLS,
  DEFAULT_PAGE_SIZE,
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
// ──────────────────────────────────────────────
const reqTokens: Record<LotteryType, number> = { dlt: 0, ssq: 0 };

/** 远程数据获取超时时间（毫秒） */
const FETCH_TIMEOUT = 8000;

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

/** 带超时的 fetch：先尝试 GitHub，超时或失败后 fallback 到 Gitee */
async function fetchWithFallback(
  githubUrl: string,
  giteeUrl: string,
): Promise<Response> {
  // 先尝试 GitHub（带超时）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const res = await fetch(githubUrl, {
      signal: controller.signal,
      cache: "no-cache",
    });
    clearTimeout(timeoutId);
    if (res.ok) return res;
    // GitHub 返回错误状态码，尝试 Gitee
    throw new Error(`GitHub 请求失败 (${res.status})`);
  } catch (err) {
    clearTimeout(timeoutId);
    // GitHub 超时或失败，尝试 Gitee
    try {
      const res = await fetch(giteeUrl, { cache: "no-cache" });
      if (res.ok) return res;
      throw new Error(`Gitee 请求失败 (${res.status})`);
    } catch (giteeErr) {
      // 两个源都失败，抛出描述性错误
      const githubMsg =
        err instanceof DOMException && err.name === "AbortError"
          ? "超时"
          : err instanceof Error
            ? err.message
            : String(err);
      const giteeMsg =
        giteeErr instanceof Error ? giteeErr.message : String(giteeErr);
      throw new Error(
        `远程数据加载失败：GitHub(${githubMsg})、Gitee(${giteeMsg})`,
      );
    }
  }
}

export const useLotteryStore = create<LotteryStore>((set, get) => ({
  states: {
    dlt: { ...initialLotteryState },
    ssq: { ...initialLotteryState },
  },
  activeLottery: "dlt",
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
      const res = await fetchWithFallback(REMOTE_URLS[type], GITEE_URLS[type]);
      const text = await res.text();
      const data = parseCSVLotteryData(text, type);
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
    await Promise.all([fetchRemoteData("dlt"), fetchRemoteData("ssq")]);
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
      states: {
        dlt: { ...s.states.dlt, currentPage: 1 },
        ssq: { ...s.states.ssq, currentPage: 1 },
      },
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
