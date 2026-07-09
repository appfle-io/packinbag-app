import { NextRequest, NextResponse } from "next/server";
import { verifyAndCheckAiQuota, consumeAiQuota, AiAuthError } from "@/lib/aiQuotaServer";

// 이 라우트는 서버(Vercel)에서만 실행돼요. API 키가 클라이언트로 절대 노출되지 않아요.
export const runtime = "nodejs";

const MAX_INPUT_LENGTH = 6000; // 과도하게 긴 메모로 비용이 튀는 것을 방지
const MAX_PACKS = 8;
const MAX_ITEMS_PER_PACK = 60;

const SYSTEM_PROMPT = `당신은 여행/외출 준비물 메모를 분석해서 정리해주는 도우미입니다.
사용자가 아이폰 메모 앱에서 복사해온 텍스트를 아래 JSON 형식으로만 응답하세요. 그 외의 설명, 인사말, 코드블록 기호(\`\`\`)는 절대 포함하지 마세요.

{
  "bagName": "짧은 가방 이름",
  "packs": [
    { "name": "카테고리 이름", "items": ["항목1", "항목2"] }
  ]
}

규칙:
- 메모의 첫 줄이 제목처럼 보이면(짧고, 목록 기호나 체크박스로 시작하지 않으면) 그 첫 줄을 다듬어서 bagName으로 쓰세요. 첫 줄도 그냥 준비물 항목이거나 메모에 제목이 없으면, 전체 내용에 어울리는 이름을 새로 지어주세요 (예: "제주도 여행 준비물").
- 항목들을 의미 있는 카테고리(팩)로 분류하세요. 예: 의류, 세면도구, 전자기기, 서류/카드, 약/건강, 유아용품, 기타 등 - 메모 내용에 맞게 자유롭게 이름을 정하세요.
- 어느 카테고리에도 애매하게 속하는 항목은 "기타" 팩 하나에 모아주세요.
- 목록 기호(-, *, •, 숫자, 체크박스 등)와 이미 표시된 체크 표시는 제거하고 항목 텍스트만 남기세요.
- 같은 의미의 중복 항목은 하나로 합치세요.
- 팩은 최대 ${MAX_PACKS}개까지만 만드세요.
- 준비물 목록이 아니라 전혀 관련 없는 메모라면 packs를 빈 배열로 응답하세요.`;

interface ParsedPack {
  name: string;
  items: string[];
}

function sanitizeResult(raw: unknown): { bagName: string; packs: ParsedPack[] } {
  const obj = (raw ?? {}) as Record<string, unknown>;

  const bagNameRaw = typeof obj.bagName === "string" ? obj.bagName.trim() : "";
  const bagName = bagNameRaw.slice(0, 30) || "새 가방";

  const packsRaw = Array.isArray(obj.packs) ? obj.packs : [];
  const packs: ParsedPack[] = packsRaw
    .filter(
      (p): p is { name: unknown; items: unknown } =>
        !!p && typeof p === "object"
    )
    .map((p) => {
      const name =
        typeof (p as { name?: unknown }).name === "string"
          ? (p as { name: string }).name.trim().slice(0, 20)
          : "";
      const itemsRaw = Array.isArray((p as { items?: unknown }).items)
        ? ((p as { items: unknown[] }).items as unknown[])
        : [];
      const items = itemsRaw
        .filter((i): i is string => typeof i === "string" && i.trim().length > 0)
        .map((i) => i.trim().slice(0, 60))
        .slice(0, MAX_ITEMS_PER_PACK);
      return { name: name || "기타", items };
    })
    .filter((p) => p.items.length > 0)
    .slice(0, MAX_PACKS);

  return { bagName, packs };
}

export async function POST(req: NextRequest) {
  let quota;
  try {
    quota = await verifyAndCheckAiQuota(req);
  } catch (err) {
    if (err instanceof AiAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[팩인백] AI 할당량 확인 실패:", err);
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }

  const text = (body as { text?: unknown })?.text;
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "붙여넣은 내용이 비어있어요" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[팩인백] GEMINI_API_KEY가 설정되어 있지 않아요");
    return NextResponse.json(
      { error: "AI 분석 기능이 아직 설정되지 않았어요" },
      { status: 500 }
    );
  }

  // Gemini가 일시적으로 과부하(503)이거나 순간 요청이 몰려서(429) 거절하는 경우가 있는데,
  // 둘 다 보통 몇 초 안에 풀리는 일시적 문제라 짧은 대기 후 최대 2번까지 자동 재시도한다.
  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 900;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  let geminiRes: Response | null = null;
  let lastStatus = 0;
  let lastErrText = "";

  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [
              {
                role: "user",
                parts: [{ text: text.trim().slice(0, MAX_INPUT_LENGTH) }],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (res.ok) {
        geminiRes = res;
        break;
      }

      lastStatus = res.status;
      lastErrText = await res.text();
      console.error(
        `[팩인백] Gemini API 오류 (시도 ${attempt + 1}/${MAX_RETRIES + 1}):`,
        lastStatus,
        lastErrText
      );

      const isRetryable = lastStatus === 503 || lastStatus === 429;
      if (isRetryable && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1)); // 900ms, 1800ms로 점점 늘려가며 대기
        continue;
      }
      break;
    }

    if (!geminiRes) {
      const message =
        lastStatus === 503
          ? "지금 AI 요청이 많이 몰려서 응답을 못 받았어요. 잠시 후 다시 시도해주세요"
          : lastStatus === 429
            ? "AI 사용량이 순간적으로 몰렸어요. 잠시 후 다시 시도해주세요"
            : "AI 분석 중 문제가 발생했어요";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const data = await geminiRes.json();
    const raw: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("") ?? "";

    const cleaned = raw.replace(/```json|```/g, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[팩인백] JSON 파싱 실패, 원문:", raw);
      return NextResponse.json(
        { error: "AI 응답을 해석하지 못했어요. 다시 시도해주세요" },
        { status: 502 }
      );
    }

    // Gemini가 성공적으로 응답했고 JSON으로 파싱까지 됐을 때만 무료 사용자의
    // 오늘 사용 횟수를 실제로 차감한다.
    if (!quota.unlimited) {
      const consumed = await consumeAiQuota(quota.uid);
      quota.usedCount = consumed.usedCount;
    }

    const result = sanitizeResult(parsed);
    return NextResponse.json({
      ...result,
      quota: { unlimited: quota.unlimited, usedCount: quota.usedCount, limit: quota.limit },
    });
  } catch (err) {
    console.error("[팩인백] 메모 가져오기 실패:", err);
    return NextResponse.json({ error: "서버 오류가 발생했어요" }, { status: 500 });
  }
}
