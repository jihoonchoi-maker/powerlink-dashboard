"use client";

type KpiCardProps = {
  env: string;
  rank: number | null;
  delta: number | null;
};

export default function KpiCard({ env, rank, delta }: KpiCardProps) {
  const deltaLabel = () => {
    if (delta === null) return { text: "전일 비교 없음", color: "#94a3b8" };
    if (delta === 0) return { text: "— 변동없음", color: "#94a3b8" };
    if (delta < 0) return { text: `▼ ${Math.abs(delta)}위 상승`, color: "#3b82f6" };
    return { text: `▲ ${delta}위 하락`, color: "#ef4444" };
  };

  const d = deltaLabel();

  return (
    <div style={{
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
      borderRadius: 12,
      padding: "20px 24px",
      minWidth: 160,
      flex: 1,
    }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        {env}
      </p>
      <p style={{ fontSize: 36, fontWeight: 700, color: "#0f172a", lineHeight: 1, marginBottom: 8 }}>
        {rank !== null ? `${rank}위` : "-"}
      </p>
      <p style={{ fontSize: 13, color: d.color, fontWeight: 500 }}>
        {d.text}
      </p>
    </div>
  );
}
