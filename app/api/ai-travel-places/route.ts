import { NextRequest, NextResponse } from "next/server";
import { verifyAndCheckAiQuota, consumeAiQuota, AiAuthError } from "@/lib/aiQuotaServer";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

// 같은 도시는 이 시간 동안 캐시를 재사용한다(전체 유저 공유 캐시) - 가방 제목을
// 아무리 자주 고쳐도(도시가 그대로면) Gemini를 다시 부르지 않기 위함.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12시간

type Category = "attraction" | "food" | "specialty";
interface TravelRecommendation {
  category: Category;
  text: string;
  desc: string;
  icon: string;
}

const VALID_CATEGORIES: Category[] = ["attraction", "food", "specialty"];

// 도시명 표기가 조금 달라도(띄어쓰기/대소문자) 같은 캐시를 타도록 정규화한다.
function normalizeCityKey(cityName: string): string {
  return cityName.trim().toLowerCase().replace(/\s+/g, "");
}

function parseRecommendations(text: string): TravelRecommendation[] {
  if (!text) return [];
  try {
    const cleaned = text.replace(/```json|```/gi, "").trim();
    const parsed = JSON.parse(cleaned);
    let list: any[] = [];
    if (Array.isArray(parsed)) list = parsed;
    else if (Array.isArray(parsed.items)) list = parsed.items;
    else if (typeof parsed === "object") {
      const k = Object.keys(parsed).find((key) => Array.isArray(parsed[key]));
      if (k) list = parsed[k];
    }
    const items = list
      .filter((item) => item && typeof item === "object")
      .slice(0, 6)
      .map((item) => ({
        category: (VALID_CATEGORIES.includes(item.category) ? item.category : "attraction") as Category,
        text: String(item.text || item.name || "").slice(0, 15),
        desc: String(item.desc || item.description || "").slice(0, 40),
        icon: String(item.icon || item.emoji || "📍"),
      }))
      .filter((item) => item.text.trim().length > 0);
    if (items.length > 0) return items;
  } catch {
    // ignore
  }
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

    const cityNameRaw = (body as { cityName?: unknown })?.cityName;
    const cityName = typeof cityNameRaw === "string" ? cityNameRaw.trim().slice(0, 30) : "";

    if (!cityName) {
      return NextResponse.json({ places: [] });
    }

    const cityKey = normalizeCityKey(cityName);
    const db = adminDb();

    // 1. 캐시 확인 - 같은 도시면 Gemini 호출 없이 바로 반환 (비용 절감 + 응답 속도 개선)
    if (db) {
      try {
        const cacheSnap = await db.collection("aiPlacesCache").doc(cityKey).get();
        if (cacheSnap.exists) {
          const data = cacheSnap.data();
          const cachedAtMs = data?.cachedAt?.toMillis?.() ?? 0;
          if (
            Date.now() - cachedAtMs < CACHE_TTL_MS &&
            Array.isArray(data?.places) &&
            data.places.length > 0
          ) {
            return NextResponse.json({ places: data.places });
          }
        }
      } catch (err) {
        console.warn("[팩인백] AI 추천 캐시 조회 예외:", err);
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[팩인백] GEMINI_API_KEY 환경변수가 설정되지 않았습니다!");
      return NextResponse.json({ places: [] });
    }

    const promptText = `당신은 전 세계 여행 전문 가이드 AI입니다.
입력된 지역/도시 "${cityName}"에 대해 아래 3개 카테고리로 실제 존재하는 구체적인 추천을 정확히 6개(카테고리별 2개씩) 제안하세요.

- attraction: 대표 관광지/명소
- food: 꼭 가봐야 할 맛집(또는 유명한 맛집 거리/음식 종류)
- specialty: 꼭 먹어봐야 할 특산물/명물 먹거리

각 항목은 다음을 포함하세요:
- text: 이름 (10자 이내)
- desc: 왜 추천하는지 구체적인 한 줄 설명 (20자 이내)
- icon: 어울리는 이모지 1개

[응답 형식 예시]
{
  "items": [
    { "category": "attraction", "text": "다이아몬드 헤드", "desc": "정상에서 보는 와이키키 전망이 일품", "icon": "🌋" },
    { "category": "attraction", "text": "와이키키 해변", "desc": "하와이를 대표하는 해변 산책로", "icon": "🏖️" },
    { "category": "food", "text": "로컬 새우트럭", "desc": "현지인도 줄서는 갈릭 새우 맛집", "icon": "🦐" },
    { "category": "food", "text": "차이나타운 딤섬", "desc": "아침 일찍부터 붐비는 딤섬 골목", "icon": "🥟" },
    { "category": "specialty", "text": "스팸무스비", "desc": "하와이 대표 간편식, 편의점에도 있음", "icon": "🍙" },
    { "category": "specialty", "text": "코나 커피", "desc": "빅아일랜드산 원두, 기념품으로도 인기", "icon": "☕" }
  ]
}

부연설명 없이 위 형식의 순수 JSON만 응답하세요.`;

    const MAX_RETRIES = 2;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    let finalPlaces: TravelRecommendation[] = [];

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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
              contents: [{ role: "user", parts: [{ text: promptText }] }],
              generationConfig: { responseMimeType: "application/json" },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          finalPlaces = parseRecommendations(rawText);
          if (finalPlaces.length > 0) {
            console.log(`[팩인백] Gemini API 호출 성공! 도시: ${cityName}, 추천 개수: ${finalPlaces.length}`);
            break;
          }
        } else {
          const errBody = await res.text();
          console.error(`[팩인백] Gemini API 호출 실패 (${res.status}):`, errBody);
        }
      } catch (err) {
        console.warn(`[팩인백] Gemini 추천 시도 ${attempt + 1} 예외:`, err);
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

    // 2. 캐시 저장 - 다음 요청부터는(같은 도시, TTL 이내) Gemini 호출 없이 바로 반환된다.
    if (db && finalPlaces.length > 0) {
      try {
        await db.collection("aiPlacesCache").doc(cityKey).set({
          cityName,
          places: finalPlaces,
          cachedAt: new Date(),
        });
      } catch (err) {
        console.warn("[팩인백] AI 추천 캐시 저장 예외:", err);
      }
    }

    return NextResponse.json({ places: finalPlaces });
  } catch (globalErr) {
    console.error("[팩인백] AI 여행지 추천 글로벌 예외:", globalErr);
    return NextResponse.json({ places: [] });
  }
}
