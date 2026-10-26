import { NextRequest, NextResponse } from "next/server";
import { verifyAndCheckAiQuota, consumeAiQuota, AiAuthError, withAiQuotaSettlement, AI_PREMIUM_CAP_MESSAGE, aiFreeLimitMessage } from "@/lib/aiQuotaServer";
import { getGeminiEndpoint } from "@/lib/geminiConfig";

export const runtime = "nodejs";

// 가방은 여행 전용이 아니다(어린이집 · 출근 · 운동 · 행사 · 기념일 등, 2026-10-26 사용자) → 목적을 먼저 짐작하고 그 목적에 맞게
const SYSTEM_PROMPT = `당신은 챙길 것 체크리스트를 꼼꼼히 점검해 주는 도우미입니다.
가방은 여행만이 아니라 어린이집 · 등원, 출근, 운동, 캠핑, 병원, 행사, 이사, 업무, 기념일 준비 등 무엇이든 될 수 있어요.
사용자가 작성한 가방 이름, D-Day(날짜), 날씨 정보, 현재 등록된 팩과 아이템 목록을 보고 먼저 이 가방의 목적을 짐작한 뒤, 그 목적에 꼭 필요하거나 매우 유용하지만 **현재 가방에 빠져 있는 핵심 물건(2~6개)**을 찾아 추천해 주세요.

응답은 반드시 아래 JSON 형식으로만 출력하세요. 그 외의 설명이나 코드블록 기호(\`\`\`)는 절대 포함하지 마세요.

{
  "missingItems": [
    {
      "category": "생활/위생",
      "text": "여벌 옷 한 벌",
      "reason": "어린이집에서는 옷이 젖거나 더러워질 때를 대비해 여벌을 맡겨 두는 경우가 많아요.",
      "suggestedPackName": "옷"
    }
  ],
  "tripAdvice": "이름표를 물건마다 붙여 두면 다른 아이 물건과 섞이지 않아요."
}

규칙:
1. 이미 가방에 들어있는 물품과 중복되거나 유사한 물품은 절대 추천하지 마세요.
2. 가방 이름과 아이템으로 목적을 판단하고, 그 목적에서 실제로 놓치기 쉬운 실용적인 물건을 제안하세요. 계절 · 날씨(비, 눈, 폭염)도 고려하세요.
   - 예: 등원(여벌 옷, 이름표, 낮잠 이불), 운동(수건, 물병), 병원(신분증, 진료 기록), 여행(해외면 110V 돼지코 · 여권 사본, 렌터카면 운전면허증), 비 예보(접이식 우산)
   - 여행이 아닌 가방에 여권 · 환전 · 돼지코 같은 여행 물건을 넣지 마세요. 목적을 알 수 없으면 날씨와 일반적인 외출 기준으로만 제안하세요.
3. category는 "전자기기", "서류/결제", "생활/위생", "의류/잡화", "건강/비상약", "유아용품", "목적 특화" 중 적절한 것을 선택하세요.
4. suggestedPackName은 가방에 이미 존재하는 팩 이름 중 가장 어울리는 것을 우선 매칭하고, 없으면 직관적인 새 팩 이름을 지정하세요.
5. missingItems는 최소 2개, 최대 6개로 한정하세요.
6. tripAdvice는 이 가방의 목적에 맞는 짧은 조언 한 문장입니다(여행이 아니면 여행 이야기를 하지 마세요).`;

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

// 하루 횟수는 시작할 때 예약하고, 실패로 끝나면 되돌린다(lib/aiQuotaServer.ts)
export const POST = withAiQuotaSettlement(handlePOST);

async function handlePOST(req: NextRequest) {
  let quota;
  try {
    quota = await verifyAndCheckAiQuota(req);
  } catch (err) {
    if (err instanceof AiAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "AI 사용량 확인에 실패했어요" }, { status: 500 });
  }

  if (quota.capReached) {
    return NextResponse.json({ error: AI_PREMIUM_CAP_MESSAGE }, { status: 429 });
  }
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: aiFreeLimitMessage(quota.limit),
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
    bagName?: unknown;
    travelDate?: unknown;
    weatherSummary?: unknown;
    packs?: unknown;
  };

  // 입력 길이·개수 상한(2026-10-09). 예전에는 제한이 없어 한 번 부르는 데 수 MB 프롬프트를 보낼 수 있었다(AI 비용).
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const packSummary = Array.isArray(packs)
    ? packs
        .slice(0, 30)
        .filter((p): p is { name?: unknown; items?: unknown } => !!p && typeof p === "object")
        .map((p) => {
          const items = Array.isArray(p.items)
            ? p.items.filter((i): i is string => typeof i === "string").slice(0, 100).map((i) => i.slice(0, 60))
            : [];
          return `[${str(p.name, 30)}]: ${items.join(", ")}`;
        })
        .join("\n")
    : "";

  const userPrompt = `[가방 정보]
- 가방 이름: ${str(bagName, 60) || "이름 없는 가방"}
- D-Day(날짜): ${str(travelDate, 40) || "없음"}
- 날씨/장소 정보: ${str(weatherSummary, 300) || "정보 없음"}

[현재 등록된 팩 및 아이템 목록]
${packSummary || "(등록된 아이템 없음)"}

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
      console.error("[팩인백] AI 아이템 검수 API 호출 실패:", res.status, await res.text());
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

    await consumeAiQuota(quota.uid);
    if (!quota.unlimited) {
      quota.usedCount += 1;
    }

    const result = sanitizeResult(parsed);
    return NextResponse.json({
      ...result,
      quota: { unlimited: quota.unlimited, usedCount: quota.usedCount, limit: quota.limit },
    });
  } catch (err) {
    console.error("[팩인백] AI 아이템 검수 처리 예외:", err);
    return NextResponse.json({ error: "서버 처리 중 오류가 발생했어요" }, { status: 500 });
  }
}
