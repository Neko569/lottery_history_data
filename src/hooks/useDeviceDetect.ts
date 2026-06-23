import { useEffect } from "react";
import { useLotteryStore } from "@/store/lotteryStore";

/** 设备识别：根据视口宽度判断桌面/移动端 */
export function useDeviceDetect() {
  const setDesktop = useLotteryStore((s) => s.setDesktop);
  const isDesktop = useLotteryStore((s) => s.isDesktop);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(desktopQuery.matches);
    update();
    desktopQuery.addEventListener("change", update);
    return () => desktopQuery.removeEventListener("change", update);
  }, [setDesktop]);

  return isDesktop;
}
