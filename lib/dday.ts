// 여행일(D-Day) 관련 계산 헬퍼

// travelDate(YYYY-MM-DD) 기준으로 오늘까지 남은 일수. 지났으면 음수.
export function daysUntil(travelDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${travelDate}T00:00:00`);
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// 카드/배지에 보여줄 짧은 라벨.
// - 여행일 전: D-N
// - 여행 당일: D-DAY (countTodayAsDayOne이 true면 대신 D+1로 표시)
// - 여행일이 지난 뒤: D+N (며칠 지났는지)
//   countTodayAsDayOne이 false(기본값)면 여행 다음날 = D+1, 그다음날 = D+2 ...
//   countTodayAsDayOne이 true면 여행 당일부터 "1일째"로 세서 D+1, 다음날 D+2 ...
//   (즉 지난 일수에 +1을 해서, 당일도 하루로 포함해 카운트한다)
export function formatDDayLabel(
  travelDate?: string,
  countTodayAsDayOne: boolean = false
): string | null {
  if (!travelDate) return null;
  const diff = daysUntil(travelDate);
  if (diff > 0) return `D-${diff}`;

  const elapsed = -diff; // 0 = 여행 당일, 1 = 하루 지남, 2 = 이틀 지남 ...
  if (countTodayAsDayOne) return `D+${elapsed + 1}`;
  if (elapsed === 0) return "D-DAY";
  return `D+${elapsed}`;
}
