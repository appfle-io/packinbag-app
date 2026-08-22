import { NextRequest, NextResponse } from "next/server";
import { verifyAndCheckAiQuota, consumeAiQuota, AiAuthError } from "@/lib/aiQuotaServer";
import { getGeminiEndpoint } from "@/lib/geminiConfig";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `당신은 스마트 여행 및 짐 챙기기 전문 컨설턴트 AI입니다.
사용자가 작성한 가방 이름, 여행일자, 날씨 정보, 현재 등록된 팩과 짐 목록을 분석하여, 해당 여행에 매우 유용하거나 꼭 필요하지만 **현재 가방에 빠져있는 핵심 필수품(3~6개)**을 찾아내어 추천해주세요.

응답은 반드시 아래 JSON 형식으로만 출력하세요. 그 외의 설명이나 코드블록 기호(\`\`\`)는 절대 포함하지 마세요.

{
  "missingItems": [
    {
      "category": "전자기기",
      "text": "110V 돼지코 어댑터",
      "reason": "일본은 110V 규격을 사용하므로 충전기 연결을 위해 변환 플러그가 필수예요.",
      "suggestedPackName": "전자기기"
    }
  ],
  "tripAdvice": "현지 대중교통 이용 시 동전 결제가 많으니 작은 동전지갑을 챙기시면 편리해요."
}

규칙:
1. 이미 가방에 들어있는 물품과 중복되거나 유사한 물품은 절대 추천하지 마세요.
2. 여행지(국내/해외 도시), 계절(여름 물놀이, 겨울 방한), 날씨(비, 눈, 폭염), 교통(비행기, 렌터카) 특성을 고려해 실제 여행자가 놓치기 쉬운 실용적인 품목을 제안하세요.
   - 예: 해외(110V 돼지코, 유심 핀, 여권 사본), 물놀이(방수팩, 여벌 지퍼백), 렌터카(운전면허증), 비 예보(접이식 우산)
3. category는 "전자기기", "서류/결제", "위생/세면", "의류/잡화", "비상약", "여행지 특화" 중 적절한 것을 선택하세요.
4. suggestedPackName은 가방에 이미 존재하는 팩 이름 중 가장 어울리는 것을 우선 매칭하고, 없으면 직관적인 새 팩 이름을 지정하세요.
5. missingItems는 최소 2개, 최대 6개로 한정하세요.`;

interface MissingItem {
  category: string;
  text: string;
  reason: string;
  suggestedPackName: string;
}

function sanitizeResult(raw: unknown): { missingItems: MissingItem[]; tripAdvice?: string } {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const itemsRaw = Array.isArray(obj.missingItems) ? obj.missingItems : [];
  const tripAdviceRaw = typeof obj.tripAdvice === "string" ? obj.tripAdvice.trim().slice(0, 150) : undefined;

  const missingItems: MissingItem[] = itemsRaw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      category: typeof item.category === "string" ? item.category.trim().slice(0, 20) : "기타",
      text: typeof item.text === "string" ? item.text.trim().slice(0, 40) : "",
      reason: typeof item.reason === "string" ? item.reason.trim().slice(0, 150) : "",
      suggestedPackName: typeof item.suggestedPackName === "string" ? item.suggestedPackName.trim().slice(0, 20) : "필수품",
    }))
    .filter((item) => item.text.length > 0)
    .slice(0, 6);

  return { missingItems, tripAdvice: tripAdviceRaw };
}

export async function POST(req: NextRequest) {
  let quota;
  try {
    quota = await verifyAndCheckAiQuota(req);
  } catch (err) {
    if (err instanceof AiAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "AI 사용량 확인에 실패했어요" }, { status: 500 });
  }

  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `오늘 무료 AI 사용 한도(${quota.limit}회)를 다 썼어요. 내일 다시 시도하거나, 이용권 코드를 등록하면 무제한으로 쓸 수 있어요`,
        limitReached: true,
        usedCount: quota.usedCount,
        limit: quota.limit,
      },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }

  const { bagName, travelDate, weatherSummary, packs } = (body ?? {}) as {
    bagName?: string;
    travelDate?: string;
    weatherSummary?: string;
    packs?: Array<{ name: string; items: string[] }>;
  };

  const packSummary = Array.isArray(packs)
    ? packs
        .map((p) => `[${p.name}]: ${(p.items || []).join(", ")}`)
        .join("\n")
    : "";

  const userPrompt = `[가방 정보]
- 가방 이름: ${bagName || "여행 가방"}
- 여행일정: ${travelDate || "미정"}
- 날씨/현지 정보: ${weatherSummary || "정보 없음"}

[현재 등록된 팩 및 짐 목록]
${packSummary || "(등록된 짐 없음)"}

위 가방을 분석하여 놓치기 쉬운 필수품과 조언을 JSON으로 응답해주세요.`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI 분석 기능이 아직 설정되지 않았어요" }, { status: 500 });
  }

  try {
    const res = await fetch(getGeminiEndpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (!res.ok) {
      console.error("[팩인백] AI 짐 검수 API 호출 실패:", res.status, await res.text());
      return NextResponse.json({ error: "AI 분석에 실패했어요. 잠시 후 다시 시도해주세요" }, { status: 502 });
    }

    const data = await res.json();
    const raw: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("") ?? "";

    const cleaned = raw.replace(/```json|```/g, "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "AI 응답을 해석하지 못했어요" }, { status: 502 });
    }

    if (!quota.unlimited) {
      await consumeAiQuota(quota.uid);
      quota.usedCount += 1;
    }

    const result = sanitizeResult(parsed);
    return NextResponse.json({
      ...result,
      quota: { unlimited: quota.unlimited, usedCount: quota.usedCount, limit: quota.limit },
    });
  } catch (err) {
    console.error("[팩인백] AI 짐 검수 처리 예외:", err);
    return NextResponse.json({ error: "서버 처리 중 오류가 발생했어요" }, { status: 500 });
  }
}
