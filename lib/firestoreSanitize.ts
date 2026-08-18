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

// 임시 진단용(2026-08) - 저장 직전 "실제 JS 객체"를 재귀 검사해서 Firestore가 거부할 만한
// 지점(배열 속 배열, undefined, class 인스턴스/Map/Set/함수 등)의 정확한 경로를 찾는다.
// JSON.stringify로 콘솔에 로그를 찍으면 toJSON()이 정의된 객체가 자동으로 "정상"처럼
// 보여서 못 잡아내는 경우가 있어서, 문자열로 찍기 전에 원본 객체를 직접 훑어본다.
// 원인 찾으면 이 함수와 호출부(bagsService.saveBagRemote 등)는 지워도 된다.
export function findInvalidFirestoreEntity(
  value: unknown,
  path = "root",
  parentIsArray = false
): string | null {
  if (Array.isArray(value)) {
    if (parentIsArray) return `${path} → 배열 안에 배열이 직접 들어있음`;
    for (let i = 0; i < value.length; i++) {
      const r = findInvalidFirestoreEntity(value[i], `${path}[${i}]`, true);
      if (r) return r;
    }
    return null;
  }
  if (value === undefined) return `${path} → undefined`;
  if (typeof value === "function" || typeof value === "symbol") {
    return `${path} → ${typeof value} (Firestore 저장 불가)`;
  }
  if (value instanceof Date) return null; // Date는 정상
  if (value !== null && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return `${path} → 일반 객체가 아님 (${proto?.constructor?.name ?? "?"} 인스턴스)`;
    }
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const r = findInvalidFirestoreEntity(v, `${path}.${k}`, false);
      if (r) return r;
    }
  }
  return null;
}
