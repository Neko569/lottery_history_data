import { useEffect } from "react";
import { useLotteryStore } from "@/store/lotteryStore";

/** 应用启动时拉取全部远程数据 */
export function useLotteryData() {
  const fetchAllRemote = useLotteryStore((s) => s.fetchAllRemote);

  useEffect(() => {
    void fetchAllRemote();
  }, [fetchAllRemote]);
}
