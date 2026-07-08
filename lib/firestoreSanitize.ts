// Firestore의 setDoc/addDoc은 필드값으로 undefined를 절대 허용하지 않는다
// (null은 되지만 undefined는 즉시 예외를 던짐). 앱 코드 여기저기서 "이 필드 비워두기"
// 의도로 undefined를 넣는 경우가 있을 수 있어서, 실제로 쓰기 직전에 한 번 걸러준다.
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      result[key] = stripUndefined(v);
    }
    return result as T;
  }
  return value;
}
