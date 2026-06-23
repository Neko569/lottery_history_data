import { HashRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import TrendDetail from "@/pages/TrendDetail";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trend/:type" element={<TrendDetail />} />
      </Routes>
    </Router>
  );
}
