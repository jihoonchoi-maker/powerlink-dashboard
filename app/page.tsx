"use client";
import { useEffect, useState } from "react";
import KpiCard from "./components/KpiCard";
import TrendChart from "./components/TrendChart";

type Row = Record<string, string | number>;
type HistoryRow = { date: string; env: string; brand: string; rank: number };

const g = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

const BRAND_LOGOS: Record<string, string> = {
  "현대해상": g("hi.co.kr"),
  "삼성화재": "/logos/samsung.png",
  "DB손해보험": g("idbins.com"),
  "KB손해보험": g("kbinsure.co.kr"),
  "메리츠화재": g("meritzfire.com"),
  "한화손해보험": g("hanwhainsurance.com"),
  "캐롯손해보험": g("carrotins.com"),
  "한화/캐롯": g("carrotins.com"),
};

const OUR_BRAND = "삼성화재";
const fmtEnv = (env: string) => env.replace("_시크릿", "").replace("_로그인", " 로그인");

// 도메인 문자열에서 URL 부분만 추출 (PC는 텍스트+URL 혼합으로 들어옴)
const extractUrl = (dom: string) => {
  const parts = dom.split(/\s+/);
  const url = [...parts].reverse().find((p) => p.includes("."));
  return url ?? dom;
};

const CATEGORY_MAP: Record<string, string[]> = {
  "운전자보험":     ["운전자보험"],
  "실손의료비보험": ["실비보험", "실손보험"],
  "주택화재플랜":   ["주택화재보험", "화재보험"],
  "해외여행보험":   ["여행자보험", "해외여행보험", "단기여행자보험", "해외여행자보험"],
};
const CATEGORIES = Object.keys(CATEGORY_MAP);

export default function Home() {
  const [category, setCategory] = useState("운전자보험");
  const [keyword, setKeyword] = useState("운전자보험");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [dateToTimestamps, setDateToTimestamps] = useState<Record<string, string[]>>({});
  const [envs, setEnvs] = useState<string[]>([]);
  const [table, setTable] = useState<Row[]>([]);
  const [delta, setDelta] = useState<Record<string, Record<string, number | null>>>({});
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  // 선택된 날짜의 타임스탬프 목록 (최신순)
  const timesForDate = selectedDate ? (dateToTimestamps[selectedDate] ?? []) : [];

  useEffect(() => {
    setLoading(true);
    const ts = selectedDate && selectedTime ? `${selectedDate} ${selectedTime}` : "";
    const url = `/api/data?keyword=${encodeURIComponent(keyword)}${ts ? `&timestamp=${encodeURIComponent(ts)}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setDate(d.date);
        setEnvs(d.envs);
        setTable(d.table);
        setKeywords(d.keywords);
        setDelta(d.delta ?? {});
        setHistory(d.history ?? []);
        const dates: string[] = d.availableDates ?? [];
        const dtMap: Record<string, string[]> = d.dateToTimestamps ?? {};
        setAvailableDates(dates);
        setDateToTimestamps(dtMap);
        // 최초 로드 시 최신 날짜/시간으로 초기화
        if (!selectedDate && dates.length > 0) {
          setSelectedDate(dates[0]);
          setSelectedTime(dtMap[dates[0]]?.[0]?.slice(11, 19) ?? "");
        }
        setLoading(false);
      });
  }, [keyword, selectedDate, selectedTime]);

  // 삼성화재 KPI 데이터 추출 (brand|domain 복합키로 delta 조회)
  const kpiCards = envs.map((env) => {
    const rankRow = table.find((row) => (row[env] as string) === OUR_BRAND);
    const rank = rankRow ? (rankRow.rank as number) : null;
    const dom = rankRow ? (rankRow[env + "_dom"] as string ?? "") : "";
    const d = delta[env]?.[`${OUR_BRAND}|${dom}`] ?? null;
    return { env, rank, delta: d };
  });

  // 순위 컬럼 색상
  const rankColor = (rank: number) => {
    if (rank === 1) return "#bbf7d0";
    if (rank <= 3) return "#dcfce7";
    if (rank <= 5) return "#fef9c3";
    return "#fee2e2";
  };

  // 델타 렌더링
  const renderDelta = (val: number | null | undefined) => {
    if (val === null || val === undefined) return null;
    if (val === 0) return <span style={{ color: "#94a3b8", fontSize: 11 }}> —</span>;
    if (val < 0) return <span style={{ color: "#3b82f6", fontSize: 11 }}> ▼{Math.abs(val)}</span>;
    return <span style={{ color: "#ef4444", fontSize: 11 }}> ▲{val}</span>;
  };

  return (
    <main style={{
      fontFamily: "system-ui, -apple-system, sans-serif",
      background: "#ffffff",
      minHeight: "100vh",
      padding: "40px 32px",
      maxWidth: 960,
      margin: "0 auto",
      color: "#0f172a",
    }}>

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>
            네이버 파워링크 순위 모니터링
          </h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>날짜</label>
            <select
              value={selectedDate}
              onChange={(e) => {
                const d = e.target.value;
                setSelectedDate(d);
                setSelectedTime(dateToTimestamps[d]?.[0]?.slice(11, 19) ?? "");
              }}
              style={dropdownStyle}
            >
              {availableDates.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>시간</label>
            <select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              style={dropdownStyle}
            >
              {timesForDate.map((ts) => {
                const t = ts.slice(11, 19);
                return <option key={ts} value={t}>{t}</option>;
              })}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>보종</label>
          <select
            value={category}
            onChange={(e) => {
              const cat = e.target.value;
              setCategory(cat);
              setKeyword(CATEGORY_MAP[cat][0]);
            }}
            style={dropdownStyle}
          >
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>키워드</label>
          <select
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={dropdownStyle}
          >
            {CATEGORY_MAP[category].map((k) => <option key={k}>{k}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#64748b" }}>로딩 중...</p>
      ) : (
        <>
          {/* KPI 카드 */}
          <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
            {kpiCards.map((card) => (
              <KpiCard key={card.env} env={fmtEnv(card.env)} rank={card.rank} delta={card.delta} />
            ))}
          </div>

          {/* 크로스테이블 */}
          <div style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 32,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={thStyle}>순위</th>
                  {envs.map((e) => <th key={e} style={thStyle}>{fmtEnv(e)}</th>)}
                </tr>
              </thead>
              <tbody>
                {table.map((row, i) => (
                  <tr key={row.rank as number} style={{ background: i % 2 === 0 ? "#ffffff" : "#fafafa" }}>
                    <td style={{
                      ...tdStyle,
                      fontWeight: 700,
                      textAlign: "center",
                      background: rankColor(row.rank as number),
                      width: 80,
                    }}>
                      {row.rank}위
                    </td>
                    {envs.map((e) => {
                      const brand = row[e] as string;
                      const dom = row[e + "_dom"] as string ?? "";
                      const logo = brand && brand !== "-" ? BRAND_LOGOS[brand] : undefined;
                      const deltaKey = `${brand}|${dom}`;
                      const d = brand && brand !== "-" ? delta[e]?.[deltaKey] : undefined;
                      return (
                        <td key={e} style={{
                          ...tdStyle,
                          textAlign: "center",
                          background: brand === OUR_BRAND ? "#eff6ff" : undefined,
                        }}>
                          {brand === "-" ? (
                            <span style={{ color: "#cbd5e1" }}>-</span>
                          ) : (
                            <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                {logo && (
                                  <img
                                    src={logo}
                                    alt=""
                                    width={16}
                                    height={16}
                                    style={{ borderRadius: 3, objectFit: "contain" }}
                                    onError={(ev) => { (ev.target as HTMLImageElement).style.display = "none"; }}
                                  />
                                )}
                                <span style={{ fontWeight: brand === OUR_BRAND ? 600 : 400 }}>{brand}</span>
                                {renderDelta(d)}
                              </span>
                              {dom && (
                                <span style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "0.01em" }}>{extractUrl(dom)}</span>
                              )}
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

          {/* 트렌드 차트 */}
          {history.length > 0 && (
            <div style={{
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#0f172a" }}>
                7일 트렌드
              </h2>
              <TrendChart history={history} envs={envs} />
            </div>
          )}

          {/* 범례 */}
          <p style={{ marginTop: 16, fontSize: 12, color: "#94a3b8" }}>
            순위 색상 — 초록: 1위 / 연초록: 2-3위 / 노랑: 4-5위 / 빨강: 6위+　|　델타 — ▼파랑: 상승 / ▲빨강: 하락
          </p>
        </>
      )}
    </main>
  );
}

const dropdownStyle: React.CSSProperties = {
  padding: "7px 14px",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontSize: 14,
  fontWeight: 500,
  color: "#0f172a",
  background: "#ffffff",
  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  cursor: "pointer",
};

const thStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid #e2e8f0",
  textAlign: "center",
  fontWeight: 600,
  fontSize: 13,
  color: "#64748b",
  letterSpacing: "0.03em",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid #f1f5f9",
};
