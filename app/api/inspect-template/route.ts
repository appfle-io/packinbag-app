import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { verifyAndCheckAiQuota, consumeAiQuota, AiAuthError } from "@/lib/aiQuotaServer";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // 2026-07: 이 라우트도 결국 Gemini를 호출하는데(다른 5개 AI 라우트 - ai-travel-places,
  // ai-weather-recommend, generate-sample, import-note, organize-bag - 와 동일), quota 체크가
  // 이것만 빠져있어서 로그인만 되어있으면 무제한으로 반복 호출해 비용을 소모시킬 수 있는
  // 구멍이었다. 나머지 라우트와 완전히 같은 패턴으로 맞춘다.
  let quota;
  try {
    quota = await verifyAndCheckAiQuota(req);
  } catch (err) {
    if (err instanceof AiAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[팩인백] AI 할당량 확인 실패(템플릿 심사):", err);
    return NextResponse.json({ error: "AI 사용량 확인에 실패했어요" }, { status: 500 });
  }
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `오늘 무료 AI 사용 한도(${quota.limit}회)를 다 썼어요. 내일 다시 시도하거나, 설정 > 이용권 코드에서 코드를 입력하면 무제한으로 쓸 수 있어요`,
        limitReached: true,
        usedCount: quota.usedCount,
        limit: quota.limit,
      },
      { status: 403 }
    );
  }

  // verifyAndCheckAiQuota가 이미 idToken을 검증해서 uid를 확정해준다 - 여기서는 로그 기록용
  // 이메일만 한 번 더 가볍게 조회한다(실패해도 로그의 email 필드만 비게 될 뿐 치명적이지 않음).
  const uid = quota.uid;
  let email: string | null = null;
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (idToken) {
      const decoded = await adminAuth().verifyIdToken(idToken);
      email = decoded.email ?? null;
    }
  } catch (err) {
    console.warn("[팩인백] 템플릿 심사 이메일 조회 예외(치명적이지 않음):", err);
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
  let geminiCallSucceeded = false;

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
            geminiCallSucceeded = true;
          }
        } catch (e) {
          console.error("[팩인백] AI 심사 JSON 파싱 실패:", e);
        }
      }
    } catch (err) {
      console.error("[팩인백] AI 템플릿 심사 호출 실패:", err);
    }
  }

  // Gemini 호출이 실제로 성공했을 때만(다른 AI 라우트들과 동일한 원칙) 무료 사용자의
  // 오늘 사용 횟수를 차감한다. API 키 미설정이거나 Gemini 호출/파싱이 실패해서 안전 판정을
  // 못 내린 경우(safe=true 기본값으로 그냥 통과)는 실제 비용이 안 나갔으므로 차감하지 않는다.
  if (geminiCallSucceeded && !quota.unlimited) {
    await consumeAiQuota(quota.uid);
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
