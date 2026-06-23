# 彩票开奖历史查询及随机生成网页 - 技术架构文档

## 1. 架构设计

纯前端架构，无后端服务，可直接部署至 GitHub Pages。

```mermaid
flowchart TD
    "A[前端 React 应用]" --> "B[数据层: GitHub raw JSON / 手动上传]"
    "A" --> "C[状态层: Zustand Store]"
    "A" --> "D[视图层: 组件]"
    "D" --> "D1[控制栏]"
    "D" --> "D2[开奖历史列表]"
    "D" --> "D3[走势图 Recharts]"
    "D" --> "D4[随机生成器]"
    "D" --> "D5[分屏容器]"
    "B" --> "B1[远程: raw.githubusercontent.com]"
    "B" --> "B2[本地: FileReader 上传 JSON]"
```

## 2. 技术说明
- **前端**：React@18 + TypeScript + tailwindcss@3 + Vite
- **初始化工具**：vite-init（react-ts 模板，含 react-router-dom、tailwind、zustand）
- **图表库**：recharts（走势图折线图）
- **图标库**：lucide-react
- **后端**：无（纯前端，适配 GitHub Pages 静态部署）
- **数据源**：远程 GitHub raw JSON + 本地文件上传兜底

## 3. 路由定义
| 路由 | 用途 |
|-------|---------|
| / | 主页面（单视图/分屏视图统一在此页面切换） |

## 4. 数据源定义

### 4.1 远程数据地址
- 大乐透：`https://raw.githubusercontent.com/Neko569/get_lottery_data/main/data/dlt_history.json`
- 双色球：`https://raw.githubusercontent.com/Neko569/get_lottery_data/main/data/ssq_history.json`

### 4.2 数据结构（TypeScript 类型）
```typescript
// 大乐透 / 双色球 通用结构
interface LotteryData {
  generated_at: string;
  source: string;
  game: string;
  game_no: string;
  total: number;
  items: LotteryItem[];
}

interface LotteryItem {
  term: string | number; // 大乐透为 string，双色球为 number
  draw_time: string;     // YYYY-MM-DD
  draw_result: string;   // "12 19 21 24 29 03 10"
  front_numbers: string[]; // 大乐透5个(01-35) / 双色球6个(01-33)
  back_numbers: string[];  // 大乐透2个(01-12) / 双色球1个(01-16)
}

type LotteryType = 'dlt' | 'ssq';
```

### 4.3 彩种规则
| 彩种 | 前区/红球 | 后区/蓝球 |
|-------|-----------|-----------|
| 大乐透(dlt) | 5 个，范围 01-35 | 2 个，范围 01-12 |
| 双色球(ssq) | 6 个，范围 01-33 | 1 个，范围 01-16 |

## 5. 状态管理（Zustand Store）
```typescript
interface LotteryStore {
  // 数据
  dltData: LotteryData | null;
  ssqData: LotteryData | null;
  loading: boolean;
  error: string | null;
  dataSource: 'remote' | 'upload';

  // 视图状态
  activeLottery: LotteryType;        // 当前彩种
  splitView: boolean;                // 分屏开关
  pageSize: number;                  // 每页条数，默认25
  currentPage: number;               // 当前页码
  isDesktop: boolean;                // 设备识别结果

  // 动作
  fetchRemoteData: (type: LotteryType) => Promise<void>;
  uploadData: (type: LotteryType, file: File) => Promise<void>;
  setActiveLottery: (type: LotteryType) => void;
  setSplitView: (on: boolean) => void;
  setPageSize: (size: number) => void;
  setCurrentPage: (page: number) => void;
}
```

## 6. 组件结构
```
src/
├── components/
│   ├── ControlBar.tsx        // 顶部控制栏
│   ├── LotteryList.tsx       // 开奖历史列表
│   ├── LotteryBall.tsx       // 号码球
│   ├── Pagination.tsx        // 分页器
│   ├── TrendChart.tsx        // 走势图(电脑端)
│   ├── RandomGenerator.tsx   // 随机生成器
│   ├── LotteryPanel.tsx      // 单彩种面板(列表+走势+随机)
│   └── SplitView.tsx         // 分屏容器
├── hooks/
│   ├── useDeviceDetect.ts    // 设备识别
│   └── useLotteryData.ts     // 数据加载
├── store/
│   └── lotteryStore.ts       // Zustand 状态
├── utils/
│   ├── lottery.ts            // 彩种规则与随机生成
│   └── dataParser.ts         // JSON 解析与校验
├── types/
│   └── lottery.ts            // 类型定义
├── pages/
│   └── Home.tsx              // 主页面
└── App.tsx
```

## 7. GitHub Pages 部署
- `vite.config.ts` 配置 `base` 为仓库名（如 `/lottery-web/`）
- 构建产物 `dist/` 部署至 `gh-pages` 分支或通过 GitHub Actions 自动部署
- 提供 `.github/workflows/deploy.yml` 工作流配置
