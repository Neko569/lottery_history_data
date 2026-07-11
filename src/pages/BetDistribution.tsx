import { useState, useMemo, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Target,
  Plus,
  Minus,
  Trash2,
  RefreshCw,
  Upload,
  AlertCircle,
  CheckCircle2,
  Cloud,
  FileText,
  FileUp,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { LotteryItem } from "@/types/lottery";
import {
  LOTTERY_RULES,
  LOTTERIES,
  LOTTERY_CATEGORIES,
  getCategoryOf,
  DATA_REPO_URLS,
  toLotteryType,
  type LotteryCategory,
} from "@/utils/lottery";
import { useLotteryStore } from "@/store/lotteryStore";
import LotteryBall from "@/components/LotteryBall";
import { LotterySelector } from "@/components/ControlBar";
import { cn } from "@/lib/utils";

interface LotteryTicket {
  front: string[];
  back: string[];
}

/** 将一段号码字符串解析为补零后的号码数组，非法时返回 error */
const normalizeNumberGroup = (
  str: string,
  label: string,
  max: number,
  min: number = 1,
): { nums: string[]; error?: string } => {
  const tokens = str
    .split(/[\s,，、;；]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const nums: string[] = [];
  for (const tok of tokens) {
    const n = parseInt(tok, 10);
    if (Number.isNaN(n) || n < min || n > max) {
      return { nums: [], error: `${label}号码 "${tok}" 不合法（应在 ${min}-${max} 之间）` };
    }
    nums.push(String(n).padStart(2, "0"));
  }
  return { nums };
};

/** 解析用户粘贴的文本为多注号码（与对比分析页一致的格式） */
const parseTicketsFromText = (
  text: string,
  rule: { frontCount: number; frontMax: number; frontMin?: number; backCount: number; backMax: number; backMin?: number; frontLabel: string; backLabel: string },
): { tickets: LotteryTicket[]; errors: string[] } => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const tickets: LotteryTicket[] = [];
  const errors: string[] = [];
  const frontMin = rule.frontMin ?? 1;
  const backMin = rule.backMin ?? 1;

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const plusMatch = line.match(/\+/);

    if (plusMatch) {
      const [frontPart, backPart] = line.split("+");
      const frontRes = normalizeNumberGroup(frontPart, rule.frontLabel, rule.frontMax, frontMin);
      if (frontRes.error) { errors.push(`第${lineNo}行: ${frontRes.error}`); return; }
      const backRes = normalizeNumberGroup(backPart, rule.backLabel, rule.backMax, backMin);
      if (backRes.error) { errors.push(`第${lineNo}行: ${backRes.error}`); return; }
      if (frontRes.nums.length < rule.frontCount) { errors.push(`第${lineNo}行: ${rule.frontLabel}号码不足，至少需要 ${rule.frontCount} 个`); return; }
      if (backRes.nums.length < rule.backCount) { errors.push(`第${lineNo}行: ${rule.backLabel}号码不足，至少需要 ${rule.backCount} 个`); return; }
      tickets.push({ front: frontRes.nums, back: backRes.nums });
    } else {
      const tokens = line.split(/[\s,，、;；]+/).map((t) => t.trim()).filter((t) => t.length > 0);
      if (tokens.length < rule.frontCount + rule.backCount) {
        errors.push(`第${lineNo}行: 号码数量不足，至少需要 ${rule.frontCount + rule.backCount} 个`);
        return;
      }
      const frontTokens = tokens.slice(0, rule.frontCount);
      const backTokens = tokens.slice(rule.frontCount);
      const frontRes = normalizeNumberGroup(frontTokens.join(" "), rule.frontLabel, rule.frontMax, frontMin);
      if (frontRes.error) { errors.push(`第${lineNo}行: ${frontRes.error}`); return; }
      const backRes = normalizeNumberGroup(backTokens.join(" "), rule.backLabel, rule.backMax, backMin);
      if (backRes.error) { errors.push(`第${lineNo}行: ${backRes.error}`); return; }
      if (backRes.nums.length > rule.backCount) {
        errors.push(`第${lineNo}行: 无 + 分隔时仅支持单式，${rule.backLabel}号码多于 ${rule.backCount} 个，请用 + 分隔前后区`);
        return;
      }
      tickets.push({ front: frontRes.nums, back: backRes.nums });
    }
  });

  return { tickets, errors };
};

export default function BetDistribution() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const fileInputRef = { current: null as HTMLInputElement | null };
  const textFileInputRef = { current: null as HTMLInputElement | null };

  const type = toLotteryType(searchParams.get("type"));
  const lottery = LOTTERIES[type];
  const rule = LOTTERY_RULES[type];
  const frontMin = rule.frontMin ?? 1;
  const backMin = rule.backMin ?? 1;
  const hasBack = rule.backCount > 0;

  /** 彩种大类选中态（与对比分析页一致的两行布局） */
  const [activeCategory, setActiveCategory] = useState<LotteryCategory>(() => getCategoryOf(type));
  useEffect(() => { setActiveCategory(getCategoryOf(type)); }, [type]);
  const categoryLotteries = LOTTERY_CATEGORIES.find((c) => c.key === activeCategory)?.lotteries ?? [];
  const handleCategoryClick = (cat: LotteryCategory) => {
    setActiveCategory(cat);
    const list = LOTTERY_CATEGORIES.find((c) => c.key === cat)?.lotteries ?? [];
    if (list.length > 0 && !list.includes(type)) {
      navigate(`/distribution?type=${list[0]}`);
    }
  };

  const [customTickets, setCustomTickets] = useState<LotteryTicket[]>([{ front: [], back: [] }]);
  const [importCollapsed, setImportCollapsed] = useState(true);
  const [importText, setImportText] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const state = useLotteryStore((s) => s.states[type]);
  const fetchRemoteData = useLotteryStore((s) => s.fetchRemoteData);
  const uploadData = useLotteryStore((s) => s.uploadData);
  const data = state.data;
  const loading = state.loading;
  const error = state.error;
  const source = state.source;

  // 深链接无数据时自动拉取
  useEffect(() => {
    if (!data && !loading) fetchRemoteData(type);
  }, [type, data, loading, fetchRemoteData]);

  // 切换彩种时清空选号
  useEffect(() => {
    setCustomTickets([{ front: [], back: [] }]);
    setImportText("");
    setImportErrors([]);
  }, [type]);

  /** 最新一期开奖（顶部展示 + 高亮参照） */
  const latestItem: LotteryItem | null = data && data.items.length > 0 ? data.items[0] : null;
  const latestFront = new Set(latestItem?.front_numbers ?? []);
  const latestBack = new Set(latestItem?.back_numbers ?? []);

  /** 用户输入号码聚合：出现集合 + 频次 */
  const { frontSet, backSet, frontFreq, backFreq } = useMemo(() => {
    const fs = new Set<string>();
    const bs = new Set<string>();
    const ff = new Map<string, number>();
    const bf = new Map<string, number>();
    for (const t of customTickets) {
      for (const n of t.front) { if (!n) continue; fs.add(n); ff.set(n, (ff.get(n) ?? 0) + 1); }
      for (const n of t.back) { if (!n) continue; bs.add(n); bf.set(n, (bf.get(n) ?? 0) + 1); }
    }
    return { frontSet: fs, backSet: bs, frontFreq: ff, backFreq: bf };
  }, [customTickets]);

  const hasInput = frontSet.size > 0 || backSet.size > 0;
  const maxFrontFreq = Math.max(1, ...Array.from(frontFreq.values()));
  const maxBackFreq = Math.max(1, ...Array.from(backFreq.values()));

  /** 前区十位分组：枚举 frontCount 个号码分到各十位组的所有分布模式，标注用户输入中出现的模式 */
  const { allPatterns, appearedMap, groupLabels, patternTotal, patternCapped } = useMemo(() => {
    const numGroups = Math.floor(rule.frontMax / 10) + 1;
    // 分组标签（0x/1x/2x/3x…）
    const labels: string[] = [];
    for (let g = 0; g < numGroups; g++) {
      const lo = g * 10;
      const hi = Math.min(g * 10 + 9, rule.frontMax);
      labels.push(lo === hi
        ? `${String(lo).padStart(2, "0")}`
        : `${String(lo).padStart(2, "0")}-${String(hi).padStart(2, "0")}`);
    }
    // 生成 frontCount 拆成 numGroups 份的所有非负整数组合（ Stars & Bars ）
    const gen = (n: number, k: number): number[][] => {
      if (k === 1) return [[n]];
      const res: number[][] = [];
      for (let i = 0; i <= n; i++) {
        for (const rest of gen(n - i, k - 1)) res.push([i, ...rest]);
      }
      return res;
    };
    const all = gen(rule.frontCount, numGroups);
    const CAP = 120;
    const capped = all.length > CAP;
    // 统计用户每注（前区正好 frontCount 个号码）的分布模式
    const appeared = new Map<string, number>();
    for (const t of customTickets) {
      if (t.front.length !== rule.frontCount) continue;
      const counts = new Array(numGroups).fill(0);
      for (const n of t.front) counts[Math.floor(Number(n) / 10)]++;
      const key = counts.join("-");
      appeared.set(key, (appeared.get(key) ?? 0) + 1);
    }
    return {
      allPatterns: capped ? [] : all,
      appearedMap: appeared,
      groupLabels: labels,
      patternTotal: all.length,
      patternCapped: capped,
    };
  }, [customTickets, rule.frontCount, rule.frontMax]);

  const newEmptyTicket = (): LotteryTicket => ({ front: [], back: [] });

  const handleToggleNumber = (ticketIndex: number, numType: "front" | "back", number: string) => {
    setCustomTickets(customTickets.map((ticket, idx) => {
      if (idx !== ticketIndex) return ticket;
      const arr = ticket[numType];
      if (arr.includes(number)) {
        return { ...ticket, [numType]: arr.filter((n) => n !== number) };
      }
      const maxCount = numType === "front" ? rule.frontMax : rule.backMax;
      if (arr.length >= maxCount) return ticket;
      return { ...ticket, [numType]: [...arr, number].sort((a, b) => Number(a) - Number(b)) };
    }));
  };

  const handleClearTicket = (index: number) => {
    setCustomTickets(customTickets.map((t, i) => (i === index ? newEmptyTicket() : t)));
  };
  const handleRemoveTicket = (index: number) => {
    setCustomTickets(customTickets.filter((_, i) => i !== index));
  };

  const handleImportText = () => {
    if (!importText.trim()) { setImportErrors(["请先输入号码文本"]); return; }
    const { tickets, errors } = parseTicketsFromText(importText, rule);
    setImportErrors(errors);
    if (tickets.length > 0) setCustomTickets(tickets);
  };

  const handleTextFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImportText(String(reader.result || ""));
        setImportErrors([]);
        setImportCollapsed(false);
      };
      reader.readAsText(file);
    }
    e.target.value = "";
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadData(type, file);
    e.target.value = "";
  };

  /** 号码在网格中的高亮状态：绿色(命中上期) > 红蓝(用户选中) > 黄色(未选未中) */
  const cellState = (num: string, zone: "front" | "back"): "hit" | "picked" | "absent" => {
    const latestSet = zone === "front" ? latestFront : latestBack;
    const pickedSet = zone === "front" ? frontSet : backSet;
    if (latestSet.has(num)) return "hit";
    if (pickedSet.has(num)) return "picked";
    return "absent";
  };

  return (
    <div className="min-h-screen">
      <div className="border-b border-ink-700/60 bg-ink-950/40">
        <div className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {rule.name}投注分布
            </h1>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">多注号码汇总分析</p>
          </div>
          <div className="mt-2">
            <div className="seg">
              {LOTTERY_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  className={cn("seg-item", activeCategory === cat.key && "seg-item-active")}
                  onClick={() => handleCategoryClick(cat.key)}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2">
            <LotterySelector
              lotteries={categoryLotteries}
              activeLottery={type}
              onSelect={(t) => navigate(`/distribution?type=${t}`)}
            />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        {loading ? (
          <div className="card text-center py-12">
            <RefreshCw className="mx-auto h-12 w-12 animate-spin text-gold mb-4" />
            <p className="text-zinc-500 dark:text-zinc-400">正在加载{rule.name}开奖数据...</p>
          </div>
        ) : error ? (
          <div className="card p-4">
            <div className="flex items-start gap-2 rounded-lg border border-crimson/40 bg-crimson/10 px-3 py-2 text-xs text-crimson-400">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="space-y-1.5">
                <div>远程数据加载失败，请手动上传数据文件。</div>
                <div className="flex flex-col gap-1">
                  <a href={DATA_REPO_URLS.github} target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline-offset-2 hover:underline">GitHub 数据仓库</a>
                  <a href={DATA_REPO_URLS.gitee} target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline-offset-2 hover:underline">Gitee 数据仓库</a>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button type="button" onClick={() => fetchRemoteData(type)} className="btn-gold">
                <RefreshCw className="h-4 w-4" /> 重新加载
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="btn">
                <Upload className="h-4 w-4" /> 手动上传
              </button>
              <input ref={fileInputRef as React.RefObject<HTMLInputElement>} type="file" accept=".json,.csv,application/json,text/csv" className="hidden" onChange={handleFileChange} />
            </div>
          </div>
        ) : !data ? (
          <div className="card p-8 text-center">
            <Target className="mx-auto h-12 w-12 text-zinc-400 mb-4" />
            <p className="mb-6 text-zinc-500 dark:text-zinc-400">暂无{rule.name}开奖数据</p>
            <div className="flex items-center justify-center gap-3">
              <button type="button" onClick={() => fetchRemoteData(type)} className="btn-gold">
                <RefreshCw className="h-4 w-4" /> 自动加载数据
              </button>
            </div>
          </div>
        ) : (
          <>
            {source && (
              <div className="card p-3 mb-4">
                {source === "remote" ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 dark:text-zinc-300">
                    <Cloud className="h-3.5 w-3.5 text-indigo-400" />
                    <span>数据来源：开源仓库</span>
                    {data.generated_at && <span className="text-zinc-600 dark:text-zinc-500">· 更新于 {data.generated_at}</span>}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-gold-300">
                    <CheckCircle2 className="h-3.5 w-3.5" /> 数据来源：本地手动上传
                  </div>
                )}
              </div>
            )}

            {/* 顶部：最新一期开奖结果 */}
            <div className="card mb-4 p-4">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-gold" />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">最新一期开奖</span>
                {latestItem && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    第 {latestItem.term} 期 · {latestItem.draw_time.slice(0, 10)}
                  </span>
                )}
                <span className="ml-auto text-[10px] text-zinc-500 dark:text-zinc-400">
                  高亮参照：与本期开奖号码相同标绿
                </span>
              </div>
              {latestItem ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {latestItem.front_numbers.map((n, i) => (
                    <LotteryBall key={`lf-${i}`} number={n} variant="front" size="md" />
                  ))}
                  {hasBack && latestItem.back_numbers.length > 0 && (
                    <>
                      <span className="mx-2 h-5 w-px bg-ink-600" />
                      {latestItem.back_numbers.map((n, i) => (
                        <LotteryBall key={`lb-${i}`} number={n} variant="back" size="md" />
                      ))}
                    </>
                  )}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">暂无开奖记录</p>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* 左侧：选号 + 文本导入 */}
              <div className="card min-w-0 p-4 lg:sticky lg:top-4 lg:self-start">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">选号区</span>
                  <span className="rounded-full bg-ink-800 px-2 py-0.5 text-xs text-zinc-400 dark:text-zinc-300">{customTickets.length}注</span>
                  <span className="ml-auto text-[10px] text-zinc-500 dark:text-zinc-400">
                    {hasBack ? `${rule.frontCount}个${rule.frontLabel} + ${rule.backCount}个${rule.backLabel} 为一注` : `${rule.frontCount}个${rule.frontLabel} 为一注`}
                  </span>
                </div>

                {/* 文本导入区 */}
                <div className="mb-4 overflow-hidden rounded-xl border border-ink-700/60 bg-ink-900/30">
                  <button
                    type="button"
                    onClick={() => setImportCollapsed((v) => !v)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-ink-800/40"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-indigo" />
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">文本导入</span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">粘贴或从文件导入多注号码</span>
                    </div>
                    {importCollapsed ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronUp className="h-4 w-4 text-zinc-500" />}
                  </button>
                  {!importCollapsed && (
                    <div className="space-y-3 border-t border-ink-700/60 p-4">
                      <textarea
                        value={importText}
                        onChange={(e) => { setImportText(e.target.value); if (importErrors.length > 0) setImportErrors([]); }}
                        placeholder={`每行一注，支持以下格式：\n${hasBack ? `${Array.from({ length: rule.frontCount }, (_, i) => i + frontMin).join(" ")} + ${Array.from({ length: rule.backCount }, (_, i) => i + backMin).join(" ")}` : Array.from({ length: rule.frontCount }, (_, i) => i + frontMin).join(" ")}`}
                        rows={5}
                        className="w-full resize-y rounded-lg border border-ink-600 bg-ink-950/60 px-3 py-2 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo focus:outline-none focus:ring-1 focus:ring-indigo dark:text-zinc-100 dark:placeholder:text-zinc-500"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={handleImportText} className="btn btn-sm bg-indigo text-white hover:bg-indigo/90">
                          <FileText className="h-3 w-3" /> 导入号码
                        </button>
                        <button type="button" onClick={() => textFileInputRef.current?.click()} className="btn btn-sm">
                          <FileUp className="h-3 w-3" /> 从文件导入
                        </button>
                        <input ref={textFileInputRef as React.RefObject<HTMLInputElement>} type="file" accept=".txt,.csv,text/plain,text/csv" className="hidden" onChange={handleTextFileChange} />
                        <button type="button" onClick={() => { setImportText(""); setImportErrors([]); }} className="btn btn-sm text-zinc-500 hover:text-crimson dark:text-zinc-400">
                          清空文本
                        </button>
                      </div>
                      {importErrors.length > 0 && (
                        <div className="rounded-lg border border-crimson/40 bg-crimson/10 px-3 py-2 text-xs text-crimson-400">
                          <div className="mb-1 flex items-center gap-1 font-medium"><AlertCircle className="h-3.5 w-3.5" /> 解析错误（{importErrors.length}行）</div>
                          <ul className="ml-4 list-disc space-y-0.5">{importErrors.slice(0, 8).map((err, i) => <li key={i}>{err}</li>)}</ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 每注选号 */}
                <div className="space-y-4">
                  {customTickets.map((ticket, ticketIdx) => {
                    const complete = ticket.front.length >= rule.frontCount && ticket.back.length >= rule.backCount;
                    return (
                      <div key={ticketIdx} className={cn("rounded-xl border bg-ink-900/30 p-4 transition-colors", complete ? "border-green-500/40" : "border-ink-700/60")}>
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="rounded-full bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">第{ticketIdx + 1}注</span>
                            {complete ? (
                              <span className="flex items-center gap-1 text-xs text-green-500"><CheckCircle2 className="h-3 w-3" /> 已选完</span>
                            ) : (
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                选{rule.frontCount}个{rule.frontLabel}{hasBack ? ` + ${rule.backCount}个${rule.backLabel}` : ""}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => handleClearTicket(ticketIdx)} className="btn btn-sm text-zinc-500 hover:text-crimson dark:text-zinc-400" title="清空本注">
                              <Trash2 className="h-3 w-3" />
                            </button>
                            {customTickets.length > 1 && (
                              <button type="button" onClick={() => handleRemoveTicket(ticketIdx)} className="btn btn-sm text-zinc-500 hover:text-crimson dark:text-zinc-400" title="删除本注">
                                <Minus className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mb-3">
                          <div className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            {rule.frontLabel} ({ticket.front.length}/{rule.frontMax})
                          </div>
                          <div className={cn("grid gap-1", lottery.pickGridCols.front)}>
                            {Array.from({ length: rule.frontMax - frontMin + 1 }, (_, i) => String(i + frontMin).padStart(2, "0")).map((num) => (
                              <button
                                key={num}
                                type="button"
                                className={cn(
                                  "flex h-8 w-8 items-center justify-center justify-self-center rounded-full text-sm font-medium transition-colors",
                                  ticket.front.includes(num) ? "bg-crimson text-white" : "bg-ink-800 text-zinc-600 hover:bg-ink-700 dark:text-zinc-300",
                                )}
                                onClick={() => handleToggleNumber(ticketIdx, "front", num)}
                              >
                                {Number(num)}
                              </button>
                            ))}
                          </div>
                        </div>
                        {hasBack && (
                          <div>
                            <div className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                              {rule.backLabel} ({ticket.back.length}/{rule.backMax})
                            </div>
                            <div className={cn("grid gap-1", lottery.pickGridCols.back)}>
                              {Array.from({ length: rule.backMax - backMin + 1 }, (_, i) => String(i + backMin).padStart(2, "0")).map((num) => (
                                <button
                                  key={num}
                                  type="button"
                                  className={cn(
                                    "flex h-8 w-8 items-center justify-center justify-self-center rounded-full text-sm font-medium transition-colors",
                                    ticket.back.includes(num) ? "bg-indigo text-white" : "bg-ink-800 text-zinc-600 hover:bg-ink-700 dark:text-zinc-300",
                                  )}
                                  onClick={() => handleToggleNumber(ticketIdx, "back", num)}
                                >
                                  {Number(num)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setCustomTickets([...customTickets, newEmptyTicket()])}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-600 py-3 text-zinc-500 transition-colors hover:border-crimson hover:text-crimson dark:text-zinc-400"
                  >
                    <Plus className="h-4 w-4" /> 添加一注
                  </button>
                </div>
              </div>

              {/* 右侧：分析结果 */}
              <div className="min-w-0 space-y-4">
                {!hasInput ? (
                  <div className="card text-center py-12">
                    <BarChart3 className="mx-auto h-10 w-10 text-zinc-400 mb-3" />
                    <p className="text-zinc-500 dark:text-zinc-400 mb-2">请在左侧选择或导入号码</p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">输入后这里会显示号码汇总、频次与分布</p>
                  </div>
                ) : (
                  <>
                    {/* 1) 号码网格：绿(命中上期) / 红蓝(选中) / 黄(未选未中) */}
                    <div className="card p-4">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">号码汇总</span>
                        <div className="ml-auto flex items-center gap-3 text-[10px]">
                          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-green-500" />命中上期</span>
                          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-crimson" />{rule.frontLabel}选中</span>
                          {hasBack && <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-indigo" />{rule.backLabel}选中</span>}
                          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-yellow-400" />未选</span>
                        </div>
                      </div>
                      <div className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">{rule.frontLabel}（{rule.frontMax - frontMin + 1}个）</div>
                      <div className={cn("grid gap-1", lottery.pickGridCols.front)}>
                        {Array.from({ length: rule.frontMax - frontMin + 1 }, (_, i) => String(i + frontMin).padStart(2, "0")).map((num) => {
                          const st = cellState(num, "front");
                          const freq = frontFreq.get(num) ?? 0;
                          return (
                            <div
                              key={num}
                              title={freq > 0 ? `${num}：出现 ${freq} 次` : num}
                              className={cn(
                                "flex h-8 w-8 items-center justify-center justify-self-center rounded-full text-sm font-medium transition-colors",
                                st === "hit" && "bg-green-500 text-white",
                                st === "picked" && "bg-crimson text-white",
                                st === "absent" && "bg-yellow-400 text-yellow-900",
                              )}
                            >
                              {Number(num)}
                            </div>
                          );
                        })}
                      </div>
                      {hasBack && (
                        <>
                          <div className="mb-2 mt-4 text-xs font-medium text-zinc-500 dark:text-zinc-400">{rule.backLabel}（{rule.backMax - backMin + 1}个）</div>
                          <div className={cn("grid gap-1", lottery.pickGridCols.back)}>
                            {Array.from({ length: rule.backMax - backMin + 1 }, (_, i) => String(i + backMin).padStart(2, "0")).map((num) => {
                              const st = cellState(num, "back");
                              const freq = backFreq.get(num) ?? 0;
                              return (
                                <div
                                  key={num}
                                  title={freq > 0 ? `${num}：出现 ${freq} 次` : num}
                                  className={cn(
                                    "flex h-8 w-8 items-center justify-center justify-self-center rounded-full text-sm font-medium transition-colors",
                                    st === "hit" && "bg-green-500 text-white",
                                    st === "picked" && "bg-indigo text-white",
                                    st === "absent" && "bg-yellow-400 text-yellow-900",
                                  )}
                                >
                                  {Number(num)}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>

                    {/* 2) 号码频次柱状图（前区+后区） */}
                    <div className="card p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-indigo" />
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">号码频次</span>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">跨所有注统计出现次数</span>
                      </div>
                      {/* 前区频次 */}
                      <div className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">{rule.frontLabel}</div>
                      <div className="flex items-end gap-0.5 overflow-x-auto pb-2" style={{ minHeight: 80 }}>
                        {Array.from({ length: rule.frontMax - frontMin + 1 }, (_, i) => String(i + frontMin).padStart(2, "0")).map((num) => {
                          const freq = frontFreq.get(num) ?? 0;
                          const h = Math.round((freq / maxFrontFreq) * 64);
                          return (
                            <div key={num} className="flex w-7 shrink-0 flex-col items-center gap-1">
                              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">{freq || ""}</span>
                              <div className="flex w-full items-end justify-center" style={{ height: 64 }}>
                                <div
                                  className={cn("w-4 rounded-t", freq > 0 ? "bg-gradient-to-t from-crimson-700 to-crimson-400" : "bg-ink-700")}
                                  style={{ height: freq > 0 ? Math.max(h, 4) : 2 }}
                                />
                              </div>
                              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">{Number(num)}</span>
                            </div>
                          );
                        })}
                      </div>
                      {hasBack && (
                        <>
                          <div className="mb-2 mt-4 text-xs font-medium text-zinc-500 dark:text-zinc-400">{rule.backLabel}</div>
                          <div className="flex items-end gap-0.5 overflow-x-auto pb-2" style={{ minHeight: 80 }}>
                            {Array.from({ length: rule.backMax - backMin + 1 }, (_, i) => String(i + backMin).padStart(2, "0")).map((num) => {
                              const freq = backFreq.get(num) ?? 0;
                              const h = Math.round((freq / maxBackFreq) * 64);
                              return (
                                <div key={num} className="flex w-7 shrink-0 flex-col items-center gap-1">
                                  <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">{freq || ""}</span>
                                  <div className="flex w-full items-end justify-center" style={{ height: 64 }}>
                                    <div
                                      className={cn("w-4 rounded-t", freq > 0 ? "bg-gradient-to-t from-indigo-700 to-indigo-400" : "bg-ink-700")}
                                      style={{ height: freq > 0 ? Math.max(h, 4) : 2 }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">{Number(num)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>

                    {/* 3) 前区十位分组分布：列出所有可能性，已出现标金、未出现标灰 */}
                    <div className="card p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-gold" />
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{rule.frontLabel}十位分组分布</span>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">所有可能性 · 出现/未出现区分</span>
                      </div>
                      {/* 分组标签说明 */}
                      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                        <span>分组：</span>
                        {groupLabels.map((l, i) => (
                          <span key={i} className="rounded bg-ink-900/60 px-1.5 py-0.5 font-mono">{i}:{l}</span>
                        ))}
                      </div>
                      {/* 图例 */}
                      <div className="mb-3 flex items-center gap-3 text-[10px] text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-gold" />已出现</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-ink-700" />未出现</span>
                      </div>
                      {patternCapped ? (
                        <div>
                          <p className="mb-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                            共 {patternTotal} 种可能性，数量过多仅显示已出现的组合：
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {Array.from(appearedMap.entries()).map(([key, cnt]) => (
                              <span key={key} className="rounded-md bg-gold px-2 py-1 font-mono text-xs font-bold text-zinc-900">
                                {key} ×{cnt}
                              </span>
                            ))}
                            {appearedMap.size === 0 && (
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">暂无完整选号（每注需选满 {rule.frontCount} 个{rule.frontLabel}）</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {allPatterns.map((p, i) => {
                            const key = p.join("-");
                            const cnt = appearedMap.get(key) ?? 0;
                            return (
                              <span
                                key={i}
                                title={cnt > 0 ? `出现 ${cnt} 次` : "未出现"}
                                className={cn(
                                  "rounded-md px-2 py-1 font-mono text-xs font-bold transition-colors",
                                  cnt > 0 ? "bg-gold text-zinc-900" : "bg-ink-800 text-zinc-500 dark:text-zinc-500",
                                )}
                              >
                                {key}{cnt > 0 ? ` ×${cnt}` : ""}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      <p className="mt-3 text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                        按{rule.frontLabel}号码十位分组，列出 {rule.frontCount} 个号码在各组分布的所有可能组合（共 {patternTotal} 种，各组次数之和为 {rule.frontCount}）。已出现的标金、未出现的标灰。
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
