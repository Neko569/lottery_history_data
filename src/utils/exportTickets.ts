import { LOTTERIES, type LotteryType } from "@/utils/lottery";
import { isDarkMode } from "@/hooks/useTheme";

/** 导出图片时通用的号码结构（前区 + 后区） */
export interface ExportTicket {
  front: string[];
  back: string[];
}

/** 判断一注是否为复式：任一区选号数超过正常一注数量即为复式 */
export const isCompoundTicket = (
  ticket: { front: string[]; back: string[] },
  rule: { frontCount: number; backCount: number },
): boolean => ticket.front.length > rule.frontCount || ticket.back.length > rule.backCount;

/**
 * 导出号码为 PNG 图片。
 *  - 前后区球渐变色取自彩种注册表 `LOTTERIES[type].frontBallColors / backBallColors`
 *  - 主题相关颜色随当前深浅模式变化
 *  - 复式票上下两排布局，单式票同一排布局（各自独立判断）
 *  新增彩种无需改本函数：颜色自动来自注册表。
 */
export function exportTicketsToImage(tickets: ExportTicket[], type: LotteryType): void {
  const { rule, frontBallColors, backBallColors } = LOTTERIES[type];
  const dark = isDarkMode();
  const padding = 40;
  const ballSize = 36;
  const ballGap = 8;
  const rowGap = 20;
  const separatorWidth = 30;
  const labelHeight = 60;

  // 主题相关颜色
  const bgColor = dark ? "#0a0a12" : "#ffffff";
  const titleColor = dark ? "#f4f4f5" : "#27272a";
  const indexColor = dark ? "#a1a1aa" : "#71717a";
  const separatorColor = dark ? "#3a3a4a" : "#d1d1d8";
  const compoundTagColor = "#f59e0b";

  const frontBalls = rule.frontCount;
  const backBalls = rule.backCount;

  // 按每注自身是否复式计算尺寸（复式与单式混合时各自独立）
  const getTicketWidth = (ticket: ExportTicket) => {
    if (isCompoundTicket(ticket, rule)) {
      // 复式：上下两排，取前后区最大宽度
      const maxBalls = Math.max(ticket.front.length, ticket.back.length);
      return padding * 2 + maxBalls * ballSize + (maxBalls - 1) * ballGap;
    }
    // 单式：同一排
    return padding * 2 + frontBalls * ballSize + (frontBalls - 1) * ballGap + separatorWidth + backBalls * ballSize + (backBalls - 1) * ballGap;
  };
  const getTicketHeight = (ticket: ExportTicket) =>
    isCompoundTicket(ticket, rule) ? ballSize * 2 + rowGap + 16 : ballSize + rowGap;

  const width = Math.max(...tickets.map(getTicketWidth));
  const height = labelHeight + tickets.reduce((sum, t) => sum + getTicketHeight(t), 0) + padding;

  const canvas = document.createElement("canvas");
  canvas.width = width * 2; // 2x for retina
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = titleColor;
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(rule.name, width / 2, 36);

  // 绘制号码球：渐变色按前/后区取自注册表
  const drawBall = (x: number, y: number, num: string, isFront: boolean) => {
    const colors = isFront ? frontBallColors : backBallColors;
    const gradient = ctx.createRadialGradient(x - 3, y - 3, 0, x, y, ballSize / 2);
    gradient.addColorStop(0, colors.from);
    gradient.addColorStop(1, colors.to);
    ctx.beginPath();
    ctx.arc(x, y, ballSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(num, x, y);
  };

  // 逐注绘制：复式上下两排，单式同一排（各自独立判断）
  let currentY = labelHeight;
  tickets.forEach((ticket, ticketIdx) => {
    if (isCompoundTicket(ticket, rule)) {
      // 复式：上下两排布局
      const frontStartX = padding;
      ticket.front.forEach((num, i) => {
        const x = frontStartX + i * (ballSize + ballGap) + ballSize / 2;
        const y = currentY + ballSize / 2;
        drawBall(x, y, num, true);
      });

      const backStartX = padding;
      ticket.back.forEach((num, i) => {
        const x = backStartX + i * (ballSize + ballGap) + ballSize / 2;
        const y = currentY + ballSize + rowGap + ballSize / 2;
        drawBall(x, y, num, false);
      });

      // 期号
      ctx.fillStyle = indexColor;
      ctx.font = "14px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`${ticketIdx + 1}`, 8, currentY + ballSize / 2 + 4);

      // 复式标签
      ctx.fillStyle = compoundTagColor;
      ctx.font = "12px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("复式", width - 8, currentY + ballSize / 2 + 4);

      currentY += ballSize * 2 + rowGap + 16;
    } else {
      // 单式：同一排布局
      const y = currentY;

      // 前区球
      ticket.front.forEach((num, i) => {
        const x = padding + i * (ballSize + ballGap) + ballSize / 2;
        const ballY = y + ballSize / 2;
        drawBall(x, ballY, num, true);
      });

      // 分隔符
      const separatorX = padding + frontBalls * (ballSize + ballGap) - ballGap / 2;
      ctx.fillStyle = separatorColor;
      ctx.fillRect(separatorX, y + 8, 2, ballSize - 16);

      // 后区球
      ticket.back.forEach((num, i) => {
        const x = separatorX + separatorWidth + i * (ballSize + ballGap) + ballSize / 2;
        const ballY = y + ballSize / 2;
        drawBall(x, ballY, num, false);
      });

      ctx.fillStyle = indexColor;
      ctx.font = "14px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`${ticketIdx + 1}`, 8, y + ballSize / 2 + 4);

      currentY += ballSize + rowGap;
    }
  });

  const link = document.createElement("a");
  link.download = `${type}-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
