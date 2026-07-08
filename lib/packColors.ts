// 팩(카테고리)마다 붙일 수 있는 색상 태그 프리셋.
// 라이트/다크 모드 구분 없이 항상 같은 hex를 쓴다 (작은 점/태그용이라 대비 문제 없음).

export interface PackColorOption {
  id: string;
  hex: string; // "" 이면 무색(태그 없음)
  label: string;
}

export const PACK_COLORS: PackColorOption[] = [
  { id: "none", hex: "", label: "없음" },
  { id: "red", hex: "#ef4444", label: "레드" },
  { id: "orange", hex: "#f97316", label: "오렌지" },
  { id: "amber", hex: "#f59e0b", label: "옐로" },
  { id: "green", hex: "#22c55e", label: "그린" },
  { id: "teal", hex: "#14b8a6", label: "틸" },
  { id: "blue", hex: "#3b82f6", label: "블루" },
  { id: "purple", hex: "#a855f7", label: "퍼플" },
  { id: "pink", hex: "#ec4899", label: "핑크" },
];

export function getPackColorHex(id: string | undefined): string | null {
  if (!id) return null;
  const found = PACK_COLORS.find((c) => c.id === id);
  return found && found.hex ? found.hex : null;
}
