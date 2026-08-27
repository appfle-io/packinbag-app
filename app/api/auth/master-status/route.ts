import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser, ServerAuthError } from "@/lib/premiumServer";
import { checkIsMaster, syncMasterStateBackground } from "@/lib/adminApiAuth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const verified = await verifyRequestUser(req);
    const isMaster = await checkIsMaster(verified.uid, verified.email);

    if (isMaster) {
      syncMasterStateBackground(verified.uid, verified.email);
    }

    return NextResponse.json({ isMaster });
  } catch (err) {
    if (err instanceof ServerAuthError) {
      return NextResponse.json({ isMaster: false }, { status: 401 });
    }
    return NextResponse.json({ isMaster: false }, { status: 200 });
  }
}
