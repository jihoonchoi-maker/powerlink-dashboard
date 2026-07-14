import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword") || "운전자보험";
  const selectedTs = searchParams.get("timestamp") ?? null; // "YYYY-MM-DD HH:00:00"

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

  // 전체 타임스탬프 목록 (내림차순)
  const tsSet: Record<string, boolean> = {};
  kwData.forEach((r) => { tsSet[r[0]] = true; });
  const allTimestamps = Object.keys(tsSet).sort().reverse();

  // 날짜별 타임스탬프 목록 구성 (UI용)
  const dateToTimestamps: Record<string, string[]> = {};
  allTimestamps.forEach((ts) => {
    const day = ts.slice(0, 10);
    if (!dateToTimestamps[day]) dateToTimestamps[day] = [];
    dateToTimestamps[day].push(ts);
  });
  const availableDates = Object.keys(dateToTimestamps).sort().reverse();

  // 조회 기준 타임스탬프 결정
  // selectedTs가 있으면 해당 타임스탬프, 없으면 최신
  const targetTs = selectedTs && allTimestamps.includes(selectedTs)
    ? selectedTs
    : allTimestamps[0];

  // 델타 비교용: targetTs 기준으로 이전 캘린더 날짜의 마지막 타임스탬프
  const targetDay = targetTs.slice(0, 10);
  const latestTsPerDay: Record<string, string> = {};
  allTimestamps.forEach((ts) => {
    const day = ts.slice(0, 10);
    if (!latestTsPerDay[day] || ts > latestTsPerDay[day]) latestTsPerDay[day] = ts;
  });
  const daysBeforeTarget = availableDates.filter((d) => d < targetDay);
  const prevDayKey = daysBeforeTarget[0] ?? null;
  const prevDate = prevDayKey ? latestTsPerDay[prevDayKey] : null;

  // 선택 타임스탬프 데이터 필터
  const filtered = kwData.filter((r) => r[0] === targetTs);

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

  // 델타: 이전 날짜 대비 순위 변화
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

  // 히스토리: targetTs 기준 최근 7 캘린더 날짜 (각 날짜 마지막 타임스탬프)
  const recentDays = availableDates.filter((d) => d <= targetDay).slice(0, 7);
  const historyTimestamps = recentDays.map((d) => latestTsPerDay[d]).filter(Boolean);
  const history = kwData
    .filter((r) => historyTimestamps.includes(r[0]))
    .map((r) => ({
      date: r[0].slice(0, 10) as string,
      env: r[1] as string,
      brand: r[4] as string,
      rank: parseInt(r[3]),
    }));

  return NextResponse.json({
    date: targetTs,
    table,
    envs,
    keywords,
    delta,
    history,
    availableDates,
    dateToTimestamps,
    fetchedAt: new Date().toISOString(),
  });
}
