import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { UNLOCK_CODE_LENGTH } from "@/lib/aiUsageConfig";

// 이용권 코드 "사용 처리(claim)"를 서버에서만 하도록 만든 라우트.
//
// 왜 서버가 필요한가: 코드 1개는 1명만 쓸 수 있어야 한다(선점 방식). 클라이언트가 직접
// Firestore에 코드를 "먼저 썼다"고 기록하게 허용하면, devtools로 같은 코드를 여러 계정이
// 동시에 자기 것으로 우겨넣을 수 있다. 그래서 "이 코드가 이미 다른 사람 것인지" 확인하고
// "내 것으로 확정"하는 두 동작을 트랜잭션으로 묶어서, 서버(Admin SDK, 클라이언트가 우회 불가)가
// 직접 처리한다.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }

  const rawCode = (body as { code?: unknown })?.code;
  const code = typeof rawCode === "string" ? rawCode.trim().toUpperCase() : "";
  if (code.length !== UNLOCK_CODE_LENGTH) {
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
  const codeRef = db.collection("unlockCodes").doc(code);
  const userRef = db.collection("users").doc(uid);

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

      // status가 'claimed'이면서 이미 내가 그 주인인 경우(같은 코드 재입력)는 그대로 통과 -
      // 새로 쓸 내용이 지금과 동일하므로 아래 set을 다시 해도 안전하다(멱등).
      tx.set(
        codeRef,
        {
          status: "claimed",
          claimedBy: { uid, email, claimedAt: new Date() },
        },
        { merge: true }
      );
      tx.set(userRef, { unlockCode: code }, { merge: true });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
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

  return NextResponse.json({ success: true });
}
