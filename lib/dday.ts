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

// 짐 마감일(Item.dueDate) 표시용. 설정(프로필 packSettings.dueDateDisplayMode)에 따라
// D-day 표기나 실제 날짜로 보여준다. D-day 계산 가여(당일 포함 여부)는 이 짐이 속한
// 가방의 ddayCountTodayAsDayOne을 그대로 따라서, 가방 상단 D-day와 세는 기준이 항상 같다.
export function formatItemDueLabel(
  dueDate: string | undefined,
  displayMode: "dday" | "date" = "dday",
  countTodayAsDayOne: boolean = false
): string | null {
  if (!dueDate) return null;
  if (displayMode === "date") {
    const [, m, d] = dueDate.split("-");
    return `${Number(m)}/${Number(d)}`;
  }
  return formatDDayLabel(dueDate, countTodayAsDayOne);
}

// 짐 마감일이 지났는지(오늘을 지난 지)에 따라 뱃지 색상을 구분하기 위한 간단 판정.
export function getDueUrgency(dueDate: string | undefined): "overdue" | "soon" | "normal" {
  if (!dueDate) return "normal";
  const diff = daysUntil(dueDate);
  if (diff < 0) return "overdue";
  if (diff <= 1) return "soon";
  return "normal";
}
