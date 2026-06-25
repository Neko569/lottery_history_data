import { useEffect } from "react";
import { create } from "zustand";

export type Theme = "light" | "dark";

/** 用户偏好：auto 表示跟随本地时间自动切换 */
type Preference = "auto" | Theme;

const STORAGE_KEY = "cai-yun-theme";

/** 夜间时段起止（24h制，闭区间）：18:00 ~ 次日 6:00 视为夜间 */
const NIGHT_START = 18;
const NIGHT_END = 6;

/** 根据用户本地时间判断建议主题：夜间为深色，白天为浅色 */
export const getTimeBasedTheme = (): Theme => {
  const h = new Date().getHours();
  return h >= NIGHT_START || h < NIGHT_END ? "dark" : "light";
};

/** 读取本地存储的用户偏好，无记录或非法值时回退到 auto */
const getStoredPreference = (): Preference => {
  try {
    if (typeof window === "undefined") return "auto";
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return "auto";
  } catch {
    return "auto";
  }
};

/** 将偏好解析为实际生效的主题 */
const resolveTheme = (pref: Preference): Theme =>
  pref === "auto" ? getTimeBasedTheme() : pref;

/** 将主题应用到 <html> 元素的 class 列表 */
const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

// ──────────────────────────────────────────────
// 全局主题 store —— 所有组件共享同一份状态
// 解决多实例 useTheme 各持独立 state、切换后图表颜色不更新的问题
// ──────────────────────────────────────────────
interface ThemeStore {
  theme: Theme;
  preference: Preference;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const initialPref = getStoredPreference();

export const useThemeStore = create<ThemeStore>((set, get) => ({
  preference: initialPref,
  theme: resolveTheme(initialPref),
  toggleTheme: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    // 手动切换即退出 auto，固定为所选主题
    set({ theme: next, preference: next });
  },
  setTheme: (t: Theme) => set({ theme: t, preference: t }),
}));

// ──────────────────────────────────────────────
// 全局副作用：applyTheme + localStorage + auto 定时校正
// 只初始化一次，避免多组件重复绑定
// ──────────────────────────────────────────────
let sideEffectsInitialized = false;

function initThemeSideEffects() {
  if (sideEffectsInitialized || typeof window === "undefined") return;
  sideEffectsInitialized = true;

  // store 变化时应用主题 class 并持久化偏好
  const apply = () => {
    const { theme, preference } = useThemeStore.getState();
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // 存储不可用时静默忽略
    }
  };
  apply();
  useThemeStore.subscribe(apply);

  // auto 模式：每分钟按本地时间校正
  setInterval(() => {
    const { preference, theme } = useThemeStore.getState();
    if (preference !== "auto") return;
    const target = getTimeBasedTheme();
    if (theme !== target) {
      useThemeStore.setState({ theme: target });
    }
  }, 60_000);
}

/** 主题管理 Hook：所有组件共享同一份全局状态
 *  - 默认偏好 auto：根据本地时间自动切换（18:00~6:00 深色）
 *  - 用户手动 toggle 后固定为所选主题并持久化
 *  - auto 模式下每分钟校正一次 */
export function useTheme() {
  const theme = useThemeStore((s) => s.theme);
  const preference = useThemeStore((s) => s.preference);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    initThemeSideEffects();
  }, []);

  return { theme, isDark: theme === "dark", toggleTheme, setTheme, preference };
}

/** 仅读取当前是否深色模式（不触发重渲染的轻量判断，用于非组件场景如导出图片） */
export const isDarkMode = (): boolean =>
  typeof document !== "undefined" &&
  document.documentElement.classList.contains("dark");
