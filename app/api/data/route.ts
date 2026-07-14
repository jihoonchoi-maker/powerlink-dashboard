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

  // 타임스탬프 목록 (내림차순)
  const dateSet: Record<string, boolean> = {};
  kwData.forEach((r) => { dateSet[r[0]] = true; });
  const dates = Object.keys(dateSet).sort().reverse();

  // 캘린더 일 기준으로 최신일 / 이전일 결정
  const daySet: Record<string, boolean> = {};
  dates.forEach((d) => { daySet[d.slice(0, 10)] = true; });
  const sortedDays = Object.keys(daySet).sort().reverse();
  const latestDayKey = sortedDays[0];
  const prevDayKey = sortedDays[1] ?? null;

  // 각 날짜의 마지막 타임스탬프
  const latestTsPerDay: Record<string, string> = {};
  dates.forEach((ts) => {
    const day = ts.slice(0, 10);
    if (!latestTsPerDay[day] || ts > latestTsPerDay[day]) latestTsPerDay[day] = ts;
  });

  const latestDate = latestTsPerDay[latestDayKey];
  const prevDate = prevDayKey ? latestTsPerDay[prevDayKey] : null;

  // 최신 타임스탬프 필터
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

  // 히스토리: 최근 7 캘린더 날짜 기준 (시간별 수집 시에도 날짜 단위로 집계)
  // 각 날짜의 마지막 타임스탬프 데이터를 사용
  const datePartSet: Record<string, boolean> = {};
  dates.forEach((d) => { datePartSet[d.slice(0, 10)] = true; });
  const recent7Days = Object.keys(datePartSet).sort().reverse().slice(0, 7);
  // 각 날짜에서 마지막 타임스탬프 선택
  const latestPerDay: Record<string, string> = {};
  dates.forEach((ts) => {
    const day = ts.slice(0, 10);
    if (recent7Days.includes(day) && (!latestPerDay[day] || ts > latestPerDay[day])) {
      latestPerDay[day] = ts;
    }
  });
  const historyTimestamps = Object.values(latestPerDay);
  const history = kwData
    .filter((r) => historyTimestamps.includes(r[0]))
    .map((r) => ({
      date: r[0].slice(0, 10) as string,
      env: r[1] as string,
      brand: r[4] as string,
      rank: parseInt(r[3]),
    }));

  return NextResponse.json({ date: latestDate, table, envs, keywords, delta, history, fetchedAt: new Date().toISOString() });
}
