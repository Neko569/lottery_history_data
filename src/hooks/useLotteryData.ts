import { useEffect } from "react";
import { useLotteryStore } from "@/store/lotteryStore";

/** 应用启动时拉取全部远程数据
 *  - 仅在数据尚未加载时触发，避免从其他页面返回首页时重复请求
 *  - loading 中也不重复触发，交给并发竞态 token 兜底 */
export function useLotteryData() {
  const fetchAllRemote = useLotteryStore((s) => s.fetchAllRemote);

  useEffect(() => {
    const { states } = useLotteryStore.getState();
    // 两个彩种都已加载且无错误时不重复请求
    const allLoaded = (Object.keys(states) as Array<keyof typeof states>).every(
      (t) => states[t].data || states[t].loading,
    );
    if (allLoaded) return;
    void fetchAllRemote();
  }, [fetchAllRemote]);
}
