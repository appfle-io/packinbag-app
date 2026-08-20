import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyRequestUser, ServerAuthError } from "@/lib/premiumServer";

// 설정 > "짧은 URL 사용하기" 하단의 "내가 만든 URL 관리" 모달에서 쓰는 목록 조회 라우트.
// shortLinks(/s/{code})와 customShortLinks(/c/{code}) 두 컬렉션 모두 firestore.rules에서
// client read/write를 전부 막아뒀으므로(app/api/shorten-url 등과 동일한 이유) 여기서도
// Admin SDK로 createdBy === 본인 uid인 문서만 걸러서 돌려준다.
// createdAt 정렬은 Firestore 쿼리(orderBy)에 얹지 않고 응답을 받은 뒤 여기서 직접 정렬한다 -
// where(createdBy)+orderBy(createdAt) 조합은 컬렉션마다 복합 색인을 추가로 만들어야 해서,
// 그 배포 부담 없이 바로 동작하게 하기 위함(문서 수가 사용자당 아주 많지 않을 것으로 가정).
export const runtime = "nodejs";

interface LinkDoc {
  kind: "s" | "c";
  code: string;
  longUrl: string;
  label: string | null;
  createdAt: string;
}

export async function GET(req: NextRequest) {
  let uid: string;
  try {
    const verified = await verifyRequestUser(req);
    uid = verified.uid;
  } catch (err) {
    if (err instanceof ServerAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "로그인 정보를 확인할 수 없어요" }, { status: 401 });
  }

  const db = adminDb();
  const [shortSnap, customSnap] = await Promise.all([
    db.collection("shortLinks").where("createdBy", "==", uid).get(),
    db.collection("customShortLinks").where("createdBy", "==", uid).get(),
  ]);

  const links: LinkDoc[] = [
    ...shortSnap.docs.map((d) => {
      const data = d.data();
      return {
        kind: "s" as const,
        code: d.id,
        longUrl: data.longUrl as string,
        label: (data.label as string | null) ?? null,
        createdAt: (data.createdAt as string) ?? "",
      };
    }),
    ...customSnap.docs.map((d) => {
      const data = d.data();
      return {
        kind: "c" as const,
        code: d.id,
        longUrl: data.longUrl as string,
        label: (data.label as string | null) ?? null,
        createdAt: (data.createdAt as string) ?? "",
      };
    }),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

  const configuredBase = process.env.SHORT_URL_BASE_URL?.trim().replace(/\/+$/, "");
  const origin = configuredBase || req.nextUrl.origin;
  const result = links.map((l) => ({
    ...l,
    shortUrl: `${origin}/${l.kind}/${l.code}`,
  }));

  return NextResponse.json({ links: result });
}
