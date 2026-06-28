# 파워링크 대시보드 풀 리디자인 Design Spec

## Goal
팀 내부 보고 + 팀원 개인 일일 모니터링 두 용도 모두 커버하는 "있어빌리티" 있는 대시보드로 전면 개편. 디자인 톤은 깔끔한 화이트 + 포인트 컬러 (Linear/Notion 스타일).

## Architecture

### 페이지 레이아웃 (단일 페이지, 스크롤)
```
헤더 (제목 + 기준일 + 키워드 셀렉터)
  ↓
KPI 카드 섹션
  ↓
크로스테이블 (순위 × 환경 × 브랜드 + 델타)
  ↓
7일 트렌드 차트
```

### 파일 구조
- `app/page.tsx` — 전체 레이아웃 재구성
- `app/api/data/route.ts` — 델타값 + 7일 히스토리 데이터 추가 반환
- `app/components/KpiCard.tsx` — KPI 카드 컴포넌트 (신규)
- `app/components/TrendChart.tsx` — Recharts 기반 트렌드 차트 (신규)

## 섹션별 상세 설계

### 1. 헤더
- 제목: "네이버 파워링크 순위 모니터링" (폰트 굵기 강화)
- 기준일 배지: 회색 pill 형태
- 키워드 셀렉터: 현재와 동일하나 스타일 개선 (border-radius, shadow)

### 2. KPI 카드
- 삼성화재 기준으로 환경별 오늘 순위 카드 표시
- 카드당 정보: 환경명 / 순위 (큰 숫자) / 어제 대비 델타 (▲빨강 ▼파랑 — 없음)
- 순위가 없으면 "-" 표시
- 카드 개수: 수집된 환경 수만큼 동적 렌더링

### 3. 크로스테이블
- 현재 구조 유지 (행=순위, 열=환경, 셀=브랜드+로고)
- 셀 안에 델타 추가: `현대해상 ▲2` 형태
- 델타 색상: 순위 상승(숫자 감소)=파랑 ▼, 순위 하락(숫자 증가)=빨강 ▲, 변동없음=회색 —
- 테이블 디자인: 라운드 테두리, 헤더 배경 #f8fafc, 호버 효과

### 4. 7일 트렌드 차트
- Recharts LineChart 사용
- X축: 날짜 (최근 7일, MM/DD 형식)
- Y축: 순위 (반전, 1위가 위에 오도록, 범위 1~10)
- 라인: 주요 브랜드별 (삼성화재·현대해상·KB손해보험·DB손해보험) 색상 구분
- 환경 셀렉터: 차트 위에 PC_시크릿 / MO_시크릿 탭으로 전환
- 데이터 없는 날짜는 라인 끊김 처리

## API 변경사항 (`/api/data`)

현재 반환값에 추가:
```typescript
{
  date: string,           // 기준일 (기존)
  table: Row[],           // 순위 크로스테이블 (기존)
  envs: string[],         // 환경 목록 (기존)
  keywords: string[],     // 키워드 목록 (기존)
  // 신규 추가:
  delta: Record<string, Record<string, number | null>>,
  // delta[env][brand] = 어제 대비 순위 변화 (양수=하락, 음수=상승, null=비교불가)
  history: HistoryRow[],
  // history: [{date, env, brand, rank}, ...] 최근 7일치
}
```

## 디자인 토큰
- 폰트: system-ui / -apple-system (웹폰트 추가 없이)
- 배경: #ffffff
- 카드 배경: #f8fafc
- 포인트 컬러: #3b82f6 (파랑)
- 텍스트: #0f172a (진한 네이비)
- 보조 텍스트: #64748b
- 테두리: #e2e8f0
- 순위 상승 델타: #3b82f6
- 순위 하락 델타: #ef4444

## 의존성 추가
- `recharts`: 트렌드 차트 라이브러리

## Global Constraints
- 모든 credentials는 환경변수로만 참조 (GOOGLE_CREDENTIALS, SHEETS_ID)
- TypeScript strict 모드 유지
- Next.js 14 App Router 패턴 유지
- KPI 카드 "우리 브랜드"는 삼성화재로 고정
