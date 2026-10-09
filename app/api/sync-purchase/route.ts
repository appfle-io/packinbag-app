import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, ServerAuthError } from "@/lib/premiumServer";
import { PREMIUM_ENTITLEMENT_ID } from "@/lib/purchaseConfig";

// 구매·복원 직후 앱이 부르는 라우트(lib/purchaseService.ts syncPurchaseToServer, 2026-10-09).
//
// 왜 필요한가: 프리미엄 최종 판정은 서버가 users/{uid}.premiumPurchase를 본다(isPremiumServer·AI·storage.rules).
// 그 값은 원래 RevenueCat 웹훅(app/api/revenuecat-webhook)만 썼는데,
// - 웹훅은 몇 초~몇 분 늦게 오고(샌드박스는 더 늦기도 함), 그동안 화면·서버가 무료로 본다
// - 같은 계정에서 "구매 복원"을 하면 새 이벤트가 없어 웹훅이 오지 않는다
// 그래서 앱이 구매·복원을 마치면 서버가 RevenueCat REST API로 이 사람의 entitlement를 직접 확인해서 바로 기록한다.
// 클라이언트가 "샀다"고 말하는 걸 믿는 게 아니라 RevenueCat 서버에 물어보므로 위조할 수 없다.
//
// 이 라우트는 "부여"만 한다. 해제(환불)는 웹훅 CANCELLATION이 맡는다 - RevenueCat 응답이 이상할 때
// 산 사람의 프리미엄을 실수로 빼앗지 않기 위함.
//
// 환경변수 REVENUECAT_SECRET_API_KEY: RevenueCat 대시보드 > Project settings > API keys >
// "Secret API keys"에서 만든 v1 비밀 키(sk_로 시작). 서버 전용 - 절대 NEXT_PUBLIC_를 붙이지 않는다.
export const runtime = "nodejs";

interface RcEntitlement {
  expires_date?: string | null;
  purchase_date?: string | null;
  product_identifier?: string | null;
}

export async function POST(req: NextRequest) {
  let uid: string;
  try {
    uid = (await verifyRequestUser(req)).uid;
  } catch (err) {
    const message = err instanceof ServerAuthError ? err.message : "로그인이 필요해요";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const secret = process.env.REVENUECAT_SECRET_API_KEY;
  if (!secret) {
    console.error("[팩인백] REVENUECAT_SECRET_API_KEY가 설정되지 않았어요(웹훅만으로 반영됨)");
    return NextResponse.json({ premium: false, synced: false });
  }

  let entitlement: RcEntitlement | undefined;
  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[팩인백] RevenueCat 구매 조회 실패:", res.status, await res.text().catch(() => ""));
      return NextResponse.json({ premium: false, synced: false });
    }
    const data = (await res.json()) as {
      subscriber?: { entitlements?: Record<string, RcEntitlement> };
    };
    entitlement = data.subscriber?.entitlements?.[PREMIUM_ENTITLEMENT_ID];
  } catch (err) {
    console.error("[팩인백] RevenueCat 구매 조회 예외:", err);
    return NextResponse.json({ premium: false, synced: false });
  }

  // 영구구매는 expires_date가 null. 혹시 기간형이면 아직 안 지났을 때만
  const active =
    !!entitlement && (!entitlement.expires_date || Date.parse(entitlement.expires_date) > Date.now());
  if (!active) {
    return NextResponse.json({ premium: false, synced: true });
  }

  try {
    await adminDb()
      .collection("users")
      .doc(uid)
      .set(
        {
          premiumPurchase: {
            purchased: true,
            purchasedAt: entitlement?.purchase_date ?? new Date().toISOString(),
            productId: entitlement?.product_identifier ?? null,
            // 지금은 iOS만 판매한다(Android를 붙이면 RevenueCat 응답의 store로 구분)
            platform: "ios",
          },
        },
        { merge: true }
      );
  } catch (err) {
    console.error("[팩인백] 구매 기록 실패:", err);
    return NextResponse.json({ premium: false, synced: false }, { status: 500 });
  }

  return NextResponse.json({ premium: true, synced: true });
}
