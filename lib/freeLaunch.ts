// 출시 기념 전원 무료 스위치(2026-10-09).
//
// 배경: 한국 거주 개인이 App Store에서 유료 판매(앱 가격·인앱결제)를 하려면 사업자등록번호가 필요한데,
// 직장인이라 지금은 사업자를 낼 수 없다. 그래서 결제 없이 무료 앱으로 먼저 출시한다.
//
// true인 동안:
// - 모든 사용자를 프리미엄으로 본다(서버 isPremiumServer, 화면 isPremiumUser) → 가방·참여·팩 개수 제한 없음,
//   공유 10명, 사진 5장, 메모 PDF·파일 첨부, 커스텀 URL, 잠금 해제
// - AI는 그대로 하루 3회(비용). 프리미엄 전용이던 "AI로 정리하기·AI 클립보드"도 하루 3회 안에서 쓸 수 있다
// - storage.rules의 freeLaunch()도 같이 true여야 한다(규칙 파일은 이 값을 못 읽음)
//
// 결제를 붙일 때: 이 값을 false로, storage.rules freeLaunch()를 false로 → 배포. 자세한 순서는
// docs/packinbag_iap_release_guide.md "B. 결제 도입".
export const FREE_LAUNCH = true;
