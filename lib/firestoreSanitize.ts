// Firestore의 setDoc/addDoc은 필드값으로 undefined를 절대 허용하지 않는다
// (null은 되지만 undefined는 즉시 예외를 던짐). 앱 코드 여기저기서 "이 필드 비워두기"
// 의도로 undefined를 넣는 경우가 있을 수 있어서, 실제로 쓰기 직전에 한 번 걸러준다.
//
// 2026-08: Firestore는 배열 "안"에 배열을 직접 넣는 것도 허용하지 않는다(중첩 배열 -
// "Property array contains an invalid nested entity" 에러). 짐/팩 배열 자체는 항상
// 객체를 담고 있어 정상적으로는 발생하지 않지만, 예전 버전에서 만들어진 데이터나
// 에디터(TipTap) 문서가 예상치 못하게 배열을 품고 있으면 실시간 저장이 계속 실패해서
// 그 팩을 가방에 넣는 순간부터 자동저장 자체가 막혀버린다("[팩인백] 실시간 저장 실패").
// 그런 값을 만나면 저장을 막는 대신 { list: [...] }로 감싸서 저장은 되게 하고, 어느
// 경로(path)에서 걸렸는지 콘솔에 남겨서 다음에 같은 문제가 생기면 원인을 바로 찾을 수
// 있게 한다.
export function stripUndefined<T>(value: T): T {
  return sanitizeForFirestore(value, "root") as T;
}

function sanitizeForFirestore(value: unknown, path: string): unknown {
  if (Array.isArray(value)) {
    return value
      .filter((v) => v !== undefined)
      .map((v, i) => {
        const cleaned = sanitizeForFirestore(v, `${path}[${i}]`);
        if (Array.isArray(cleaned)) {
          console.warn(
            `[팩인백] Firestore는 배열 안에 배열을 직접 저장할 수 없어요. "${path}[${i}]"에서 ` +
              `중첩 배열을 발견해 { list: [...] } 형태로 감싸서 저장했어요 - 원인 데이터를 확인해보세요:`,
            cleaned
          );
          return { list: cleaned };
        }
        return cleaned;
      });
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      result[key] = sanitizeForFirestore(v, path ? `${path}.${key}` : key);
    }
    return result;
  }
  return value;
}
