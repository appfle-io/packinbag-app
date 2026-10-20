import { NextRequest, NextResponse } from "next/server";
import { verifyAndCheckAiQuota, consumeAiQuota, AiAuthError, withAiQuotaSettlement, AI_PREMIUM_CAP_MESSAGE } from "@/lib/aiQuotaServer";
import { getGeminiEndpoint } from "@/lib/geminiConfig";

// 날씨 · 명소 추천 AI(가방 더보기 > 날씨 · 명소 추천 > "AI로 추천받기", 2026-10-20).
// 오늘부터 3일 날씨 + 가방 이름 + 이미 있는 아이템을 보고, 챙길 것 5~10개(이유 한 줄)와 가볼 곳 3~5개(설명 · 날씨 맞춤)를 돌려준다.
// 예전(10/20 전)에는 가벼운 모델로 아이템 4개(15자)만 줬다. 지금은 기본 모델(GEMINI_MODEL).
// 하루 횟수는 시작할 때 예약하고, 쓸 만한 답을 받았을 때만 확정한다(lib/aiQuotaServer.ts) - 실패하면 횟수는 그대로다
export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_ITEMS = 10;
const MAX_PLACES = 5;
const MAX_EXISTING = 150;

interface DayIn {
  label: string;
  date: string;
  weatherText: string;
  tempMin: number;
  tempMax: number;
  feelsMin: number;
  feelsMax: number;
  rainProb: number | null;
  uvMax: number | null;
  windMax: number | null;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\r\n\t]+/g, " ").trim().slice(0, max) : "");
const clamp = (v: unknown, lo: number, hi: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v * 10) / 10)) : null;

// 길이 · 범위 상한(AI 비용 · 프롬프트 끼워넣기 방지)
function readDays(raw: unknown): DayIn[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 3).flatMap((d) => {
    if (!d || typeof d !== "object") return [];
    const o = d as Record<string, unknown>;
    const tempMin = clamp(o.tempMin, -60, 60);
    const tempMax = clamp(o.tempMax, -60, 60);
    if (tempMin == null || tempMax == null) return [];
    return [
      {
        label: str(o.label, 4) || "날짜",
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(o.date)) ? String(o.date) : "",
        weatherText: str(o.weatherText, 10) || "맑음",
        tempMin,
        tempMax,
        feelsMin: clamp(o.feelsMin, -70, 70) ?? tempMin,
        feelsMax: clamp(o.feelsMax, -70, 70) ?? tempMax,
        rainProb: clamp(o.rainProb, 0, 100),
        uvMax: clamp(o.uvMax, 0, 20),
        windMax: clamp(o.windMax, 0, 80),
      },
    ];
  });
}

function parseResult(rawText: string): { summary: string; items: { text: string; reason: string }[]; places: { name: string; desc: string }[] } | null {
  if (!rawText) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText.replace(/```json|```/gi, "").trim());
  } catch {
    const m = rawText.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const seen = new Set<string>();
  const items = (Array.isArray(o.items) ? o.items : [])
    .map((i) => (i && typeof i === "object" ? (i as Record<string, unknown>) : {}))
    .map((i) => ({ text: str(i.text ?? i.name, 20), reason: str(i.reason ?? i.desc, 70) }))
    .filter((i) => i.text && !seen.has(i.text) && seen.add(i.text))
    .slice(0, MAX_ITEMS);
  const places = (Array.isArray(o.places) ? o.places : [])
    .map((p) => (p && typeof p === "object" ? (p as Record<string, unknown>) : {}))
    .map((p) => ({ name: str(p.name ?? p.text, 24), desc: str(p.desc ?? p.reason, 90) }))
    .filter((p) => p.name && !seen.has(p.name) && seen.add(p.name))
    .slice(0, MAX_PLACES);
  if (items.length === 0 && places.length === 0) return null;
  return { summary: str(o.summary, 120), items, places };
}

export const POST = withAiQuotaSettlement(handlePOST);

async function handlePOST(req: NextRequest) {
  let quotaCheck;
  try {
    quotaCheck = await verifyAndCheckAiQuota(req);
    if (quotaCheck.capReached) {
      return NextResponse.json({ error: AI_PREMIUM_CAP_MESSAGE }, { status: 429 });
    }
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        {
          error: `오늘 무료 AI 사용 한도(${quotaCheck.limit}회)를 다 썼어요. 내일 다시 시도하거나, 프리미엄으로 더 많이 쓸 수 있어요`,
          limitReached: true,
          usedCount: quotaCheck.usedCount,
          limit: quotaCheck.limit,
        },
        { status: 403 }
      );
    }
  } catch (err) {
    if (err instanceof AiAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[팩인백] AI 날씨 추천 인증 검증 예외:", err);
    return NextResponse.json({ error: "인증 검증 중 오류가 발생했어요" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요" }, { status: 400 });
  }

  const bagName = str(body?.bagName, 60);
  const place = str(body?.place, 40) || bagName;
  const days = readDays(body?.days);
  const existing = (Array.isArray(body?.existingItems) ? body.existingItems : [])
    .map((t) => str(t, 30))
    .filter(Boolean)
    .slice(0, MAX_EXISTING);

  if (!bagName) return NextResponse.json({ error: "가방 이름을 입력해주세요" }, { status: 400 });
  if (days.length === 0) return NextResponse.json({ error: "날씨 정보가 없어요. 새로고침한 뒤 다시 해 주세요" }, { status: 400 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Gemini API 키가 설정되지 않았어요" }, { status: 500 });
  }

  const systemPrompt = `당신은 여행 · 나들이 준비를 돕는 꼼꼼한 한국어 도우미입니다.
가방 이름(여행 · 활동의 목적), 장소, 오늘부터 3일 날씨, 이미 가방에 있는 아이템을 보고 두 가지를 추천합니다.

[챙길 것 items] 5~10개
- 이 날씨와 이 목적에서 실제로 쓸 물건만. 날씨(비 · 바람 · 자외선 · 체감 기온 · 일교차)와 활동(바다 · 산 · 캠핑 · 아이 동반 · 장기 체류 등)을 근거로.
- 이미 가방에 있는 아이템과 같거나 거의 같은 것은 빼세요(예: "우산"이 있으면 "접이식 우산"도 빼기).
- 누구나 늘 챙기는 것(휴대폰, 지갑, 칫솔)은 빼세요.
- text: 물건 이름만 12자 이내(예: "접이식 우비"). reason: 왜 필요한지 날짜 · 숫자를 넣어 40자 이내(예: "내일 오후 강수 확률 70%, 바람 초속 9m라 우산보다 편해요").
- 국내 장소면 여권 · 환전 · 돼지코 같은 해외 물품은 넣지 마세요.

[가볼 곳 places] 3~5개
- 그 장소 근처의 실제로 있는 유명한 명소 · 산책길 · 시장 · 실내 공간. 지어내지 마세요. 확실하지 않으면 개수를 줄이세요.
- 날씨에 맞게: 비 오는 날은 실내, 맑은 날은 바깥, 더우면 그늘 · 물가. 어느 날 가면 좋은지 desc에 넣으세요.
- name: 장소 이름만 16자 이내. desc: 무엇을 하는 곳인지 + 날씨 맞춤 한마디, 60자 이내(예: "용암 동굴 속 산책로. 비 오는 내일 가기 좋아요").
- 장소를 알 수 없으면 빈 배열.

[summary] 3일 날씨를 한 문장으로(50자 이내, 예: "오늘은 맑지만 내일 오후부터 비, 모레는 바람이 강해요").

말투는 짧고 자연스러운 존댓말. 이모지는 쓰지 마세요.
반드시 아래 JSON만 답하세요:
{"summary":"...","items":[{"text":"...","reason":"..."}],"places":[{"name":"...","desc":"..."}]}`;

  const dayLines = days
    .map(
      (d) =>
        `- ${d.label}${d.date ? `(${d.date})` : ""}: ${d.weatherText}, 최저 ${d.tempMin}° · 최고 ${d.tempMax}° (체감 ${d.feelsMin}°~${d.feelsMax}°)` +
        (d.rainProb != null ? `, 강수 확률 ${d.rainProb}%` : "") +
        (d.windMax != null ? `, 최대 바람 초속 ${d.windMax}m` : "") +
        (d.uvMax != null ? `, 자외선 지수 ${d.uvMax}` : ""),
    )
    .join("\n");
  const userContent = `가방 이름: ${bagName}
장소: ${place}
날씨:
${dayLines}
이미 가방에 있는 아이템(${existing.length}개): ${existing.length > 0 ? existing.join(", ") : "없음"}`;

  const MAX_RETRIES = 1;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  let result: ReturnType<typeof parseResult> = null;
  for (let attempt = 0; attempt <= MAX_RETRIES && !result; attempt++) {
    try {
      const res = await fetch(getGeminiEndpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // 키는 주소(?key=)가 아니라 헤더로 보낸다(주소는 로그에 남을 수 있음)
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userContent }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.6 },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const rawText = (data?.candidates?.[0]?.content?.parts ?? [])
          .map((p: { text?: string }) => p?.text ?? "")
          .join("");
        result = parseResult(rawText);
      } else {
        console.warn(`[팩인백] Gemini 날씨 추천 시도 ${attempt + 1} 실패: ${res.status}`);
      }
    } catch (err) {
      console.warn(`[팩인백] Gemini 날씨 추천 시도 ${attempt + 1} 예외:`, err);
    }
    if (!result && attempt < MAX_RETRIES) await sleep(500);
  }

  if (!result) {
    // 예전에는 "여행 준비물" 같은 빈 목록으로 대신했다. 지금은 실패로 알리고 횟수는 되돌린다
    return NextResponse.json({ error: "AI 추천을 받지 못했어요. 잠시 뒤 다시 해 주세요" }, { status: 502 });
  }

  // 쓸 만한 답을 받았을 때만 횟수를 확정한다
  await consumeAiQuota(quotaCheck.uid);
  return NextResponse.json({ ...result, at: new Date().toISOString() });
}
