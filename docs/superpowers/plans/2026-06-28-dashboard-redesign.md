# 파워링크 대시보드 풀 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 네이버 파워링크 순위 대시보드를 KPI 카드 + 델타값 + 7일 트렌드 차트가 포함된 Linear/Notion 스타일로 전면 리디자인한다.

**Architecture:** API route에서 델타(어제 대비 순위 변화)와 7일 히스토리를 추가 반환하고, KpiCard·TrendChart 컴포넌트를 신규 생성한 뒤, page.tsx를 전면 재구성하여 헤더→KPI카드→크로스테이블→트렌드차트 레이아웃을 완성한다.

**Tech Stack:** Next.js 14 App Router, TypeScript, googleapis, recharts

## Global Constraints
- 모든 credentials는 환경변수로만 참조 (GOOGLE_CREDENTIALS, SHEETS_ID). 코드에 하드코딩 금지.
- TypeScript strict 모드 유지
- Next.js 14 App Router 패턴 유지
- KPI 카드 "우리 브랜드"는 `"삼성화재"` 문자열로 고정
- 디자인 토큰: 배경 `#ffffff`, 카드 `#f8fafc`, 포인트 `#3b82f6`, 텍스트 `#0f172a`, 보조텍스트 `#64748b`, 테두리 `#e2e8f0`, 상승델타 `#3b82f6`, 하락델타 `#ef4444`
- 폰트: `system-ui, -apple-system, sans-serif` (웹폰트 추가 없음)

---

### Task 1: recharts 설치 + API route 확장 (delta + history)

**Files:**
- Modify: `app/api/data/route.ts`

**Interfaces:**
- Produces:
  ```typescript
  // GET /api/data?keyword=운전자보험 응답 타입
  type ApiResponse = {
    date: string;
    table: Array<Record<string, string | number>>;
    envs: string[];
    keywords: string[];
    delta: Record<string, Record<string, number | null>>;
    // delta[env][brand] = 어제 대비 순위 변화
    // 양수 = 순위 하락 (나빠짐), 음수 = 순위 상승 (좋아짐), null = 비교 불가
    history: Array<{ date: string; env: string; brand: string; rank: number }>;
    // 최근 7일치 (keyword 기준)
  };
  ```

- [ ] **Step 1: recharts 설치**

```bash
cd "C:/Users/MADUP/Desktop/클로드 실습/powerlink-dashboard"
npm install recharts
```

Expected output: `added N packages` (오류 없으면 OK)

- [ ] **Step 2: route.ts 전체를 아래 코드로 교체**

`app/api/data/route.ts` 전체 내용:

```typescript
import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword") || "운전자보험";

  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS!);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEETS_ID,
    range: "raw_data!A:I",
  });

  const rows = res.data.values || [];
  const [, ...data] = rows;

  // 키워드 필터
  const kwData = data.filter((r) => r[2] === keyword);

  // 날짜 목록 (내림차순)
  const dateSet: Record<string, boolean> = {};
  kwData.forEach((r) => { dateSet[r[0]] = true; });
  const dates = Object.keys(dateSet).sort().reverse();
  const latestDate = dates[0];
  const prevDate = dates[1] ?? null;

  // 최신 날짜 필터
  const filtered = kwData.filter((r) => r[0] === latestDate);

  // 환경 목록
  const envOrder = ["PC_시크릿", "MO_시크릿", "PC_로그인", "MO_로그인"];
  const envs = envOrder.filter((e) => filtered.some((r) => r[1] === e));

  // 크로스테이블 (행=순위, 열=환경, 셀=브랜드)
  const maxRank = filtered.reduce((m, row) => Math.max(m, parseInt(row[3]) || 0), 0);
  const table = Array.from({ length: maxRank }, (_, i) => {
    const rank = i + 1;
    const tableRow: Record<string, string | number> = { rank };
    envs.forEach((env) => {
      const match = filtered.find((row) => row[1] === env && parseInt(row[3]) === rank);
      tableRow[env] = match ? match[4] : "-";
    });
    return tableRow;
  });

  // 키워드 목록
  const keywordSet: Record<string, boolean> = {};
  data.forEach((r) => { keywordSet[r[2]] = true; });
  const keywords = Object.keys(keywordSet).sort();

  // 델타: 어제 대비 순위 변화
  // delta[env][brand] = 오늘순위 - 어제순위 (양수=하락, 음수=상승, null=비교불가)
  const delta: Record<string, Record<string, number | null>> = {};
  const prevFiltered = prevDate ? kwData.filter((r) => r[0] === prevDate) : [];
  envs.forEach((env) => {
    delta[env] = {};
    filtered
      .filter((r) => r[1] === env)
      .forEach((r) => {
        const brand = r[4];
        const todayRank = parseInt(r[3]);
        const prevRow = prevFiltered.find((p) => p[1] === env && p[4] === brand);
        delta[env][brand] = prevRow ? todayRank - parseInt(prevRow[3]) : null;
      });
  });

  // 히스토리: 최근 7일치
  const recent7 = dates.slice(0, 7);
  const history = kwData
    .filter((r) => recent7.includes(r[0]))
    .map((r) => ({
      date: r[0] as string,
      env: r[1] as string,
      brand: r[4] as string,
      rank: parseInt(r[3]),
    }));

  return NextResponse.json({ date: latestDate, table, envs, keywords, delta, history });
}
```

- [ ] **Step 3: 로컬에서 API 응답 확인**

```bash
cd "C:/Users/MADUP/Desktop/클로드 실습/powerlink-dashboard"
npm run dev
```

브라우저에서 `http://localhost:3000/api/data?keyword=운전자보험` 열어서 응답에 `delta`와 `history` 키가 있는지 확인. 있으면 OK.

- [ ] **Step 4: 커밋**

```bash
git add package.json package-lock.json app/api/data/route.ts
git commit -m "feat: API에 delta·history 추가, recharts 설치"
```

---

### Task 2: KpiCard 컴포넌트

**Files:**
- Create: `app/components/KpiCard.tsx`

**Interfaces:**
- Consumes:
  ```typescript
  // Task 1에서 정의한 delta 타입
  delta: Record<string, Record<string, number | null>>
  ```
- Produces:
  ```typescript
  // KpiCard props
  type KpiCardProps = {
    env: string;           // "PC_시크릿"
    rank: number | null;   // 삼성화재 오늘 순위, 없으면 null
    delta: number | null;  // 어제 대비 변화, null=비교불가
  };
  ```

- [ ] **Step 1: `app/components/` 디렉토리 생성 후 KpiCard.tsx 작성**

`app/components/KpiCard.tsx` 전체 내용:

```tsx
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
```

- [ ] **Step 2: 커밋**

```bash
git add app/components/KpiCard.tsx
git commit -m "feat: KpiCard 컴포넌트 추가"
```

---

### Task 3: TrendChart 컴포넌트

**Files:**
- Create: `app/components/TrendChart.tsx`

**Interfaces:**
- Consumes:
  ```typescript
  // Task 1에서 정의한 history 타입
  history: Array<{ date: string; env: string; brand: string; rank: number }>
  ```
- Produces:
  ```typescript
  type TrendChartProps = {
    history: Array<{ date: string; env: string; brand: string; rank: number }>;
    envs: string[];
  };
  ```

- [ ] **Step 1: TrendChart.tsx 작성**

`app/components/TrendChart.tsx` 전체 내용:

```tsx
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
            {env}
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
            formatter={(value: number, name: string) => [`${value}위`, name]}
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
```

- [ ] **Step 2: 커밋**

```bash
git add app/components/TrendChart.tsx
git commit -m "feat: TrendChart 컴포넌트 추가 (Recharts 기반)"
```

---

### Task 4: page.tsx 풀 리디자인

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes:
  - `KpiCard` from `./components/KpiCard`
  - `TrendChart` from `./components/TrendChart`
  - API 응답: `{ date, table, envs, keywords, delta, history }`

- [ ] **Step 1: page.tsx 전체를 아래 코드로 교체**

`app/page.tsx` 전체 내용:

```tsx
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

export default function Home() {
  const [keyword, setKeyword] = useState("운전자보험");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [envs, setEnvs] = useState<string[]>([]);
  const [table, setTable] = useState<Row[]>([]);
  const [delta, setDelta] = useState<Record<string, Record<string, number | null>>>({});
  const [history, setHistory] = useState<HistoryRow[]>([]);
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
        setDelta(d.delta ?? {});
        setHistory(d.history ?? []);
        setLoading(false);
      });
  }, [keyword]);

  // 삼성화재 KPI 데이터 추출
  const kpiCards = envs.map((env) => {
    const rankRow = table.find((row) =>
      (row[env] as string) === OUR_BRAND
    );
    const rank = rankRow ? (rankRow.rank as number) : null;
    const d = delta[env]?.[OUR_BRAND] ?? null;
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
          {date && (
            <span style={{
              display: "inline-block",
              background: "#f1f5f9",
              color: "#64748b",
              fontSize: 12,
              fontWeight: 500,
              padding: "3px 10px",
              borderRadius: 20,
            }}>
              기준일 {date}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>키워드</label>
          <select
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontSize: 14,
              fontWeight: 500,
              color: "#0f172a",
              background: "#ffffff",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              cursor: "pointer",
            }}
          >
            {keywords.map((k) => <option key={k}>{k}</option>)}
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
              <KpiCard key={card.env} env={card.env} rank={card.rank} delta={card.delta} />
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
                  {envs.map((e) => <th key={e} style={thStyle}>{e}</th>)}
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
                      const logo = brand && brand !== "-" ? BRAND_LOGOS[brand] : undefined;
                      const d = brand && brand !== "-" ? delta[e]?.[brand] : undefined;
                      return (
                        <td key={e} style={{
                          ...tdStyle,
                          textAlign: "center",
                          background: brand === OUR_BRAND ? "#eff6ff" : undefined,
                        }}>
                          {brand === "-" ? (
                            <span style={{ color: "#cbd5e1" }}>-</span>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
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
```

- [ ] **Step 2: 로컬에서 전체 UI 확인**

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속 후 확인:
- KPI 카드 표시 (삼성화재 환경별 순위 + 델타)
- 크로스테이블에 델타 ▲▼ 표시
- 7일 트렌드 차트 렌더링 (데이터 1일치면 점만 찍힘 — 정상)
- 키워드 전환 시 모든 섹션 업데이트

- [ ] **Step 3: 커밋 & 푸시**

```bash
git add app/page.tsx
git commit -m "feat: 대시보드 풀 리디자인 - KPI카드·델타·트렌드차트 통합"
git push
```

Expected: Vercel 자동 배포 시작
