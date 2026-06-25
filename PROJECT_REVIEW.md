# 彩运项目代码审查报告

> 审查时间:2026-06-25
> 基线:`main` @ `ac103ed`(含 PR #18–#22 全部已合并改动)
> 审查范围:`src/` 全部 21 个源文件 + 配置文件

## 检查总览

| 检查项 | 结果 |
|--------|------|
| TypeScript 类型检查 (`tsc -b --noEmit`) | ✅ 通过 |
| 依赖安全审计 (`pnpm audit`) | ✅ 无已知漏洞 |
| ESLint | ❌ 2 errors + 1 warning(既有问题) |
| 构建产物 | ⚠️ JS 781KB(gzip 206KB),recharts 占大头,建议代码分割 |
| XSS / 注入风险 | ✅ 无 `dangerouslySetInnerHTML`/`eval`/`innerHTML`,React 默认转义 |
| localStorage | ✅ 仅存主题偏好,无敏感数据 |

---

## 🔴 严重问题(可能导致崩溃 / 数据错误 / 安全问题)

### 1. 遗漏走势图数据计算错误,折线永远只显示 0/1

- **文件**:`src/components/FullNumberTrendChart.tsx:88-91`
- **问题**:`miss` 走势的 `chartData` 在每条 row 内自引用 `row[\`m${n}\`]`,但 row 每次新建,该键恒为 `undefined`,`undefined + 1 = NaN`,`NaN || 1 = 1`。非命中号码遗漏值永远为 1,命中为 0,**遗漏走势折线图是一条 0/1 平线,完全没有累计遗漏期数**。
  > 注:同文件 `missData` useMemo(130-158 行)用了正确的累计算法,底部"当前遗漏期数"面板正常,但上方折线图错误。
- **修复**:遗漏累计应在 useMemo 内维护跨条目的累计字典,参照 130-158 行 `missData` 实现。

### 2. URL 参数 `type` 未校验,非法值整页崩溃

- **文件**:`src/pages/TrendDetail.tsx:14-16`、`src/pages/MatchResultPage.tsx:262,271`
- **问题**:`as LotteryType` 只是编译期断言,运行时无校验。访问 `/trend/abc` 或 `/match?type=xxx` 时 `LOTTERY_RULES[type]` 为 `undefined`,后续 `rule.name` 抛 `TypeError`,白屏崩溃。
- **修复**:加运行时白名单校验,非法值回退到默认彩种。

### 3. `JSON.parse(ticketsJson)` 无 try/catch,畸形 URL 崩溃

- **文件**:`src/pages/MatchResultPage.tsx:264-266`
- **问题**:用户篡改 URL(如 `/match?tickets=not-json`)触发 `JSON.parse` 抛错,且在组件体顶层每次渲染都执行,无容错。
- **修复**:try/catch 包裹 + `useState(() => ...)` lazy initializer。

### 4. `useTheme` 多实例状态不同步,主题切换后图表颜色不更新

- **文件**:`src/hooks/useTheme.ts:48-86`
- **问题**:`useTheme` 被 ThemeToggle、TrendChart、FullNumberTrendChart 分别调用,各自维护独立 state。用户在 ThemeToggle 切换主题后,图表组件的 `isDark` 不更新,出现"深色背景 + 浅色网格"视觉错乱,直到路由切换重新挂载。
- **修复**:主题状态抽到全局单例(zustand store 或 Context + useSyncExternalStore),所有组件订阅同一份状态。

### 5. 远程 fetch / 文件 upload 无竞态控制,并发互相覆盖

- **文件**:`src/store/lotteryStore.ts:51-93`、`100-137`
- **问题**:无请求序号或 AbortController。连点刷新多个 fetch 并发返回后返回者覆盖;fetch 与 upload 之间无互斥,远程请求后返回会覆盖用户刚上传的本地数据。
- **修复**:引入请求序号 token,set 前判断是否最新一次;或用 AbortController。

---

## 🟡 中等问题(性能 / 代码质量 / 可维护性)

### 6. MatchResultPage 大量计算未 memo,每渲染重复执行

- **文件**:`src/pages/MatchResultPage.tsx:359-361,832-933`
- **问题**:`calculateMatches` 对每注每渲染算 2 次(统计区 + 列表区),最坏遍历几千条;`grandTotal`/`bestPrize`/`getFilteredData().length` 也每次重算。
- **修复**:用 `useMemo` 缓存 `totalMatches`,下游派生复用。

### 7. ESLint 2 errors + 1 warning

| 文件 | 行 | 规则 | 修复 |
|------|----|------|------|
| `FullNumberTrendChart.tsx` | 132 | `prefer-const` | `let currentMiss` → `const currentMiss` |
| `LotteryPanel.tsx` | 37 | `no-unused-vars` | 删除未使用的 `accentBg` |
| `MatchResultPage.tsx` | 356 | `exhaustive-deps` | `getPrizeLevel` 加入依赖或提取为纯函数 |

### 8. TrendChart 与 FullNumberTrendChart 大量重复代码

- PALETTE、chartColors、TrendType/LABELS、getChartLines(sum/parity 分支)、getYAxisDomain 均重复。
- **修复**:抽取共用模块(palette、trendTypes、useTrendChartData、LineConfig)。

### 9. exportAsImage 两处重复实现

- `RandomGenerator.tsx:17-136` 与 `MatchResultPage.tsx:94-245` 80% 相同。
- **修复**:抽到 `src/utils/exportTickets.ts`。

### 10. RandomGenerator.exportAsImage 中 if/else 分支完全相同(dead code)

- **文件**:`src/components/RandomGenerator.tsx:72-78`
- 前区球渐变色对 dlt/ssq 完全相同,`isDlt` 判断无效。

### 11. fetch/upload 成功后强制重置 currentPage 为 1

- **文件**:`src/store/lotteryStore.ts:67-78,112-122`
- 用户翻到第 5 页刷新,页码丢失。应保留或 clamp。

### 12. sortDesc 用 Number(term) 排序,非数字 term 不稳定

- **文件**:`src/store/lotteryStore.ts:160-166`
- `Number("2024-001")` = NaN,sort 返回 NaN 视作 0,结果不确定。需 NaN 兜底。

### 13. useTheme 中 localStorage 读写无 try/catch

- **文件**:`src/hooks/useTheme.ts:23,58`
- 无痕模式/配额满/隐私插件会抛 SecurityError,首次渲染即白屏。

### 14. LotteryPanel 子组件未 memo,父级任意 state 变化触发重渲染

- RandomGenerator 不依赖 store 数据却因父渲染而重渲染。建议 `React.memo`。

### 15. FullNumberTrendChart 热力图 1750 个 DOM 节点

- 50 行 × 35 列 `<div>`,低端设备卡顿。建议改 canvas/SVG。

### 16. MatchResultPage 列表重复调用 getPrizeLevel

- `src/pages/MatchResultPage.tsx:869` 已有 `m.prize` 却重算。

---

## 🟢 轻微问题(风格 / 优化建议)

| # | 文件 | 问题 |
|---|------|------|
| 17 | `dataParser.ts:45` | 三元运算符两分支相同,可简化 |
| 18 | `LotteryList.tsx:84` | key 含 index,弱化 reconciliation,`item.term` 已唯一 |
| 19 | `TrendChart.tsx:78,84` | `toFixed()` 返回字符串混入 number 类型,tooltip 可能异常 |
| 20 | `lottery.ts:43-51` | `pickNumbers` 缺 `count > max` 防御,无限循环风险 |
| 21 | `useLotteryData.ts:8-10` | StrictMode 下双重 fetch(开发期) |
| 22 | `FullNumberTrendChart.tsx:136-153` | `result` 对象冗余,可直接用 `currentMiss` |
| 23 | `dataParser.ts:30-41` | `normalizeItem` 不校验号码个数,脏数据致图表断点 |
| 24 | `TrendDetail.tsx:20-24` | useEffect 依赖含 `state.data/loading`,多余触发 |
| 25 | `MatchResultPage.tsx` | 深链接无数据时不自动加载,与 TrendDetail 行为不一致 |
| 26 | `useTheme.ts:53` | 渲染期间写 `themeRef.current`,反模式,应放 useEffect |
| 27 | `tsconfig.json:19-24` | `strict: false`,掩盖多处类型问题,建议逐步开启 |

---

## 优先级建议

**应尽快修复**(影响功能正确性 / 稳定性):
1. 🔴 #1 遗漏走势计算错误(功能失效)
2. 🔴 #2 URL type 未校验(崩溃)
3. 🔴 #3 JSON.parse 无容错(崩溃)
4. 🔴 #4 主题多实例不同步(视觉错乱)
5. 🟡 #7 ESLint 2 errors(快速修复)

**中期改进**(性能 / 可维护性):
6. 🟡 #6 MatchResultPage 计算 memo 化
7. 🟡 #5 fetch/upload 竞态控制
8. 🟡 #8/#9 重复代码抽取

**长期优化**:
9. 🟡 #11 刷新保留页码、🟢 #27 开启 strict
10. 🟡 #15 热力图 canvas 化
