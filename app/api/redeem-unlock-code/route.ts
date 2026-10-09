import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { recordAuditLog } from "@/lib/auditLog";
import { UNLOCK_CODE_LENGTH, todayKstKey } from "@/lib/aiUsageConfig";

// 이용권 코드 "사용 처리(claim)"를 서버에서만 하도록 만든 라우트.
//
// 왜 서버가 필요한가: 코드 1개는 1명만 쓸 수 있어야 한다(선점 방식). 클라이언트가 직접
// Firestore에 코드를 "먼저 썼다"고 기록하게 허용하면, devtools로 같은 코드를 여러 계정이
// 동시에 자기 것으로 우겨넣을 수 있다. 그래서 "이 코드가 이미 다른 사람 것인지" 확인하고
// "내 것으로 확정"하는 두 동작을 트랜잭션으로 묶어서, 서버(Admin SDK, 클라이언트가 우회 불가)가
// 직접 처리한다.
export const runtime = "nodejs";

// 틀린 코드 입력은 하루 이 횟수까지(계정마다, KST 자정에 초기화). 코드를 대입해 찾는 것과,
// 그 과정의 Firestore 읽기 비용을 막는다(2026-10-09). 맞는 코드는 횟수에 들어가지 않는다.
// unlockRedeemUsage는 firestore.rules에 규칙이 없어 클라이언트는 읽거나 쓸 수 없다(Admin SDK만).
const MAX_FAILED_ATTEMPTS_PER_DAY = 10;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }

  const rawCode = (body as { code?: unknown })?.code;
  const code = typeof rawCode === "string" ? rawCode.trim().toUpperCase() : "";
  if (code.length !== UNLOCK_CODE_LENGTH || !/^[A-Z0-9]+$/.test(code)) {
    return NextResponse.json({ error: "코드를 다시 확인해주세요" }, { status: 400 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) {
    return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  }

  let uid: string;
  let email: string | null;
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
    email = decoded.email ?? null;
  } catch (err) {
    console.error("[팩인백] 이용권 코드 로그인 토큰 검증 실패:", err);
    return NextResponse.json(
      { error: "로그인 정보를 확인할 수 없어요. 다시 로그인해주세요" },
      { status: 401 }
    );
  }

  const db = adminDb();
  const failRef = db.collection("unlockRedeemUsage").doc(`${uid}_${todayKstKey()}`);
  try {
    const failSnap = await failRef.get();
    if (((failSnap.data()?.fails as number | undefined) ?? 0) >= MAX_FAILED_ATTEMPTS_PER_DAY) {
      return NextResponse.json(
        { error: "코드를 너무 많이 틀렸어요. 내일 다시 시도해주세요" },
        { status: 429 }
      );
    }
  } catch (err) {
    console.error("[팩인백] 이용권 입력 횟수 조회 실패:", err);
    return NextResponse.json({ error: "코드 확인에 실패했어요. 잠시 후 다시 시도해주세요" }, { status: 500 });
  }
  const countFailure = () =>
    failRef
      .set({ fails: FieldValue.increment(1), uid, updatedAt: new Date() }, { merge: true })
      .catch((err) => console.error("[팩인백] 이용권 입력 횟수 기록 실패:", err));

  const codeRef = db.collection("unlockCodes").doc(code);
  const userRef = db.collection("users").doc(uid);
  let expiresAtIso: string | null = null;

  try {
    await db.runTransaction(async (tx) => {
      const codeSnap = await tx.get(codeRef);
      if (!codeSnap.exists) {
        throw new Error("NOT_FOUND");
      }

      const data = codeSnap.data() ?? {};
      const status = (data.status as string | undefined) ?? "unused";
      const claimedBy = data.claimedBy as { uid?: string } | undefined;

      if (status === "invalidated") {
        throw new Error("INVALIDATED");
      }

      if (status === "claimed" && claimedBy?.uid && claimedBy.uid !== uid) {
        throw new Error("ALREADY_CLAIMED");
      }

      if (status === "claimed" && claimedBy?.uid === uid) {
        // 같은 코드를 같은 사람이 다시 입력한 경우: 이미 적용된 상태이므로 만료 시각을
        // 다시 계산하지 않고(연장/재시작 방지), 혹시 유저 문서 쪽 필드가 지워졌을 때를
        // 대비해 기존 expiresAt 값만 다시 동기화한다.
        const existingExpiresAt = data.expiresAt as { toDate?: () => Date } | null | undefined;
        const iso =
          existingExpiresAt && typeof existingExpiresAt.toDate === "function"
            ? existingExpiresAt.toDate().toISOString()
            : null;
        expiresAtIso = iso;
        tx.set(userRef, { unlockCode: code, unlockCodeExpiresAt: iso }, { merge: true });
        return;
      }

      // 처음 사용 처리하는 경우: 코드에 설정된 기간(durationDays)만큼 "지금부터"
      // 만료 시각을 계산한다. durationDays가 없거나 null이면 무제한(만료 없음).
      const durationDays = data.durationDays as number | null | undefined;
      const now = new Date();
      const expiresAt =
        typeof durationDays === "number" && durationDays > 0
          ? new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)
          : null;
      expiresAtIso = expiresAt ? expiresAt.toISOString() : null;

      tx.set(
        codeRef,
        {
          status: "claimed",
          claimedBy: { uid, email, claimedAt: now },
          expiresAt,
        },
        { merge: true }
      );
      tx.set(
        userRef,
        { unlockCode: code, unlockCodeExpiresAt: expiresAtIso },
        { merge: true }
      );
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
    if (message === "NOT_FOUND" || message === "INVALIDATED" || message === "ALREADY_CLAIMED") {
      await countFailure();
    }
    if (message === "NOT_FOUND") {
      return NextResponse.json({ error: "코드를 다시 확인해주세요" }, { status: 404 });
    }
    if (message === "INVALIDATED") {
      return NextResponse.json({ error: "더 이상 사용할 수 없는 코드예요" }, { status: 400 });
    }
    if (message === "ALREADY_CLAIMED") {
      return NextResponse.json({ error: "이미 다른 계정에서 사용된 코드예요" }, { status: 409 });
    }
    console.error("[팩인백] 이용권 코드 사용 처리 실패:", err);
    return NextResponse.json({ error: "코드 확인에 실패했어요. 잠시 후 다시 시도해주세요" }, { status: 500 });
  }

  await recordAuditLog({
    uid,
    email,
    action: "unlock_code_redeem",
    targetType: "unlockCode",
    targetId: code,
    meta: { expiresAt: expiresAtIso },
  });

  return NextResponse.json({ success: true, expiresAt: expiresAtIso });
}
