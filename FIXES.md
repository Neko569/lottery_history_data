# 代码审查跟进：待修复问题清单

> 基线：`main` @ `1472952`（含 PR #37 彩种扩展性重构）
> 分支：`fix/code-review-followup`
> 范围：对照 `PROJECT_REVIEW.md` 复核，剔除已修复项，聚焦仍存在的小问题与 ESLint 报错。
> 原则：只修真实 bug 与明确改进，不引入大重构（重复代码抽取、热力图 canvas 化等留待后续）。

## 已确认修复（无需再动）

- 🔴 #1 遗漏走势计算错误（FullNumberTrendChart `missCount` 已跨条目累计）
- 🔴 #2 URL `type` 未校验（已用 `toLotteryType` 运行时校验 + 回退）
- 🔴 #3 `JSON.parse(ticketsJson)` 无容错（已 try/catch + lazy `useState` 初始化）
- 🔴 #4 `useTheme` 多实例不同步（已抽 zustand 全局单例）
- 🔴 #5 fetch/upload 无竞态控制（已引入 `reqTokens` 互斥）
- 🟡 #9 exportAsImage 两处重复（已抽 `exportTickets.ts`）
- 🟡 #10 isDlt dead code（已随 #9 清理）
- 🟢 #13 useTheme localStorage 无 try/catch（已加）
- 🟢 #26 渲染期写 themeRef（已随 useTheme 重写移除）

---

## 待修复清单

### P1 — ESLint 报错（构建卫生）

- [x] **1. MatchResultPage 未使用导入 `LotteryType`**
  - 现状：`src/pages/MatchResultPage.tsx:4` `import type { LotteryType, ... }`，重构后 `LotteryType` 已无引用，ESLint `no-unused-vars` error。
  - 方案：从 import 中删除 `LotteryType`。
  - 影响文件：`src/pages/MatchResultPage.tsx`

- [x] **2. lotteryStore `fetchRemoteData` 中 `source` 解构未使用**
  - 现状：`const { data, source } = await fetchWithFallback(type)`，`source` 从未读取（仅 `data` 用于 set），ESLint `no-unused-vars` error。
  - 方案：改为 `const { data } = ...`。
  - 影响文件：`src/store/lotteryStore.ts`

### P1 — 性能 / 正确性

- [ ] **3. MatchResultPage `calculateMatches` 每渲染重算 2 次 + 列表内重复调用 `getPrizeLevel`**
  - 现状：
    - `totalMatches`（约 250 行）`customTickets.map(calculateMatches)` 每渲染重算；
    - 列表渲染（约 1070 行）又对每注 `calculateMatches(ticket)` 再算一次；
    - 列表内（约 1127 行）已有 `m.prizeLevel` 却再次 `getPrizeLevel(m.frontMatch, m.backMatch)` 重算。
    最坏情况每注每渲染算 2 次全量遍历（数千期）。
  - 方案：`useMemo` 缓存 `totalMatches`；列表渲染直接复用 `totalMatches[ticketIdx]`，删除列表内的二次 `calculateMatches` 与 `getPrizeLevel` 重算。同时消除 `useCallback` exhaustive-deps 警告。
  - 影响文件：`src/pages/MatchResultPage.tsx`

- [ ] **4. MatchResultPage 深链接无数据时不自动加载（与 TrendDetail 行为不一致）**
  - 现状：直接访问 `/match?type=ssq` 且 store 无数据时，页面不触发 `fetchRemoteData`，对比区空白；TrendDetail 有 mount 时自动拉取的 `useEffect`，两者行为不一致。
  - 方案：在 MatchResultPage 加 `useEffect`，`state.data` 为空且非 loading 时触发 `fetchRemoteData(type)`，与 TrendDetail 对齐。
  - 影响文件：`src/pages/MatchResultPage.tsx`

### P2 — 健壮性 / 可维护性

- [ ] **5. LotteryList 列表 key 含 index，弱化 reconciliation**
  - 现状：`src/components/LotteryList.tsx:84` `key={`${item.term}-${idx}`}`，`item.term` 已唯一，拼接 index 反而阻碍 React 复用。
  - 方案：改为 `key={String(item.term)}`。
  - 影响文件：`src/components/LotteryList.tsx`

- [ ] **6. `pickNumbers` 缺 `count > max` 防御，配置错误时无限循环**
  - 现状：`src/utils/lottery.ts` `while (pool.size < count)` 在 `[1,max]` 抽 `count` 个不重复号；若调用方误传 `count > max`，`Set` 永远凑不齐，死循环卡死页面。
  - 方案：函数入口 clamp `count = Math.min(count, max)`，并在 `count <= 0` 时直接返回 `[]`。
  - 影响文件：`src/utils/lottery.ts`

---

## 验证标准

每完成一项：
1. `npx tsc -b --noEmit` 通过；
2. `npm run build` 通过；
3. ESLint 问题数不增加（目标：清零 P1 的 2 个 error）；
4. 同步勾选本清单并 `git commit` + 推送。

## 进度记录

（每完成一项追加一行：`- YYYY-MM-DD 完成项 N — commit <sha>`）
- 2026-06-30 完成项 1 — 删除 MatchResultPage 未使用的 `LotteryType` 导入，消除 ESLint error
- 2026-06-30 完成项 2 — lotteryStore `fetchRemoteData` 解构去掉未使用的 `source`，消除 ESLint error
