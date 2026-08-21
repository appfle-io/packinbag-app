import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { PREMIUM_ENTITLEMENT_ID } from "@/lib/purchaseConfig";

// RevenueCat 대시보드 > Project settings > Integrations > Webhooks 에서 이 라우트의
// 전체 URL(https://packinbag.seeuson.com/api/revenuecat-webhook)을 등록하고,
// "Authorization header" 값에 REVENUECAT_WEBHOOK_AUTH_HEADER(.env.local/Vercel)와
// 똑같은 값을 넣어야 한다. RevenueCat은 매 웹훅 요청마다 그 값을 Authorization 헤더에
// 그대로 실어 보내므로, 아래에서 그 값을 다시 대조해서 진짜 RevenueCat이 보낸 요청인지
// 확인한다(값을 모르는 사람이 이 URL로 직접 요청을 보내 프리미엄을 위조하는 것을 막기 위함).
export const runtime = "nodejs";

// 프리미엄(라이프타임) entitlement를 "부여"하는 이벤트 - 최초 구매, 그리고 방어적으로
// 구독형/이전 이벤트 타입도 함께 포함해둔다(우리는 구독을 안 팔지만, 나중에 실수로 다른
// 상품을 추가하거나 RevenueCat이 이벤트를 재전송할 때를 대비).
const GRANT_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "NON_RENEWING_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "TRANSFER",
]);

// 프리미엄을 "회수"하는 이벤트 - 환불/취소. 라이프타임(비소모성) 구매도 애플이 환불을
// 승인하면 RevenueCat이 CANCELLATION 이벤트를 보내준다.
const REVOKE_EVENT_TYPES = new Set(["CANCELLATION"]);

export async function POST(req: NextRequest) {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH_HEADER;
  const received = req.headers.get("authorization") ?? "";
  if (!expected || received !== expected) {
    console.error("[팩인백] RevenueCat 웹훅 인증 실패");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const event = (body as { event?: Record<string, unknown> })?.event ?? {};
  const type = event.type as string | undefined;
  // RevenueCat 초기화 시 appUserID를 항상 Firebase uid로 넘겨뒀으므로(lib/purchaseService.ts
  // ensurePurchasesConfigured), app_user_id가 곧 users 컬렉션의 문서 id다.
  const uid = event.app_user_id as string | undefined;
  const entitlementIds = (event.entitlement_ids as string[] | undefined) ?? [];
  const productId = (event.product_id as string | undefined) ?? null;
  const store = event.store as string | undefined;

  // RevenueCat 대시보드의 "테스트 발송" 등 app_user_id가 없는 이벤트는 무시.
  if (!uid || !type) {
    return NextResponse.json({ received: true });
  }

  if (!entitlementIds.includes(PREMIUM_ENTITLEMENT_ID)) {
    return NextResponse.json({ received: true });
  }

  const platform: "ios" | "android" | null =
    store === "APP_STORE" ? "ios" : store === "PLAY_STORE" ? "android" : null;

  try {
    const db = adminDb();
    const userRef = db.collection("users").doc(uid);

    if (GRANT_EVENT_TYPES.has(type)) {
      await userRef.set(
        {
          premiumPurchase: {
            purchased: true,
            purchasedAt: new Date().toISOString(),
            productId,
            platform,
          },
        },
        { merge: true }
      );
    } else if (REVOKE_EVENT_TYPES.has(type)) {
      await userRef.set(
        {
          premiumPurchase: {
            purchased: false,
            purchasedAt: new Date().toISOString(),
            productId,
            platform,
          },
        },
        { merge: true }
      );
    }
    // 그 외 이벤트 타입(BILLING_ISSUE 등, 구독 전용이라 우리 라이프타임 상품과는 무관)은
    // 그냥 무시한다.
  } catch (err) {
    console.error("[팩인백] RevenueCat 웹훅 처리 실패:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
