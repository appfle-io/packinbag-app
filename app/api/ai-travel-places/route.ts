import { NextRequest, NextResponse } from "next/server";
import { verifyAndCheckAiQuota, consumeAiQuota, AiAuthError } from "@/lib/aiQuotaServer";

export const runtime = "nodejs";

function parsePlacesFromAi(text: string): { text: string; icon: string }[] {
  if (!text) return [];
  try {
    const cleaned = text.replace(/```json|```/gi, "").trim();
    const parsed = JSON.parse(cleaned);
    let list: any[] = [];
    if (Array.isArray(parsed)) list = parsed;
    else if (Array.isArray(parsed.places)) list = parsed.places;
    else if (Array.isArray(parsed.items)) list = parsed.items;
    else if (typeof parsed === "object") {
      const k = Object.keys(parsed).find((key) => Array.isArray(parsed[key]));
      if (k) list = parsed[k];
    }
    const items = list
      .filter((item) => item && typeof item === "object")
      .slice(0, 4)
      .map((item) => ({
        text: String(item.text || item.name || item.place || "").slice(0, 15),
        icon: String(item.icon || item.emoji || "📍"),
      }))
      .filter((item) => item.text.trim().length > 0);
    if (items.length > 0) return items;
  } catch {}

  try {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const extracted: { text: string; icon: string }[] = [];
    for (const line of lines) {
      const cleanLine = line.replace(/^[0-9+*-.\s]+/, "").trim();
      if (!cleanLine) continue;
      const emojiMatch = cleanLine.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u);
      const icon = emojiMatch ? emojiMatch[0] : "📍";
      const name = cleanLine.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/g, "").trim().slice(0, 15);
      if (name && name.length >= 2) {
        extracted.push({ text: name, icon });
      }
    }
    if (extracted.length > 0) return extracted.slice(0, 4);
  } catch {}

  return [];
}

export async function POST(req: NextRequest) {
  try {
    let quotaCheck;
    try {
      quotaCheck = await verifyAndCheckAiQuota(req);
      if (quotaCheck && !quotaCheck.allowed) {
        return NextResponse.json(
          { error: "오늘 무료 AI 사용 횟수를 다 사용했어요. 이용권을 등록하시면 무제한으로 이용할 수 있어요!" },
          { status: 429 }
        );
      }
    } catch (err) {
      if (err instanceof AiAuthError) {
        return NextResponse.json({ places: [] });
      }
      console.warn("[팩인백] AI 추천 여행지 인증 예외:", err);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "요청 형식이 올바르지 않아요" }, { status: 400 });
    }

    const bagNameRaw = (body as { bagName?: unknown })?.bagName;
    const cityNameRaw = (body as { cityName?: unknown })?.cityName;

    const bagName = typeof bagNameRaw === "string" ? bagNameRaw.trim().slice(0, 60) : "";
    const cityName = typeof cityNameRaw === "string" ? cityNameRaw.trim().slice(0, 30) : bagName;

    if (!bagName) {
      return NextResponse.json({ places: [] });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[팩인백] GEMINI_API_KEY 환경변수가 설정되지 않았습니다!");
      return NextResponse.json({ places: [] });
    }

    const promptText = `당신은 전 세계 인기 여행지 및 핫플레이스 가이드 AI입니다.
입력된 지역/도시 이름("${cityName}" 또는 "${bagName}")에서 가장 대표적이고 인기가 높으며 실제 존재하는 추천 여행지/핫플/명소 4개와 이모지를 제안하세요.

[응답 형식 예시]
[
  { "text": "와이키키 해변", "icon": "🏖️" },
  { "text": "다이아몬드 헤드", "icon": "🌋" }
]

부연설명 없이 순수 JSON 배열만 응답하세요.`;

    const MAX_RETRIES = 2;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    let finalPlaces: { text: string; icon: string }[] = [];

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
              contents: [{ role: "user", parts: [{ text: promptText }] }],
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          finalPlaces = parsePlacesFromAi(rawText);
          if (finalPlaces.length > 0) {
            console.log(`[팩인백] Gemini API 호출 성공! 도시: ${cityName}, 명소 개수: ${finalPlaces.length}`);
            break;
          }
        } else {
          const errBody = await res.text();
          console.error(`[팩인백] Gemini API 호출 실패 (${res.status}):`, errBody);
        }
      } catch (err) {
        console.warn(`[팩인백] Gemini 명소 시도 ${attempt + 1} 예외:`, err);
      }
      if (attempt < MAX_RETRIES) {
        await sleep(400);
      }
    }

    if (quotaCheck && !quotaCheck.unlimited && finalPlaces.length > 0) {
      try {
        await consumeAiQuota(quotaCheck.uid);
      } catch (err) {
        console.warn("[팩인백] AI Quota 소비 예외:", err);
      }
    }

    return NextResponse.json({ places: finalPlaces });
  } catch (globalErr) {
    console.error("[팩인백] AI 여행지 추천 글로벌 예외:", globalErr);
    return NextResponse.json({ places: [] });
  }
}
