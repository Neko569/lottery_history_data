# 彩运 · 彩票开奖历史查询

一个可部署于 GitHub Pages 的纯前端彩票开奖历史查询、随机选号与中奖对比分析网页。

## 功能特性

- **8 大彩种**：覆盖体育彩票与福利彩票两大类
  - 体彩：大乐透、七星彩、排列三、排列五
  - 福彩：双色球、福彩3D、七乐彩、快乐八
- **设备自适应**：自动识别 PC/移动端，移动端长彩种列表收进「更多」抽屉
- **开奖历史**：按期号倒序展示，支持分页（10/25/50/100 条/页）
- **走势分析**：
  - 位置走势折线图（前区/后区可切换）
  - 遗漏走势、和值走势、奇偶/大小/质合走势
  - 号码出现频率柱状图（高度按号码个数自适应）
  - 热力图展示近期 50 期各号码命中情况
- **对比分析**：选号后与历史数据匹配，自动算出最高奖级与中奖明细
- **多种选号方式**：
  - 手动网格选号（支持复式）
  - 一键随机生成（可指定「随机到指定奖级再停止」）
  - 文本批量导入（支持 `+` 分隔前后区或纯号码列表）
  - 大乐透套餐票（18/28/58/88 元固定面值组合）
- **中奖高亮**：按彩种规则区分按位匹配（七星彩/排列三/排列五/福彩3D）与集合匹配（大乐透/双色球/七乐彩/快乐八）
- **主题切换**：支持浅色/深色主题
- **导出图片**：选号结果可导出为 PNG 长图
- **数据源兜底**：默认拉取开源仓库数据，GitHub 失败时自动切换 jsDelivr 镜像，支持手动上传 JSON

## 技术栈

- React 18 + TypeScript
- Vite 6
- Tailwind CSS 3
- Recharts（图表）
- Zustand（状态管理）
- React Router 7（路由）
- Lucide React（图标）

## 数据来源

默认使用 [Neko569/get_lottery_data](https://github.com/Neko569/get_lottery_data) 开源数据，GitHub raw 失败时自动回退到 jsDelivr CDN 镜像。

## 部署

项目已配置 GitHub Actions 自动部署到 GitHub Pages：

1. 推送到 `main` 分支自动触发部署
2. 访问：https://neko569.github.io/lottery_history_data/

## 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm run dev

# 构建生产版本
pnpm run build

# 代码检查
pnpm run lint
```

## 项目结构

```
src/
├── components/               # UI 组件
│   ├── ControlBar.tsx           # 顶部控制栏 + LotterySelector 彩种选择器
│   ├── Navbar.tsx               # 导航栏
│   ├── LotteryPanel.tsx         # 彩种面板（选号网格）
│   ├── LotteryList.tsx          # 开奖历史列表
│   ├── LotteryBall.tsx          # 号码球（支持高亮）
│   ├── LotteryLogo.tsx          # 彩种 Logo
│   ├── Pagination.tsx           # 分页器
│   ├── TrendChart.tsx           # 走势折线图
│   ├── FullNumberTrendChart.tsx # 完整号码走势图（位置/遗漏/和值/奇偶/大小/质合/频率/热力）
│   ├── SplitView.tsx            # 分屏对比视图
│   ├── RandomGenerator.tsx      # 随机生成器
│   └── ThemeToggle.tsx          # 主题切换
├── pages/                    # 页面
│   ├── Home.tsx                 # 首页（开奖历史 + 走势 + 随机选号）
│   ├── TrendDetail.tsx          # 完整走势二级页面
│   └── MatchResultPage.tsx      # 对比分析页（选号 vs 历史匹配）
├── store/                    # 状态管理
│   └── lotteryStore.ts
├── hooks/                    # 自定义 Hooks
│   ├── useDeviceDetect.ts
│   ├── useLotteryData.ts
│   └── useTheme.ts
├── utils/                    # 工具函数
│   ├── lottery.ts               # 彩种注册表（唯一数据源）+ 奖级表 + 匹配算法
│   ├── dataParser.ts
│   └── exportTickets.ts         # 选号结果导出为 PNG
└── types/                    # 类型定义
    └── lottery.ts
```

## 彩种规则

彩种配置集中在 [src/utils/lottery.ts](src/utils/lottery.ts) 的 `LOTTERIES` 注册表中，新增彩种只需追加一条配置即可。

| 彩种 | 类别 | 前区/号码 | 后区/特别号 | 匹配方式 |
|------|------|-----------|-------------|----------|
| 大乐透 | 体彩 | 5 个，01-35 | 2 个，01-12 | 集合匹配 |
| 七星彩 | 体彩 | 6 位，0-9 | 1 位，0-14 | 按位匹配 |
| 排列三 | 体彩 | 3 位，0-9 | — | 按位匹配 |
| 排列五 | 体彩 | 5 位，0-9 | — | 按位匹配 |
| 双色球 | 福彩 | 6 个，01-33 | 1 个，01-16 | 集合匹配 |
| 福彩3D | 福彩 | 3 位，0-9 | — | 按位匹配 |
| 七乐彩 | 福彩 | 7 个，01-30 | 1 个特别号（玩家不选，由开奖给出） | 集合匹配，特别号从前区推导 |
| 快乐八 | 福彩 | 选 10 个，01-80 | — | 集合匹配（开奖 20 个，含「全不中」奖级） |

> **按位匹配**：每位数字与位置均需对位相同才算命中（如七星彩第 1 位对第 1 位）。
> **集合匹配**：只看号码是否在开奖集合中，与位置无关（如大乐透前区 5 个号码只要在开奖前区里即算命中）。
