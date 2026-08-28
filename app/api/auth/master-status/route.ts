import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser, ServerAuthError } from "@/lib/premiumServer";
import { checkIsMaster, syncMasterStateBackground } from "@/lib/adminApiAuth";
import { syncOwnedBagLocks } from "@/lib/bagLockSync";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const verified = await verifyRequestUser(req);
    const isMaster = await checkIsMaster(verified.uid, verified.email);

    if (isMaster) {
      syncMasterStateBackground(verified.uid, verified.email);
      // 마스터의 과거 잠겼던 가방들을 전부 unlocked로 즉시 복구
      syncOwnedBagLocks(verified.uid).catch((err) => {
        console.error("[팩인백] 마스터 가방 잠금 해제 실패:", err);
      });
    }

    return NextResponse.json({ isMaster });
  } catch (err) {
    if (err instanceof ServerAuthError) {
      return NextResponse.json({ isMaster: false }, { status: 401 });
    }
    return NextResponse.json({ isMaster: false }, { status: 200 });
  }
}

