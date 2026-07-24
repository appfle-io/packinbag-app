import { NextRequest, NextResponse } from "next/server";
import { verifyAndCheckAiQuota, consumeAiQuota, AiAuthError } from "@/lib/aiQuotaServer";

export const runtime = "nodejs";

function extractJsonItems(rawText: string): { text: string; icon: string }[] {
  if (!rawText) return [];
  try {
    const cleaned = rawText.replace(/```json|```/gi, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed) return [];

    let list: any[] = [];
    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (Array.isArray(parsed.items)) {
      list = parsed.items;
    } else if (typeof parsed === "object") {
      const firstArrayKey = Object.keys(parsed).find((k) => Array.isArray((parsed as any)[k]));
      if (firstArrayKey) list = (parsed as any)[firstArrayKey];
    }

    return list
      .filter((i) => i && typeof i === "object")
      .slice(0, 4)
      .map((i) => ({
        text: String(i.text || i.name || i.item || "").slice(0, 15) || "추천 짐",
        icon: String(i.icon || i.emoji || "✨"),
      }));
  } catch {
    const match = rawText.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const arr = JSON.parse(match[0]);
        if (Array.isArray(arr)) {
          return arr
            .filter((i) => i && typeof i === "object")
            .slice(0, 4)
            .map((i) => ({
              text: String(i.text || i.name || i.item || "").slice(0, 15) || "추천 짐",
              icon: String(i.icon || i.emoji || "✨"),
            }));
        }
      } catch {
        // ignore
      }
    }
  }
  return [];
}

export async function POST(req: NextRequest) {
  let quotaCheck;
  try {
    quotaCheck = await verifyAndCheckAiQuota(req);
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        { error: "오늘 무료 AI 사용 횟수를 다 사용했어요. 이용권을 등록하시면 무제한으로 이용할 수 있어요!" },
        { status: 429 }
      );
    }
  } catch (err) {
    if (err instanceof AiAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[팩인백] AI 날씨 추천 인증 검증 예외:", err);
    return NextResponse.json({ error: "인증 검증 중 오류가 발생했어요" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }

  const bagNameRaw = (body as { bagName?: unknown })?.bagName;
  const weatherTextRaw = (body as { weatherText?: unknown })?.weatherText;
  const tempMinRaw = (body as { tempMin?: unknown })?.tempMin;
  const tempMaxRaw = (body as { tempMax?: unknown })?.tempMax;

  const bagName = typeof bagNameRaw === "string" ? bagNameRaw.trim().slice(0, 60) : "";
  const weatherText = typeof weatherTextRaw === "string" ? weatherTextRaw.trim() : "맑음";
  const tempMin = typeof tempMinRaw === "number" ? tempMinRaw : 15;
  const tempMax = typeof tempMaxRaw === "number" ? tempMaxRaw : 25;

  if (!bagName) {
    return NextResponse.json({ error: "가방 이름을 입력해주세요" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Gemini API 키가 설정되지 않았어요" }, { status: 500 });
  }

  const systemPrompt = `당신은 짐싸기 전문 컨설턴트 AI입니다.
사용자의 가방 이름과 실시간 날씨 정보를 분석하여 해당 여행/활동에 특화된 유용한 짐 항목 4개와 이모지를 생성하세요.

[규칙]
1. 가방 이름 속 장소와 여행 목적, 실시간 날씨를 종합 파악하세요.
2. 국내 장소/일상이면 여권, 비자, 환전, 돼지코 같은 해외 전용 물품을 제안하지 마세요.
3. 응답은 반드시 아래 JSON 객체 형식으로만 답하세요:

{
  "items": [
    { "text": "짐 이름 (10자 이내)", "icon": "이모지 1개" },
    { "text": "짐 이름 (10자 이내)", "icon": "이모지 1개" },
    { "text": "짐 이름 (10자 이내)", "icon": "이모지 1개" },
    { "text": "짐 이름 (10자 이내)", "icon": "이모지 1개" }
  ]
}`;

  const userContent = `가방 이름: ${bagName}\n실시간 날씨: ${weatherText} (최저 ${tempMin}°C ~ 최고 ${tempMax}°C)`;

  const MAX_RETRIES = 2;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  let geminiRes: Response | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userContent }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );

      if (res.ok) {
        geminiRes = res;
        break;
      }
    } catch (err) {
      console.warn(`[팩인백] Gemini API 시도 ${attempt + 1} 실패:`, err);
    }
    if (attempt < MAX_RETRIES) {
      await sleep(500);
    }
  }

  let finalItems: { text: string; icon: string }[] = [];

  if (geminiRes && geminiRes.ok) {
    try {
      const data = await geminiRes.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      finalItems = extractJsonItems(rawText);
    } catch (err) {
      console.error("[팩인백] Gemini 응답 파싱 예외:", err);
    }
  }

  if (finalItems.length === 0) {
    finalItems = [
      { text: `${bagName} 짐`, icon: "🧳" },
      { text: "여행 준비물", icon: "📌" },
      { text: "날씨 대비 용품", icon: "🌤️" },
      { text: "여비 물품", icon: "✨" },
    ];
  }

  if (!quotaCheck.unlimited) {
    await consumeAiQuota(quotaCheck.uid);
  }

  return NextResponse.json({ items: finalItems });
}
