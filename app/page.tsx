"use client";
import { useEffect, useState } from "react";

type Row = Record<string, string | number>;

const BRAND_LOGOS: Record<string, string> = {
  "현대해상": "https://www.hi.co.kr/favicon.ico",
  "삼성화재": "https://www.samsungfire.com/favicon.ico",
  "DB손해보험": "https://www.idbins.com/favicon.ico",
  "KB손해보험": "https://www.kbinsure.co.kr/favicon.ico",
  "메리츠화재": "https://www.meritzfire.com/favicon.ico",
  "한화손해보험": "https://www.hanwhainsurance.com/favicon.ico",
  "캐롯손해보험": "https://www.carrotins.com/favicon.ico",
  "한화/캐롯": "https://www.carrotins.com/favicon.ico",
};

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

  const rankColor = (rank: string | number) => {
    if (rank === 1) return "#bbf7d0";
    if (Number(rank) <= 3) return "#dcfce7";
    if (Number(rank) <= 5) return "#fef9c3";
    return "#fee2e2";
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
                <th style={thStyle}>순위</th>
                {envs.map((e) => <th key={e} style={thStyle}>{e}</th>)}
              </tr>
            </thead>
            <tbody>
              {table.map((row) => (
                <tr key={row.rank as number}>
                  <td style={{ ...tdStyle, fontWeight: 700, textAlign: "center", background: rankColor(row.rank) }}>
                    {row.rank}위
                  </td>
                  {envs.map((e) => {
                    const brand = row[e] as string;
                    const logo = brand && brand !== "-" ? BRAND_LOGOS[brand] : undefined;
                    return (
                      <td key={e} style={{ ...tdStyle, textAlign: "center", background: brand === "삼성화재" ? "#dbeafe" : undefined }}>
                        {brand === "-" ? "-" : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                            {logo && (
                              <img
                                src={logo}
                                alt=""
                                width={16}
                                height={16}
                                style={{ borderRadius: 3, objectFit: "contain" }}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            )}
                            {brand}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: 16, fontSize: 12, color: "#9ca3af" }}>
        순위 색상 — 초록: 1위 / 연초록: 2-3위 / 노랑: 4-5위 / 빨강: 6위+
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
