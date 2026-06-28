"use client";
import { useEffect, useState } from "react";

type Row = Record<string, string | number>;

export default function Home() {
  const [keyword, setKeyword] = useState("운전자보험");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [envs, setEnvs] = useState<string[]>([]);
  const [table, setTable] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/data?keyword=${encodeURIComponent(keyword)}`)
      .then((r) => r.json())
      .then((d) => {
        setDate(d.date);
        setEnvs(d.envs);
        setTable(d.table);
        setKeywords(d.keywords);
        setLoading(false);
      });
  }, [keyword]);

  const rankColor = (val: string | number) => {
    if (val === "-") return "#f3f4f6";
    const n = Number(val);
    if (n === 1) return "#22c55e";
    if (n <= 3) return "#86efac";
    if (n <= 5) return "#fde68a";
    return "#fca5a5";
  };

  return (
    <main style={{ fontFamily: "sans-serif", padding: "32px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        네이버 파워링크 순위 모니터링
      </h1>
      {date && <p style={{ color: "#6b7280", marginBottom: 24 }}>기준일: {date}</p>}

      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 600, marginRight: 8 }}>키워드</label>
        <select
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db" }}
        >
          {keywords.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p>로딩 중...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={thStyle}>브랜드</th>
                {envs.map((e) => <th key={e} style={thStyle}>{e}</th>)}
              </tr>
            </thead>
            <tbody>
              {table.map((row) => (
                <tr key={row.brand as string}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{row.brand}</td>
                  {envs.map((e) => (
                    <td key={e} style={{ ...tdStyle, background: rankColor(row[e]), textAlign: "center" }}>
                      {row[e] === "-" ? "-" : `${row[e]}위`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: 16, fontSize: 12, color: "#9ca3af" }}>
        초록: 1위 / 연초록: 2-3위 / 노랑: 4-5위 / 빨강: 6위+
      </p>
    </main>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 16px",
  border: "1px solid #e5e7eb",
  textAlign: "center",
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 16px",
  border: "1px solid #e5e7eb",
};
