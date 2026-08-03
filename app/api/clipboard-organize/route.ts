import { NextRequest, NextResponse } from "next/server";
import { verifyAndCheckAiQuota, consumeAiQuota, AiAuthError } from "@/lib/aiQuotaServer";

// "AI 클립보드" 기능 - 클립보드에서 읽어온(또는 직접 붙여넣은) 텍스트를 분석해서, 지금 열려있는
// 가방에 아직 없는 항목만 골라 새로 추가할 팩/짐 목록을 만들어준다. organize-bag(기존 항목 재배치)과
// 달리 이건 "새 내용을 어디에 보탤지" 결정하는 기능이라 import-note와 더 비슷한 파싱을 쓰되,
// 결과에서 이미 있는 항목은 서버가 결정적으로(AI 판단에 맡기지 않고) 제외한다.
// 이 라우트는 서버(Vercel)에서만 실행돼요. API 키가 클라이언트로 절대 노출되지 않아요.
export const runtime = "nodejs";

const MAX_INPUT_LENGTH = 6000;
const MAX_PACKS = 8;
const MAX_ITEMS_PER_PACK = 60;
const MAX_EXISTING_ITEMS_IN_PROMPT = 200; // 프롬프트 길이 방어용 - 이미 있는 항목 힌트는 이 개수까지만 보여준다

const SYSTEM_PROMPT = `당신은 여행/외출 준비물 메모를 분석해서 정리해주는 도우미입니다.
사용자가 클립보드에서 복사해온 텍스트를 보내드립니다. 이 텍스트에서 준비물 항목만 뽑아서 아래
JSON 형식으로만 응답하세요. 그 외의 설명, 인사말, 코드블록 기호(\`\`\`)는 절대 포함하지 마세요.

{
  "packs": [
    { "name": "카테고리 이름", "items": [{ "text": "항목1", "checked": false }, { "text": "항목2", "checked": true }] }
  ]
}

규칙:
- 항목들을 의미 있는 카테고리(팩)로 분류하세요. 내용에 맞게 자유롭게 이름을 정하세요.
- 어느 카테고리에도 애매하게 속하는 항목은 "기타" 팩 하나에 모아주세요.
- 항목별로 원본에 이미 체크된(완료된) 표시가 있는지 판단해서 checked에 반영하세요 - 예를 들어 "✓", "✔", "v", "[x]", "☑" 같은 표시나 취소선(strikethrough)이 그어진 항목은 checked:true, 빈 체크박스("☐", "[ ]", "□")나 표시가 전혀 없는 항목은 checked:false로 하세요.
- 목록 기호(-, *, •, 숫자, 체크박스 등)와 체크 표시 자체는 text에서 반드시 제거하고 순수 항목 텍스트만 남기세요(checked 여부는 위 규칙대로 별도 필드에 담으세요).
- 같은 의미의 중복 항목은 하나로 합치세요.
- 팩은 최대 ${MAX_PACKS}개까지만 만드세요.
- 아래에 "이미 이 가방에 있는 항목" 목록이 주어지면, 그 항목과 완전히 같은 의미의 항목은
  결과에 포함하지 마세요(다만 최종 중복 제거는 서버가 한 번 더 정확하게 처리하니, 애매하면
  포함해도 됩니다 - 완전히 확실한 것만 걸러주세요).
- 준비물 목록이 아니라 전혀 관련 없는 내용이라면 packs를 빈 배열로 응답하세요.`;

interface ParsedItem {
  text: string;
  checked: boolean;
}

interface ParsedPack {
  name: string;
  items: ParsedItem[];
}

function sanitizeResult(raw: unknown): { packs: ParsedPack[] } {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const packsRaw = Array.isArray(obj.packs) ? obj.packs : [];
  const packs: ParsedPack[] = packsRaw
    .filter((p): p is { name: unknown; items: unknown } => !!p && typeof p === "object")
    .map((p) => {
      const name =
        typeof (p as { name?: unknown }).name === "string"
          ? (p as { name: string }).name.trim().slice(0, 20)
          : "";
      const itemsRaw = Array.isArray((p as { items?: unknown }).items)
        ? ((p as { items: unknown[] }).items as unknown[])
        : [];
      // 각 항목은 단순 문자열이거나(구버전 호환, checked:false 취급) {text, checked} 객체일 수 있다.
      const items: ParsedItem[] = itemsRaw
        .map((rawItem): ParsedItem | null => {
          if (typeof rawItem === "string") {
            const text = rawItem.trim().slice(0, 60);
            return text ? { text, checked: false } : null;
          }
          if (rawItem && typeof rawItem === "object") {
            const textRaw = (rawItem as { text?: unknown }).text;
            const text = typeof textRaw === "string" ? textRaw.trim().slice(0, 60) : "";
            if (!text) return null;
            return { text, checked: !!(rawItem as { checked?: unknown }).checked };
          }
          return null;
        })
        .filter((i): i is ParsedItem => i !== null)
        .slice(0, MAX_ITEMS_PER_PACK);
      return { name: name || "기타", items };
    })
    .filter((p) => p.items.length > 0)
    .slice(0, MAX_PACKS);
  return { packs };
}

// 띄어쓰기 차이/대소문자 차이만으로 다른 항목처럼 보이는 걸 막기 위한 정규화 -
// 모든 공백을 제거하고 소문자로 바꿔서 비교한다("우산" === "우 산" === "우산 ").
function normalizeForDedupe(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

// 이미 있는 항목(existingItems)과 정확히(정규화 후) 일치하는 새 항목은 제외하고,
// 새로 파싱된 결과 안에서의 중복도 함께 제거한다. AI 판단에 맡기지 않고 서버가
// 결정적으로 걸러내는 최종 안전장치.
function dedupeAgainstExisting(
  packs: ParsedPack[],
  existingItems: string[]
): { packs: ParsedPack[]; skippedDuplicateCount: number } {
  const existingSet = new Set(existingItems.map(normalizeForDedupe));
  const seenInResult = new Set<string>();
  let skippedDuplicateCount = 0;

  const result: ParsedPack[] = packs
    .map((p) => {
      const items = p.items.filter((item) => {
        const key = normalizeForDedupe(item.text);
        if (!key) return false;
        if (existingSet.has(key) || seenInResult.has(key)) {
          skippedDuplicateCount += 1;
          return false;
        }
        seenInResult.add(key);
        return true;
      });
      return { ...p, items };
    })
    .filter((p) => p.items.length > 0);

  return { packs: result, skippedDuplicateCount };
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
  // organize-bag과 동일하게 프리미엄 전용 기능 - quota.unlimited가 아니면(무료 회원) 막는다.
  if (!quota.unlimited) {
    return NextResponse.json(
      {
        error: "AI 클립보드는 프리미엄 전용 기능이에요. 설정 > 이용권 코드에서 코드를 입력하면 바로 쓸 수 있어요",
        premiumRequired: true,
      },
      { status: 403 }
    );
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
  const existingItemsRaw = (body as { existingItems?: unknown })?.existingItems;

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "붙여넣은 내용이 비어있어요" }, { status: 400 });
  }

  const existingItems = Array.isArray(existingItemsRaw)
    ? existingItemsRaw.filter((i): i is string => typeof i === "string")
    : [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[팩인백] GEMINI_API_KEY가 설정되어 있지 않아요");
    return NextResponse.json(
      { error: "AI 분석 기능이 아직 설정되지 않았어요" },
      { status: 500 }
    );
  }

  const existingHint =
    existingItems.length > 0
      ? `\n\n이미 이 가방에 있는 항목:\n${existingItems.slice(0, MAX_EXISTING_ITEMS_IN_PROMPT).join(", ")}`
      : "";
  const userText = text.trim().slice(0, MAX_INPUT_LENGTH) + existingHint;

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
        `[팩인백] Gemini API 오류 (AI 클립보드, 시도 ${attempt + 1}/${MAX_RETRIES + 1}):`,
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
      console.error("[팩인백] JSON 파싱 실패 (AI 클립보드), 원문:", raw);
      return NextResponse.json(
        { error: "AI 응답을 해석하지 못했어요. 다시 시도해주세요" },
        { status: 502 }
      );
    }

    if (!quota.unlimited) {
      await consumeAiQuota(quota.uid);
      quota.usedCount += 1;
    }

    const sanitized = sanitizeResult(parsed);
    const { packs, skippedDuplicateCount } = dedupeAgainstExisting(sanitized.packs, existingItems);

    return NextResponse.json({
      packs,
      skippedDuplicateCount,
      quota: { unlimited: quota.unlimited, usedCount: quota.usedCount, limit: quota.limit },
    });
  } catch (err) {
    console.error("[팩인백] AI 클립보드 분석 실패:", err);
    return NextResponse.json({ error: "서버 오류가 발생했어요" }, { status: 500 });
  }
}
