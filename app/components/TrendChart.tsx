"use client";
import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

type HistoryRow = { date: string; env: string; brand: string; rank: number };

type TrendChartProps = {
  history: HistoryRow[];
  envs: string[];
};

const TREND_BRANDS = ["삼성화재", "현대해상", "KB손해보험", "DB손해보험"];
const BRAND_COLORS: Record<string, string> = {
  "삼성화재": "#3b82f6",
  "현대해상": "#10b981",
  "KB손해보험": "#f59e0b",
  "DB손해보험": "#8b5cf6",
};

export default function TrendChart({ history, envs }: TrendChartProps) {
  const [activeEnv, setActiveEnv] = useState(envs[0] ?? "");

  // 날짜 목록 (오름차순)
  const dateSet: Record<string, boolean> = {};
  history.forEach((r) => { dateSet[r.date] = true; });
  const dates = Object.keys(dateSet).sort();

  // recharts용 데이터: [{date, 삼성화재: 2, 현대해상: 1, ...}, ...]
  const chartData = dates.map((date) => {
    const point: Record<string, string | number> = {
      date: date.slice(5), // "MM-DD" 형식
    };
    TREND_BRANDS.forEach((brand) => {
      const row = history.find((r) => r.date === date && r.env === activeEnv && r.brand === brand);
      if (row) point[brand] = row.rank;
    });
    return point;
  });

  // 이 환경에 실제로 데이터 있는 브랜드만 표시
  const activeBrands = TREND_BRANDS.filter((brand) =>
    history.some((r) => r.env === activeEnv && r.brand === brand)
  );

  return (
    <div>
      {/* 환경 탭 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {envs.map((env) => (
          <button
            key={env}
            onClick={() => setActiveEnv(env)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: "1px solid #e2e8f0",
              background: activeEnv === env ? "#0f172a" : "#ffffff",
              color: activeEnv === env ? "#ffffff" : "#64748b",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {env.replace("_시크릿", "").replace("_로그인", " 로그인")}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#64748b" }} />
          <YAxis
            reversed
            domain={[1, 10]}
            ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
            tick={{ fontSize: 12, fill: "#64748b" }}
            tickFormatter={(v) => `${v}위`}
          />
          <Tooltip
            formatter={(value, name) => [`${value}위`, name as string]}
            contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
          />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          {activeBrands.map((brand) => (
            <Line
              key={brand}
              type="monotone"
              dataKey={brand}
              stroke={BRAND_COLORS[brand]}
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
