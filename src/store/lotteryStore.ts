import { create } from "zustand";
import type { LotteryData, LotteryType } from "@/types/lottery";
import { REMOTE_URLS, DEFAULT_PAGE_SIZE } from "@/utils/lottery";
import { parseLotteryData, readFileAsText } from "@/utils/dataParser";

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
    set((s) => ({
      states: {
        ...s.states,
        [type]: { ...s.states[type], loading: true, error: null },
      },
    }));
    try {
      const res = await fetch(REMOTE_URLS[type], { cache: "no-cache" });
      if (!res.ok) {
        throw new Error(`请求失败 (${res.status})`);
      }
      const json = await res.json();
      const data = parseLotteryData(json);
      // 远程数据默认按期号倒序，确保最新在前
      data.items = sortDesc(data.items);
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
      const msg =
        err instanceof Error ? err.message : "未知错误";
      set((s) => ({
        states: {
          ...s.states,
          [type]: {
            ...s.states[type],
            loading: false,
            error: `远程数据加载失败：${msg}。可尝试手动上传 JSON 文件。`,
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
    set((s) => ({
      states: {
        ...s.states,
        [type]: { ...s.states[type], loading: true, error: null },
      },
    }));
    try {
      const text = await readFileAsText(file);
      const json = JSON.parse(text);
      const data = parseLotteryData(json);
      data.items = sortDesc(data.items);
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

/** 将开奖记录按期号倒序排列（最新在前） */
function sortDesc(items: LotteryData["items"]): LotteryData["items"] {
  return [...items].sort((a, b) => {
    const ta = typeof a.term === "number" ? a.term : Number(a.term);
    const tb = typeof b.term === "number" ? b.term : Number(b.term);
    return tb - ta;
  });
}
