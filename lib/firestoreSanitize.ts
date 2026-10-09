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

// 보관함 팩을 서버가 만들 때(create-library-pack · trash-bag-pack · import-shared-pack) 클라이언트가 보낸 값에서
// 서버만 정하는 필드를 버린다(2026-10-09). 예전에는 그대로 펼쳐 저장해서,
// isQuickPack:true로 무료 개수 한도·잠금을 피하거나 locked:false로 잠긴 팩을 풀 수 있었다.
const SERVER_ONLY_PACK_FIELDS = ["locked", "trashedAt", "trashSourceBagId", "trashSourceBagName", "isQuickPack"];

export function stripServerOnlyPackFields<T extends object>(pack: T): T {
  const copy = { ...pack } as unknown as Record<string, unknown>;
  for (const key of SERVER_ONLY_PACK_FIELDS) delete copy[key];
  return copy as unknown as T;
}

// 클라이언트가 정한 문서 id를 그대로 쓸 수 있는지(슬래시·빈 값·너무 긴 값은 안 됨)
export function isSafeDocId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 128 && !id.includes("/") && id !== "." && id !== "..";
}
