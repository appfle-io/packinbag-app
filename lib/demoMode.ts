// 체험 모드(offline.md OFF-DEMO, 2026-10-18).
// /about 소개 페이지 안에서 팩인백을 로그인 없이 바로 써 보게 하는 모드다. 오프라인 모드 위에 얹는다.
// - 주소에 ?demo=1이 있을 때만 켜지고, 이 탭(sessionStorage) 안에서만 유지된다. 다음 방문에 저절로 켜지지 않는다
// - 이 브라우저에 로그인 세션이 있어도 무시한다(실제 계정이 체험 화면에 뜨지 않게)
// - 저장은 lib/localBagsService가 sessionStorage + "pib_demo_" 키로 따로 한다(탭을 닫으면 사라짐)
// - pib_offline_mode(진짜 오프라인 모드 표시)는 쓰지 않는다

const DEMO_FLAG_KEY = "pib_demo_mode";

let cached: boolean | null = null;

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  if (cached !== null) return cached;
  try {
    const q = new URLSearchParams(window.location.search).get("demo");
    if (q === "1") sessionStorage.setItem(DEMO_FLAG_KEY, "1");
    // 새 탭으로 열 때 브라우저가 sessionStorage를 복사할 수 있어서, ?demo=0이면 표시를 지운다
    if (q === "0") sessionStorage.removeItem(DEMO_FLAG_KEY);
    cached = sessionStorage.getItem(DEMO_FLAG_KEY) === "1";
  } catch {
    cached = false;
  }
  return cached;
}

// 체험 안내 줄 · 막힘 안내에 쓰는 문구
export const DEMO_BLOCKED_MESSAGE = "체험에서는 쓸 수 없어요. 로그인하면 쓸 수 있어요";

// "시작하기": 체험이 아닌 팩인백 첫 화면을 새 탭으로 연다(iframe 안이어도 바깥 창에서 열림)
export function openRealApp() {
  if (typeof window === "undefined") return;
  window.open("/?demo=0", "_blank", "noopener");
}
