import { lazy, Suspense } from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Home from "@/pages/Home";
import TrendDetail from "@/pages/TrendDetail";
import MatchResultPage from "@/pages/MatchResultPage";

// OCR POC 页面懒加载，避免 PaddleOCR SDK 进入主 bundle
const OcrPoc = lazy(() => import("@/pages/OcrPoc"));

export default function App() {
  return (
    <Router>
      {/* 全局统一导航栏：所有页面顶部常驻 */}
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trend/:type" element={<TrendDetail />} />
        <Route path="/match" element={<MatchResultPage />} />
        <Route
          path="/ocr-poc"
          element={
            <Suspense fallback={<div className="p-8 text-center text-sm text-zinc-500">加载 OCR 模块...</div>}>
              <OcrPoc />
            </Suspense>
          }
        />
      </Routes>
    </Router>
  );
}
