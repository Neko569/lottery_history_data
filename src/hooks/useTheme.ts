import { useCallback, useEffect, useRef, useState } from "react";

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
  if (typeof window === "undefined") return "auto";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "auto";
};

/** 将偏好解析为实际生效的主题 */
const resolveTheme = (pref: Preference): Theme =>
  pref === "auto" ? getTimeBasedTheme() : pref;

const getInitialTheme = (): Theme => resolveTheme(getStoredPreference());

/** 将主题应用到 <html> 元素的 class 列表 */
const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

/** 主题管理 Hook
 *  - 默认偏好 auto：根据本地时间自动切换深色/浅色（18:00~6:00 深色）
 *  - 用户手动 toggle 后固定为所选主题并持久化
 *  - auto 模式下每分钟校正一次，跨过时段阈值时自动切换 */
export function useTheme() {
  const [preference, setPreference] = useState<Preference>(getStoredPreference);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  // 用于在 auto 定时器中避免与手动 toggle 竞态
  const themeRef = useRef(theme);
  themeRef.current = theme;

  // 应用主题 class 并持久化偏好
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, preference);
  }, [theme, preference]);

  // auto 模式：按本地时间定时校正
  useEffect(() => {
    if (preference !== "auto") return;
    const correct = () => {
      const target = getTimeBasedTheme();
      if (themeRef.current !== target) {
        setTheme(target);
      }
    };
    // 首次进入或从手动切回 auto 时立即校正一次
    correct();
    const id = setInterval(correct, 60_000);
    return () => clearInterval(id);
  }, [preference]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      // 手动切换即退出 auto，固定为所选主题
      setPreference(next);
      return next;
    });
  }, []);

  return { theme, isDark: theme === "dark", toggleTheme, setTheme, preference };
}

/** 仅读取当前是否深色模式（不触发重渲染的轻量判断，用于非组件场景如导出图片） */
export const isDarkMode = (): boolean =>
  typeof document !== "undefined" &&
  document.documentElement.classList.contains("dark");
