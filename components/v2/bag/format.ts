import { formatDDayLabel } from "@/lib/dday";

function timeLabel(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${String(m).padStart(2, "0")}`;
}

// "오늘 오후 6:20" / "어제 오후 6:20" / "9월 24일" / "2025년 9월 24일"
export function formatRelativeDay(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diffDays === 0) return `오늘 ${timeLabel(d)}`;
  if (diffDays === 1) return `어제 ${timeLabel(d)}`;
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// "10월 12일 · D-12"
export function formatTravelDate(travelDate: string | undefined, countTodayAsDayOne?: boolean): string | null {
  if (!travelDate) return null;
  const [y, m, d] = travelDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dday = formatDDayLabel(travelDate, !!countTodayAsDayOne);
  return `${m}월 ${d}일${dday ? ` · ${dday}` : ""}`;
}