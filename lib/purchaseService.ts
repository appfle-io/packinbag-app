// 인앱결제(프리미엄 영구구매) 클라이언트 로직을 이 파일 하나에 모아둔다.
//
// ⚠️ 웹(브라우저)에서는 Apple/Google 인앱결제 자체가 불가능하다(정책상 당연히 막혀있음).
// 그래서 이 파일의 모든 함수는 Capacitor.isNativePlatform()이 true인 경우(iOS/Android 앱)
// 에서만 실제로 동작하고, 웹에서는 조용히 무력화되거나(fetchPremiumOffering이 null 반환)
// 명시적으로 에러를 던진다(purchasePremiumLifetime). 웹 사용자가 프리미엄이 되는 유일한
// 방법은 기존 이용권 코드 시스템(lib/aiUsageService.ts)뿐이다.
//
// RevenueCat의 appUserID를 항상 Firebase uid로 고정해서 초기화한다(ensurePurchasesConfigured).
// 이렇게 하면 RevenueCat 웹훅이 보내주는 app_user_id가 곧 우리 Firestore users/{uid} 문서의
// id와 완전히 같아서, 별도 매핑 테이블 없이 바로 users/{uid}.premiumPurchase를 갱신할 수 있다
// (app/api/revenuecat-webhook 참고).
//
// ⚠️ @revenuecat/purchases-capacitor의 정확한 타입은 실제 Xcode 연동 테스트를 해봐야
// 완전히 확정할 수 있어서, 일부 호출에 `as never`/`as any` 캐스팅을 열어뒀다(nativeAuth.ts와
// 동일한 방식). 런타임 동작 자체는 공식 문서 예제 그대로다.
"use client";

import { Capacitor } from "@capacitor/core";
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";
import { PREMIUM_ENTITLEMENT_ID } from "@/lib/purchaseConfig";

export { PREMIUM_ENTITLEMENT_ID };

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

// RevenueCat 대시보드 > Project settings > API keys 의 "Apple App Store" 공개(public) 키.
// 서버 비밀키가 아니라 클라이언트에 그대로 노출돼도 되는 값이라 NEXT_PUBLIC_ 접두사를 쓴다.
const REVENUECAT_IOS_API_KEY = process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY ?? "";

let configuredForUid: string | null = null;

// 앱 전체에서 로그인한 uid가 바뀔 때마다(최초 로그인 포함) 한 번만 다시 설정하면 된다.
// 웹에서는 아무 일도 하지 않는다(네이티브 전용 기능).
export async function ensurePurchasesConfigured(uid: string): Promise<void> {
  if (!isNativePlatform()) return;
  if (configuredForUid === uid) return;
  if (!REVENUECAT_IOS_API_KEY) {
    console.error("[팩인백] NEXT_PUBLIC_REVENUECAT_IOS_API_KEY가 설정되지 않았어요");
    return;
  }
  await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
  await Purchases.configure({ apiKey: REVENUECAT_IOS_API_KEY, appUserID: uid });
  configuredForUid = uid;
}

export interface PremiumOffering {
  productIdentifier: string;
  priceString: string;
  // RevenueCat 패키지 원본 객체 - purchasePremiumLifetime 호출 시 그대로 다시 넘겨야 한다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
}

// RevenueCat 대시보드에 "라이프타임 상품 1개"만 있는 오퍼링을 하나 구성해뒀다는 전제로,
// 현재(current) 오퍼링의 첫 번째 패키지를 그대로 구매 버튼에 쓴다.
export async function fetchPremiumOffering(): Promise<PremiumOffering | null> {
  if (!isNativePlatform()) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages?.[0];
    if (!pkg) return null;
    return {
      productIdentifier: pkg.product.identifier,
      priceString: pkg.product.priceString,
      raw: pkg,
    };
  } catch (err) {
    console.error("[팩인백] RevenueCat 오퍼링 조회 실패:", err);
    return null;
  }
}

export class PurchaseCancelledError extends Error {}

// 구매 완료 직후 entitlement가 바로 활성화됐는지(낙관적 신호, UI 즉시 업데이트용)를
// 반환한다. 실제 "영구 프리미엄" 최종 기록은 RevenueCat 웹훅(app/api/revenuecat-webhook)이
// 서버에서 Firestore(users/{uid}.premiumPurchase)에 남기므로, 이 반환값과 무관하게 곧 서버
// 쪽 기록도 뒤따라 반영된다(onSnapshot으로 실시간 구독 중이면 화면이 다시 한번 갱신됨).
export async function purchasePremiumLifetime(offering: PremiumOffering): Promise<boolean> {
  if (!isNativePlatform()) {
    throw new Error("웹에서는 구매할 수 없어요. 앱에서 진행해주세요");
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: offering.raw } as any);
    return !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    if (err?.userCancelled) {
      throw new PurchaseCancelledError("구매를 취소했어요");
    }
    throw err;
  }
}

// 기기 변경/앱 재설치 후 "이미 구매한 적 있음"을 되찾을 때 쓴다(설정 화면 "구매 복원" 버튼).
export async function restorePremiumPurchase(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  const { customerInfo } = await Purchases.restorePurchases();
  return !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];
}
