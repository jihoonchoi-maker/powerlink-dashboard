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
