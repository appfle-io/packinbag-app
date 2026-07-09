import { NextRequest, NextResponse } from "next/server";
import { verifyAndCheckAiQuota, consumeAiQuota, AiAuthError } from "@/lib/aiQuotaServer";

// 이 라우트는 서버(Vercel)에서만 실행돼요. API 키가 클라이언트로 절대 노출되지 않아요.
export const runtime = "nodejs";

const MAX_TAGS = 3;
const MAX_TAG_LENGTH = 20;
const MAX_PACKS = 8;
const MAX_ITEMS_PER_PACK = 60;

const SYSTEM_PROMPT = `당신은 사용자가 준 해시태그(키워드)를 보고 어울리는 체크리스트를 만들어주는 도우미입니다.
사용자가 최대 3개의 해시태그를 줄 것입니다. 이 키워드에서 짐작할 수 있는 상황(여행, 장보기, 이사,
결혼준비, 팀 할일, 파티, 육아, 캠핑 등 무엇이든)에 맞는 준비물/할일 체크리스트를 만들어주세요.

아래 JSON 형식으로만 응답하세요. 그 외의 설명, 인사말, 코드블록 기호(\`\`\`)는 절대 포함하지 마세요.

{
  "bagName": "짧은 가방 이름",
  "packs": [
    { "name": "카테고리 이름", "items": ["항목1", "항목2"] }
  ]
}

규칙:
- 해시태그의 의미를 조합해서 실제로 쓸모 있는 이름과 항목을 만들어주세요 (예: #결혼준비 #예산 #셀프 ->
  "셀프 결혼준비(예산형)" 같은 이름과 그에 맞는 실속형 항목).
- 항목들을 의미 있는 카테고리(팩)로 분류하세요.
- 팩은 최대 ${MAX_PACKS}개, 팩당 항목은 최대 ${MAX_ITEMS_PER_PACK}개까지만 만드세요.
- 해시태그가 너무 추상적이거나 준비물/할일과 전혀 관련 없으면(예: 감정 표현, 욕설 등)
  packs를 빈 배열로 응답하세요.`;

interface ParsedPack {
  name: string;
  items: string[];
}

function sanitizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .map((t) => t.trim().replace(/^#/, "").slice(0, MAX_TAG_LENGTH))
    .slice(0, MAX_TAGS);
}

function sanitizeResult(raw: unknown): { bagName: string; packs: ParsedPack[] } {
  const obj = (raw ?? {}) as Record<string, unknown>;

  const bagNameRaw = typeof obj.bagName === "string" ? obj.bagName.trim() : "";
  const bagName = bagNameRaw.slice(0, 30) || "새 가방";

  const packsRaw = Array.isArray(obj.packs) ? obj.packs : [];
  const packs: ParsedPack[] = packsRaw
    .filter(
      (p): p is { name: unknown; items: unknown } => !!p && typeof p === "object"
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

  const tags = sanitizeTags((body as { tags?: unknown })?.tags);
  if (tags.length === 0) {
    return NextResponse.json({ error: "해시태그를 1개 이상 입력해주세요" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[팩인백] GEMINI_API_KEY가 설정되어 있지 않아요");
    return NextResponse.json(
      { error: "AI 분석 기능이 아직 설정되지 않았어요" },
      { status: 500 }
    );
  }

  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 900;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  let geminiRes: Response | null = null;
  let lastStatus = 0;
  let lastErrText = "";

  const userText = tags.map((t) => `#${t}`).join(" ");

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
            contents: [{ role: "user", parts: [{ text: userText }] }],
            generationConfig: { responseMimeType: "application/json" },
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
        `[팩인백] Gemini API 오류 (샘플 생성, 시도 ${attempt + 1}/${MAX_RETRIES + 1}):`,
        lastStatus,
        lastErrText
      );

      const isRetryable = lastStatus === 503 || lastStatus === 429;
      if (isRetryable && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
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
            : "AI 생성 중 문제가 발생했어요";
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
      console.error("[팩인백] JSON 파싱 실패 (샘플 생성), 원문:", raw);
      return NextResponse.json(
        { error: "AI 응답을 해석하지 못했어요. 다시 시도해주세요" },
        { status: 502 }
      );
    }

    // Gemini가 성공적으로 응답했고(retry 루프를 통과) JSON으로 파싱까지 됐을 때만
    // 무료 사용자의 오늘 사용 횟수를 실제로 차감한다. 503/429로 끝내 실패했거나
    // 파싱이 안 된 경우는 위에서 이미 return 되어 여기 도달하지 않는다.
    if (!quota.unlimited) {
      const consumed = await consumeAiQuota(quota.uid);
      quota.usedCount = consumed.usedCount;
    }

    const result = sanitizeResult(parsed);
    if (result.packs.length === 0) {
      return NextResponse.json(
        { error: "해시태그로 준비물 목록을 만들지 못했어요. 다른 키워드로 시도해주세요" },
        { status: 422 }
      );
    }
    return NextResponse.json({
      ...result,
      quota: { unlimited: quota.unlimited, usedCount: quota.usedCount, limit: quota.limit },
    });
  } catch (err) {
    console.error("[팩인백] 샘플 생성 실패:", err);
    return NextResponse.json({ error: "서버 오류가 발생했어요" }, { status: 500 });
  }
}
