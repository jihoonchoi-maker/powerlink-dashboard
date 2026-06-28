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
  const [header, ...data] = rows;

  // 최신 날짜 찾기
  const dateSet: Record<string, boolean> = {};
  data.forEach((r) => { dateSet[r[0]] = true; });
  const dates = Object.keys(dateSet).sort().reverse();
  const latestDate = dates[0];

  // 키워드 + 최신 날짜 필터
  const filtered = data.filter(
    (r) => r[0] === latestDate && r[2] === keyword
  );

  // 환경 목록
  const envOrder = ["PC_시크릿", "MO_시크릿", "PC_로그인", "MO_로그인"];
  const envs = envOrder.filter((e) => filtered.some((r) => r[1] === e));

  // 브랜드별 크로스테이블
  const brandSet: Record<string, boolean> = {};
  filtered.forEach((r) => { brandSet[r[4]] = true; });
  const brands = Object.keys(brandSet).sort();
  const table = brands.map((brand) => {
    const row: Record<string, string | number> = { brand };
    envs.forEach((env) => {
      const match = filtered.find((r) => r[4] === brand && r[1] === env);
      row[env] = match ? parseInt(match[3]) : "-";
    });
    return row;
  });

  const keywordSet: Record<string, boolean> = {};
  data.forEach((r) => { keywordSet[r[2]] = true; });
  const keywords = Object.keys(keywordSet).sort();

  return NextResponse.json({ date: latestDate, table, envs, keywords });
}
