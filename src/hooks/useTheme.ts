import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "cai-yun-theme";

/** 读取本地存储的主题，无记录时回退到系统偏好 */
const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

/** 将主题应用到 <html> 元素的 class 列表 */
const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

/** 主题管理 Hook：负责切换深色/浅色模式并持久化到 localStorage */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return { theme, isDark: theme === "dark", toggleTheme, setTheme };
}

/** 仅读取当前是否深色模式（不触发重渲染的轻量判断，用于非组件场景如导出图片） */
export const isDarkMode = (): boolean =>
  typeof document !== "undefined" &&
  document.documentElement.classList.contains("dark");
