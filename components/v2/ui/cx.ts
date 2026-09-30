// className 조합 헬퍼. falsy 값은 버린다.
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
