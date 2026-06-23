# 彩运 · 彩票开奖历史查询

一个可部署于 GitHub Pages 的纯前端彩票开奖历史查询与随机号码生成网页。

## 功能特性

- **设备自适应**：自动识别 PC/移动端，提供适配的布局体验
- **双彩种支持**：体彩大乐透、福彩双色球
- **数据源**：默认拉取开源仓库数据，支持手动上传 JSON 兜底
- **开奖历史**：按期号倒序展示，支持分页（10/25/50/100条/页）
- **走势图**：桌面端显示各位置号码走势折线图
- **完整号码走势**：二级页面展示全部号码（大乐透1-35+1-12，双色球1-33+1-16）
- **分屏对比**：可同时左右查看大乐透与双色球
- **随机生成**：一键生成符合规则的投注号码

## 技术栈

- React 18 + TypeScript
- Vite 6
- Tailwind CSS 3
- Recharts（图表）
- Zustand（状态管理）
- React Router（路由）
- Lucide React（图标）

## 数据来源

默认使用 [Neko569/get_lottery_data](https://github.com/Neko569/get_lottery_data) 开源数据。

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
```

## 项目结构

```
src/
├── components/          # UI 组件
│   ├── ControlBar.tsx      # 顶部控制栏
│   ├── LotteryPanel.tsx    # 彩种面板
│   ├── LotteryList.tsx     # 开奖历史列表
│   ├── LotteryBall.tsx     # 号码球
│   ├── Pagination.tsx      # 分页器
│   ├── TrendChart.tsx      # 走势图
│   ├── FullNumberTrendChart.tsx  # 完整号码走势图
│   └── RandomGenerator.tsx # 随机生成器
├── pages/              # 页面
│   ├── Home.tsx            # 首页
│   └── TrendDetail.tsx     # 完整走势二级页面
├── store/              # 状态管理
│   └── lotteryStore.ts
├── hooks/              # 自定义 Hooks
│   ├── useDeviceDetect.ts
│   └── useLotteryData.ts
├── utils/              # 工具函数
│   ├── lottery.ts
│   └── dataParser.ts
└── types/              # 类型定义
    └── lottery.ts
```

## 彩种规则

| 彩种 | 前区/红球 | 后区/蓝球 |
|------|-----------|-----------|
| 大乐透 | 5个，范围 01-35 | 2个，范围 01-12 |
| 双色球 | 6个，范围 01-33 | 1个，范围 01-16 |
