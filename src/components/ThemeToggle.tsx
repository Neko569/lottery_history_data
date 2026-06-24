import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

/** 深色/浅色模式切换开关 */
export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "切换为浅色模式" : "切换为深色模式"}
      title={isDark ? "切换为浅色模式" : "切换为深色模式"}
      onClick={toggleTheme}
      className={cn(
        "relative inline-flex h-9 w-16 items-center rounded-full border border-ink-600 bg-ink-800/60 px-1 transition-colors duration-300",
        isDark && "border-indigo/50 bg-indigo/20",
        className,
      )}
    >
      {/* 滑块 */}
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300",
          isDark ? "translate-x-7 bg-indigo-400 text-white" : "translate-x-0 text-gold",
        )}
      >
        {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </span>
    </button>
  );
}
