import { HashRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Home from "@/pages/Home";
import TrendDetail from "@/pages/TrendDetail";
import MatchResultPage from "@/pages/MatchResultPage";

export default function App() {
  return (
    <Router>
      {/* 全局统一导航栏：所有页面顶部常驻 */}
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trend/:type" element={<TrendDetail />} />
        <Route path="/match" element={<MatchResultPage />} />
      </Routes>
    </Router>
  );
}
