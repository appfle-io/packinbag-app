import { NextRequest, NextResponse } from "next/server";
import { verifyAndConsumeAiQuota, AiAuthError } from "@/lib/aiQuotaServer";

// 이 라우트는 서버(Vercel)에서만 실행돼요. API 키가 클라이언트로 절대 노출되지 않아요.
export const runtime = "nodejs";

const MAX_ITEMS = 200; // 과도하게 큰 가방으로 비용이 튀는 것을 방지
const MAX_PACKS = 8;

function buildSystemPrompt(existingPackNames: string[]): string {
  const hint =
    existingPackNames.length > 0
      ? `참고용 기존 팩 이름: ${existingPackNames.join(", ")}`
      : "";
  return `당신은 여행/생활/이벤트/업무 준비물이나 할일 체크리스트 항목을 더 깔끔한 카테고리로
재분류해주는 도우미입니다.

아래는 이미 만들어진 체크리스트 안의 개별 항목들입니다. 각 항목에는 고유 번호(index)가 있습니다.
당신의 역할은 각 항목의 문구를 절대 바꾸지 않고, 의미가 비슷한 항목들을 같은 카테고리(팩)로
묶어서 더 깔끔하게 정리하는 것입니다.

다음 형식의 JSON으로만 응답하세요. 그 외의 설명, 인사말, 코드블록 기호(\`\`\`)는 절대 포함하지 마세요.

{
  "packs": [
    { "name": "카테고리 이름", "itemIndices": [0, 3, 7] }
  ]
}

규칙:
- 모든 index는 정확히 한 번씩만 사용되어야 합니다 (빠짐/중복 없이 모든 index를 어딘가에 포함하세요).
- ${hint || "기존 팩 이름이 없으면 내용에 맞게 자유롭게 이름을 정하세요."}
- 기존 팩 이름과 의미가 비슷하면 그 이름을 유지하거나 다듬어서 쓰세요.
- 카테고리(팩)는 최대 ${MAX_PACKS}개까지만 만드세요.
- 애매하게 속하는 항목은 "기타" 팩 하나에 모아주세요.
- 항목 텍스트 자체를 응답에 포함하지 마세요. index 번호만 사용하세요.`;
}

interface ParsedOrganizePack {
  name: string;
  itemIndices: number[];
}

function sanitizeResult(
  raw: unknown,
  validCount: number
): { packs: { name: string; itemIndices: number[] }[] } {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const packsRaw = Array.isArray(obj.packs) ? obj.packs : [];

  const usedIndices = new Set<number>();
  const packs: ParsedOrganizePack[] = [];

  for (const p of packsRaw) {
    if (!p || typeof p !== "object") continue;
    const nameRaw = (p as { name?: unknown }).name;
    const name = (typeof nameRaw === "string" ? nameRaw.trim() : "").slice(0, 20) || "기타";

    const indicesRaw = Array.isArray((p as { itemIndices?: unknown }).itemIndices)
      ? ((p as { itemIndices: unknown[] }).itemIndices as unknown[])
      : [];

    const itemIndices: number[] = [];
    for (const raw of indicesRaw) {
      const idx = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isInteger(idx) || idx < 0 || idx >= validCount) continue;
      if (usedIndices.has(idx)) continue; // 중복 index는 처음 나온 팩에만 귀속
      usedIndices.add(idx);
      itemIndices.push(idx);
    }

    if (itemIndices.length > 0) {
      packs.push({ name, itemIndices });
    }

    if (packs.length >= MAX_PACKS) break;
  }

  // AI가 빠뜨린 index가 있으면(응답 누락 등) 데이터 손실 없이 "미분류" 팩에 모아준다.
  const missing: number[] = [];
  for (let i = 0; i < validCount; i++) {
    if (!usedIndices.has(i)) missing.push(i);
  }
  if (missing.length > 0) {
    packs.push({ name: "미분류", itemIndices: missing });
  }

  return { packs };
}

export async function POST(req: NextRequest) {
  let quota;
  try {
    quota = await verifyAndConsumeAiQuota(req);
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

  const itemsRaw = (body as { items?: unknown })?.items;
  const existingPackNamesRaw = (body as { existingPackNames?: unknown })?.existingPackNames;

  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
    return NextResponse.json({ error: "정리할 짐이 없어요" }, { status: 400 });
  }

  const items = itemsRaw
    .filter(
      (i): i is { index: unknown; text: unknown } => !!i && typeof i === "object"
    )
    .map((i) => ({
      index: Number((i as { index: unknown }).index),
      text: String((i as { text: unknown }).text ?? "").slice(0, 60),
    }))
    .filter((i) => Number.isInteger(i.index) && i.text.trim().length > 0)
    .slice(0, MAX_ITEMS);

  if (items.length === 0) {
    return NextResponse.json({ error: "정리할 짐이 없어요" }, { status: 400 });
  }

  const validCount = items.length;
  const existingPackNames = Array.isArray(existingPackNamesRaw)
    ? existingPackNamesRaw.filter((n): n is string => typeof n === "string").slice(0, 10)
    : [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[팩인백] GEMINI_API_KEY가 설정되어 있지 않아요");
    return NextResponse.json(
      { error: "AI 분석 기능이 아직 설정되지 않았어요" },
      { status: 500 }
    );
  }

  const userText = items.map((i) => `${i.index}: ${i.text}`).join("\n");

  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 900;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  let geminiRes: Response | null = null;
  let lastStatus = 0;
  let lastErrText = "";

  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: buildSystemPrompt(existingPackNames) }] },
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
        `[팩인백] Gemini API 오류 (가방 정리, 시도 ${attempt + 1}/${MAX_RETRIES + 1}):`,
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
            : "AI 정리 중 문제가 발생했어요";
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
      console.error("[팩인백] JSON 파싱 실패 (가방 정리), 원문:", raw);
      return NextResponse.json(
        { error: "AI 응답을 해석하지 못했어요. 다시 시도해주세요" },
        { status: 502 }
      );
    }

    const result = sanitizeResult(parsed, validCount);
    return NextResponse.json({
      ...result,
      quota: { unlimited: quota.unlimited, usedCount: quota.usedCount, limit: quota.limit },
    });
  } catch (err) {
    console.error("[팩인백] 가방 정리 실패:", err);
    return NextResponse.json({ error: "서버 오류가 발생했어요" }, { status: 500 });
  }
}
