import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) {
    return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  }

  let uid: string;
  let email: string | null = null;
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
    email = decoded.email ?? null;
  } catch (err) {
    console.error("[팩인백] 템플릿 심사 로그인 토큰 검증 실패:", err);
    return NextResponse.json({ error: "로그인 정보를 확인할 수 없어요" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }

  const packNameRaw = (body as { name?: unknown })?.name;
  const itemsRaw = (body as { items?: unknown })?.items;
  const nicknameRaw = (body as { nickname?: unknown })?.nickname;

  const packName = typeof packNameRaw === "string" ? packNameRaw.trim().slice(0, 50) : "";
  const userNickname = typeof nicknameRaw === "string" ? nicknameRaw.trim() : "사용자";

  if (!packName) {
    return NextResponse.json({ error: "팩 이름을 입력해주세요" }, { status: 400 });
  }

  const itemsList: string[] = Array.isArray(itemsRaw)
    ? itemsRaw
        .filter((i): i is string | { text: string } => typeof i === "string" || (typeof i === "object" && !!i && "text" in i))
        .map((i) => (typeof i === "string" ? i : String(i.text ?? "")))
        .filter((t) => t.trim().length > 0)
        .slice(0, 50)
    : [];

  const apiKey = process.env.GEMINI_API_KEY;
  let safe = true;
  let reason = "";

  if (apiKey) {
    const systemPrompt = `당신은 체크리스트 팩 템플릿의 안전성과 적절성을 심사하는 유해성 모니터링 AI입니다.
아래 팩 이름과 짐 항목 목록을 분석하여, 욕설/비속어, 성인물, 도박, 불법 대출/주식 광고, 텔레그램 홍보, 개인정보 유출 또는 악의적인 문구가 들어있는지 판단하세요.

응답은 반드시 아래 JSON 형식으로만 하세요. 다른 설명이나 코드블록(\`\`\`)은 절대 포함하지 마세요.

{
  "safe": true 또는 false,
  "reason": "안전하지 않은 경우 사유 (한국어로 간결하게 1문장)"
}`;

    const userContent = `팩 이름: ${packName}\n짐 항목 목록:\n${itemsList.map((item, idx) => `${idx + 1}. ${item}`).join("\n")}`;

    try {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userContent }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        const cleaned = rawText.replace(/```json|```/g, "").trim();
        try {
          const parsed = JSON.parse(cleaned);
          if (typeof parsed.safe === "boolean") {
            safe = parsed.safe;
            reason = typeof parsed.reason === "string" ? parsed.reason : "";
          }
        } catch (e) {
          console.error("[팩인백] AI 심사 JSON 파싱 실패:", e);
        }
      }
    } catch (err) {
      console.error("[팩인백] AI 템플릿 심사 호출 실패:", err);
    }
  }

  // 관리자 모니터링을 위해 Firestore templateInspectLogs 컬렉션에 로그 기록
  try {
    const db = adminDb();
    await db.collection("templateInspectLogs").add({
      userUid: uid,
      userEmail: email ?? "",
      userNickname,
      packName,
      items: itemsList,
      safe,
      reason,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[팩인백] 템플릿 심사 로그 저장 실패:", err);
  }

  return NextResponse.json({
    safe,
    reason: safe ? undefined : (reason || "부적절하거나 유해한 내용이 포함되어 등록할 수 없어요."),
  });
}
