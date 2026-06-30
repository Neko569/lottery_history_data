# 彩种扩展性重构清单

> 目标：让新增一个彩种（如七乐彩、福彩 3D、排列三/五等）只需在「彩种注册表」中追加一条配置，无需散落修改各处 `if (type === "dlt")` / `if (type === "ssq")` 分支。
> 基线分支：`main` @ `a75eb30`
> 重构分支：`refactor/lottery-extensibility`

## 设计原则

1. **单一数据源（Single Source of Truth）**：所有彩种相关配置（规则、奖级表、数据源、套餐票、颜色、网格列等）集中到一个 `LOTTERIES` 注册表。
2. **派生而非硬编码**：`LotteryType` 联合类型、`isLotteryType`、`Object.keys` 遍历等均从注册表派生，新增彩种不再需要修改类型守卫。
3. **配置驱动 UI**：彩种切换按钮、Logo、奖级配色、备注说明等由注册表配置驱动，UI 组件保持彩种无关。
4. **保持现有数据模型**：`LotteryItem` 的 `front_numbers/back_numbers` 结构维持不变（当前两彩种均符合「前后区」模型），避免引入过度抽象；后续若出现单区彩种再单独评估。

---

## 待优化清单

### P0 — 基础类型与注册表（扩展性根基）

- [x] **1. 建立中心化彩种注册表 `LOTTERIES`**
  - 现状：彩种配置散落在 `LOTTERY_RULES` / `PRIZE_TABLE` / `REMOTE_JSON_URLS` / `GITEE_CSV_URLS` / `DATA_REPO_URLS` 等多个 `Record<LotteryType, ...>` 常量中，新增彩种要在多处补条目，易遗漏。
  - 方案：在 `src/utils/lottery.ts` 新增 `LOTTERIES` 注册表，把上述配置按彩种聚合为单一对象；保留原有导出名作向后兼容别名（由注册表派生），减少调用方改动。
  - 影响文件：`src/utils/lottery.ts`

- [x] **2. `LotteryType` 与 `isLotteryType` 从注册表派生**
  - 现状：`LotteryType = "dlt" | "ssq"` 硬编码；`isLotteryType` 写死 `value === "dlt" || value === "ssq"`，新增彩种不会被识别为合法。
  - 方案：`LotteryType` 改为 `keyof typeof LOTTERIES`；`isLotteryType` 改为 `Object.prototype.hasOwnProperty.call(LOTTERIES, value)`。
  - 影响文件：`src/types/lottery.ts`、`src/utils/lottery.ts`

### P1 — Store 动态化

- [x] **3. `lotteryStore` 中 `states` / `reqTokens` / `fetchAllRemote` 动态化**
  - 现状：`states: { dlt: {...}, ssq: {...} }`、`reqTokens: { dlt: 0, ssq: 0 }`、`fetchAllRemote` 内 `Promise.all([fetchRemoteData("dlt"), fetchRemoteData("ssq")])`、`setPageSize` 内 `dlt/ssq` 分别重置页码 —— 全部硬编码两个彩种。
  - 方案：用 `Object.fromEntries(Object.keys(LOTTERIES).map(...))` 初始化 `states` 与 `reqTokens`；`fetchAllRemote` 与 `setPageSize` 改为遍历注册表 key。
  - 影响文件：`src/store/lotteryStore.ts`

### P1 — 彩种切换 UI 动态化

- [x] **4. `SplitView` / `TrendDetail` / `MatchResultPage` 彩种切换按钮动态化**
  - 现状：
    - `SplitView` 硬编码 `<LotteryPanel type="dlt" />` 与 `type="ssq"`；
    - `TrendDetail` 维护 `TREND_TYPES: LotteryType[] = ["dlt", "ssq"]`；
    - `MatchResultPage` 顶部硬编码两个 `navigate(/match?type=dlt)` / `?type=ssq` 按钮，文案写死「大乐透/双色球」。
  - 方案：统一从注册表 key 列表渲染切换按钮，文案取 `rule.name`；`SplitView` 改为遍历渲染所有彩种面板。
  - 影响文件：`src/components/SplitView.tsx`、`src/pages/TrendDetail.tsx`、`src/pages/MatchResultPage.tsx`

### P2 — 配置驱动的视觉资源

- [x] **5. `LotteryLogo` 改为配置驱动**
  - 现状：`if (type === "dlt") { <svg>...大乐透... } else { <svg>...双色球... }`，每加一个彩种需手写一个 SVG 分支。
  - 方案：在注册表中为每个彩种提供 logo 配置（渐变色、上行文字、主名、下行号码范围文案），`LotteryLogo` 按 config 渲染统一 SVG 模板。
  - 影响文件：`src/utils/lottery.ts`（注册表扩展）、`src/components/LotteryLogo.tsx`

- [x] **6. `PRIZE_COLORS` / 套餐票 / 奖级备注 配置化**
  - 现状：
    - `PRIZE_COLORS` 以中文奖级名（"一等奖"…）为 key，全局共享，无法按彩种区分；且写死了"八等奖/九等奖"等当前两彩种用不到的级别。
    - `DLT_PACKAGES`（大乐透套餐票）硬编码在 `MatchResultPage` 顶层，且用 `type === "dlt"` 控制显隐。
    - 奖级表底部 `type === "dlt"` / `type === "ssq"` 各写一条新规备注。
  - 方案：将 `prizeColors`、`packages`、`ruleNote` 收入注册表每个彩种条目；`MatchResultPage` 通过 `LOTTERIES[type].packages` 渲染套餐区，无套餐则不渲染；备注同理。
  - 影响文件：`src/utils/lottery.ts`、`src/pages/MatchResultPage.tsx`、`src/types/lottery.ts`

### P2 — 导出图片颜色逻辑

- [x] **7. `exportAsImage` 颜色逻辑改配置驱动，消除 `isDlt` 硬编码**
  - 现状：`RandomGenerator.exportAsImage` 与 `MatchResultPage.exportAsImage` 均用 `isDlt = type === "dlt"` 决定前后区球渐变色，且两处 `if (isDlt) {...} else {...}` 前区分支完全相同（dead code）；后区颜色对 dlt/ssq 写死不同色值。
  - 方案：在注册表为每个彩种配置 `frontBallColors` / `backBallColors`（渐变起止色），`exportAsImage` 按 config 取色；顺便消除 dead code。同时两处 `exportAsImage` 重复实现，可抽到 `src/utils/exportTickets.ts` 统一。
  - 影响文件：`src/utils/lottery.ts`、`src/components/RandomGenerator.tsx`、`src/pages/MatchResultPage.tsx`、（可选新增 `src/utils/exportTickets.ts`）

### P3 — 剩余硬编码清理

- [x] **8. `PICK_GRID_COLS` / `accent` 体系等剩余硬编码清理**
  - 现状：
    - `PICK_GRID_COLS: Record<LotteryType, { front: string; back: string }>` 在 `MatchResultPage` 顶层硬编码两彩种网格列数；
    - `LotteryRule.accent: "crimson" | "indigo"` 仅两色，新彩种需扩枚举；
    - `LotteryPanel` / `LotteryList` 中 `rule.accent === "crimson" ? ... : ...` 三元判断实为两彩种分支。
  - 方案：把 `pickGridCols` 收入注册表；`accent` 仍保留为彩种主题色键，但相关样式分支改为查表（`accentText/accentBorder` 映射表）而非 if/else，新增 accent 时只扩映射表。
  - 影响文件：`src/utils/lottery.ts`、`src/pages/MatchResultPage.tsx`、`src/components/LotteryPanel.tsx`、`src/components/LotteryList.tsx`、`src/types/lottery.ts`

---

## 验证标准

每完成一项优化：
1. `npx tsc -b --noEmit` 类型检查通过；
2. `npm run build` 构建通过；
3. 同步勾选本清单对应项并 `git commit`。

全部完成后：模拟「新增一个彩种」只改 `LOTTERIES` 注册表即可生效，作为扩展性验收。

---

## 进度记录

（每完成一项在此追加一行：`- YYYY-MM-DD 完成项 N — commit <sha>`）
- 2026-06-30 前置 chore：移除 tsconfig 已弃用的 `baseUrl`（TS 6.0 下阻断类型检查），`paths` 在 `moduleResolution: bundler` 下无需 baseUrl
- 2026-06-30 完成项 1 — 建立中心化彩种注册表 `LOTTERIES`，`LOTTERY_RULES`/`PRIZE_TABLE`/`REMOTE_JSON_URLS`/`GITEE_CSV_URLS`/`getPrizeLevels`/`getPrizeTierByMatch` 均改为由注册表派生
- 2026-06-30 完成项 2 — `LotteryType` 改为 `keyof typeof LOTTERIES`（types/lottery.ts 改为 re-export，避免调用方改 import）；`isLotteryType` 改为基于注册表 `hasOwnProperty` 判断
- 2026-06-30 完成项 3 — `lotteryStore` 的 `states`/`reqTokens`/`activeLottery` 初值/`fetchAllRemote`/`setPageSize` 全部改为遍历 `LOTTERY_TYPES` 派生，新增彩种自动纳入
- 2026-06-30 完成项 4 — `SplitView` 遍历 `LOTTERY_TYPES` 渲染面板；`TrendDetail` 删除 `TREND_TYPES` 改用 `LOTTERY_TYPES`；`MatchResultPage` 顶部彩种切换按钮改为遍历渲染、文案取 `rule.name`
- 2026-06-30 完成项 5 — 注册表新增 `logo`（topText/gradientFrom/gradientTo/rangeColor）配置；`LotteryLogo` 改为按 `LOTTERIES[type].logo` + `rule.name/rule.frontMax/rule.backMax` 统一渲染 SVG，消除 `if (type === "dlt")` 分支；渐变 id 按 type 命名避免同页冲突
- 2026-06-30 完成项 6 — `PRIZE_COLORS`/`DLT_PACKAGES`/奖级备注从 MatchResultPage 移入注册表：新增 `PrizeColor`/`LotteryPackage`/`LotteryPackagePart` 类型与共享 `PRIZE_LEVEL_COLORS` 调色板；`LotteryConfig` 新增 `prizeColors`/`packages?`/`ruleNote?`；组件内 `const lottery = LOTTERIES[type]` 派生 `PRIZE_COLORS`/`PACKAGES`/`ruleNote`，套餐区与备注条改为按配置有无渲染，消除 `type === "dlt"/"ssq"` 分支
- 2026-06-30 完成项 7 — 新增 `src/utils/exportTickets.ts` 统一 `exportTicketsToImage` + `isCompoundTicket`，前后区球渐变改读 `LOTTERIES[type].frontBallColors/backBallColors`，消除 `isDlt` 与 RandomGenerator 中前区 dead code；RandomGenerator/MatchResultPage 两处重复 `exportAsImage` 删除改为调用 util，包体减小约 2KB
- 2026-06-30 完成项 8 — `PICK_GRID_COLS` 移入注册表 `pickGridCols`（MatchResultPage 改用 `lottery.pickGridCols`）；新增 `ACCENT_STYLES` 映射表与派生 `Accent` 类型，`LotteryRule.accent` 改为 `Accent`（新增主题色只扩映射表）；`LotteryPanel`/`LotteryList` 的 `rule.accent === "crimson" ? ... : ...` 三元改为查表，消除彩种分支
- 2026-06-30 扩展性验收 — `src/` 全局已无 `=== "dlt"`/`=== "ssq"`/`isDlt` 硬编码；模拟新增第三彩种「demo」仅向 `LOTTERIES` 追加一条 `demoConfig` 即 `tsc -b --noEmit` 通过（LotteryType 联合、LOTTERY_RULES/PRIZE_TABLE 等派生导出、store states/reqTokens/fetchAllRemote、SplitView/MatchResultPage 切换按钮均自动纳入），验证后已回退，工作树干净
