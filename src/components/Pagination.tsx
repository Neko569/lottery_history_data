import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** 分页器：上一页/下一页 + 页码 */
export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-center py-4 text-sm text-zinc-500">
        {totalPages === 1 ? "共 1 页" : "暂无数据"}
      </div>
    );
  }

  const pages = getPageList(currentPage, totalPages);

  return (
    <div className="flex items-center justify-center gap-1.5 py-4">
      <button
        type="button"
        className="btn-ghost h-9 w-9 p-0 disabled:opacity-30"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="上一页"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`gap-${i}`} className="px-2 text-zinc-500">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={cn(
              "h-9 min-w-9 rounded-full px-2 text-sm font-medium transition-all duration-200",
              p === currentPage
                ? "bg-crimson text-white shadow-glow"
                : "border border-ink-600 bg-ink-800/60 text-zinc-300 hover:border-crimson/50 hover:text-white",
            )}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        className="btn-ghost h-9 w-9 p-0 disabled:opacity-30"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="下一页"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/** 生成带省略号的页码列表 */
function getPageList(current: number, total: number): (number | "...")[] {
  const delta = 1;
  const range: (number | "...")[] = [];
  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);

  range.push(1);
  if (left > 2) range.push("...");
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push("...");
  if (total > 1) range.push(total);

  return range;
}
