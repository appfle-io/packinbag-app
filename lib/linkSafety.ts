// 메모 · 아이템 링크 중 앱 내부 경로를 가리키는 것을 막는다(2026-10-22, memo.md MEMO-LINK-12).
// Capacitor 6.2.1 이하(CVE-2026-103922)는 앱 웹뷰 안에서 `/_capacitor_http_interceptor_` 같은
// 내부 경로로 가는 링크를 누르면 외부 내용이 앱 주소로 열린다. iOS 새 빌드(Capacitor 6.2.2)가
// 퍼질 때까지 웹에서 먼저 막는다. 정상 링크에는 이런 경로가 없으므로 앱 버전과 상관없이 둔다.
const BLOCKED_PATH_MARKER = "_capacitor_";

export function isBlockedAppInternalUrl(url: string): boolean {
  const raw = url.trim();
  if (!raw) return false;
  // 주소를 못 읽거나 인코딩을 섞어 숨겨도 걸리게, 원문과 풀어 쓴 글자 둘 다 본다
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // 잘못된 % 인코딩이면 원문만 본다
  }
  return [raw, decoded].some((s) => s.toLowerCase().includes(BLOCKED_PATH_MARKER));
}
