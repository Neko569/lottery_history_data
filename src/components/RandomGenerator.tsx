import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shuffle, Trash2, ArrowRight, Download } from "lucide-react";
import type { LotteryType, RandomTicket } from "@/types/lottery";
import { LOTTERY_RULES, generateTickets } from "@/utils/lottery";
import LotteryBall from "./LotteryBall";
import { cn } from "@/lib/utils";

interface RandomGeneratorProps {
  type: LotteryType;
}

const COUNT_OPTIONS = [1, 5, 10];

/** 导出号码为图片 */
const exportAsImage = (tickets: RandomTicket[], type: LotteryType) => {
  const rule = LOTTERY_RULES[type];
  const isDlt = type === "dlt";
  const padding = 40;
  const ballSize = 36;
  const ballGap = 8;
  const rowGap = 20;
  const separatorWidth = 30;
  const labelHeight = 60;

  // 计算每行球的数量（前区和后区）
  const frontBalls = rule.frontCount;
  const backBalls = rule.backCount;
  const totalBalls = frontBalls + backBalls + 1; // +1 for separator
  const rowHeight = ballSize + rowGap;

  // 计算尺寸
  const maxBallsInRow = Math.max(frontBalls, backBalls);
  const contentWidth = padding * 2 + maxBallsInRow * ballSize + (maxBallsInRow - 1) * ballGap;
  const width = contentWidth;
  const height = labelHeight + tickets.length * rowHeight + padding;

  // 创建 canvas
  const canvas = document.createElement("canvas");
  canvas.width = width * 2; // 2x for retina
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);

  // 绘制背景
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, width, height);

  // 绘制标题
  ctx.fillStyle = "#e5e5e5";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(rule.name, width / 2, 36);

  // 绘制号码
  tickets.forEach((ticket, ticketIdx) => {
    const y = labelHeight + ticketIdx * rowHeight;

    // 前区球
    ticket.front.forEach((num, i) => {
      const x = padding + i * (ballSize + ballGap) + ballSize / 2;
      const ballY = y + ballSize / 2;

      // 绘制渐变球
      const gradient = ctx.createRadialGradient(x - 3, ballY - 3, 0, x, ballY, ballSize / 2);
      if (isDlt) {
        gradient.addColorStop(0, "#ef4444");
        gradient.addColorStop(1, "#b91c1c");
      } else {
        gradient.addColorStop(0, "#ef4444");
        gradient.addColorStop(1, "#b91c1c");
      }
      ctx.beginPath();
      ctx.arc(x, ballY, ballSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // 绘制数字
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(num, x, ballY);
    });

    // 分隔符
    const separatorX = padding + frontBalls * (ballSize + ballGap) - ballGap / 2;
    ctx.fillStyle = "#52525b";
    ctx.fillRect(separatorX, y + 8, 2, ballSize - 16);

    // 后区球
    ticket.back.forEach((num, i) => {
      const x = separatorX + separatorWidth + i * (ballSize + ballGap) + ballSize / 2;
      const ballY = y + ballSize / 2;

      // 绘制渐变球
      const gradient = ctx.createRadialGradient(x - 3, ballY - 3, 0, x, ballY, ballSize / 2);
      if (isDlt) {
        gradient.addColorStop(0, "#818cf8");
        gradient.addColorStop(1, "#4f46e5");
      } else {
        gradient.addColorStop(0, "#3b82f6");
        gradient.addColorStop(1, "#1d4ed8");
      }
      ctx.beginPath();
      ctx.arc(x, ballY, ballSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // 绘制数字
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(num, x, ballY);
    });

    // 期号
    ctx.fillStyle = "#71717a";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${ticketIdx + 1}`, 8, y + ballSize / 2 + 4);
  });

  // 导出
  const link = document.createElement("a");
  link.download = `${type}-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
};

/** 随机号码生成器 */
export default function RandomGenerator({ type }: RandomGeneratorProps) {
  const navigate = useNavigate();
  const rule = LOTTERY_RULES[type];
  const [count, setCount] = useState(1);
  const [tickets, setTickets] = useState<RandomTicket[]>([]);

  const handleGenerate = () => {
    setTickets(generateTickets(type, count));
  };

  const handleClear = () => setTickets([]);

  const handleCompare = () => {
    const ticketsJson = encodeURIComponent(JSON.stringify(tickets));
    navigate(`/match?type=${type}&tickets=${ticketsJson}`);
  };

  const handleExport = () => {
    exportAsImage(tickets, type);
  };

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shuffle className="h-4 w-4 text-gold" />
          <h3 className="font-serif text-base font-bold text-zinc-900">
            随机生成
          </h3>
          <span className="text-xs text-zinc-500">
            {rule.frontCount}+{rule.backCount}
          </span>
        </div>
        {tickets.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="text-zinc-500 transition-colors hover:text-indigo"
              aria-label="导出图片"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="text-zinc-500 transition-colors hover:text-crimson"
              aria-label="清空"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <div className="seg">
          {COUNT_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              className={cn("seg-item", count === c && "seg-item-active")}
              onClick={() => setCount(c)}
            >
              {c}注
            </button>
          ))}
        </div>
        <button type="button" className="btn-gold ml-auto" onClick={handleGenerate}>
          <Shuffle className="h-4 w-4" />
          生成
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-ink-700 text-sm text-zinc-600">
          点击「生成」获取随机号码
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tickets.map((ticket, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-xl border border-ink-700/60 bg-ink-900/50 px-3 py-2 animate-pop-in"
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <span className="w-6 shrink-0 text-center font-mono text-xs text-zinc-500">
                {idx + 1}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {ticket.front.map((n, i) => (
                  <LotteryBall key={`f-${i}`} number={n} variant="front" size="sm" />
                ))}
                <span className="mx-1 h-4 w-px bg-ink-600" />
                {ticket.back.map((n, i) => (
                  <LotteryBall key={`b-${i}`} number={n} variant="back" size="sm" />
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn-gold mt-2"
            onClick={handleCompare}
          >
            <ArrowRight className="h-4 w-4" />
            对比分析
          </button>
        </div>
      )}
    </div>
  );
}
