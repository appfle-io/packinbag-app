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

// 카드/배지에 보여줄 짧은 라벨. 여행일이 지났으면 null (배지 숨김).
export function formatDDayLabel(travelDate?: string): string | null {
  if (!travelDate) return null;
  const diff = daysUntil(travelDate);
  if (diff < 0) return null;
  if (diff === 0) return "D-DAY";
  return `D-${diff}`;
}
