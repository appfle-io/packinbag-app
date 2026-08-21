// RevenueCat 대시보드에서 만든 "Entitlement" 식별자. lib/purchaseService.ts(클라이언트,
// 구매 성공 여부 판정)와 app/api/revenuecat-webhook(서버, 웹훅 이벤트가 이 entitlement를
// 포함하는지 확인)가 똑같은 문자열을 써야 해서 별도 파일로 분리해뒀다.
//
// ⚠️ RevenueCat 대시보드에서 Entitlement를 만들 때 반드시 이 값과 똑같은 식별자
// ("premium")로 만들어야 한다 - 다르면 구매해도 프리미엄으로 인식되지 않는다.
export const PREMIUM_ENTITLEMENT_ID = "premium";
