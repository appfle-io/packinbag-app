import { NextRequest, NextResponse } from "next/server";
import { verifyAndCheckAiQuota, consumeAiQuota, AiAuthError } from "@/lib/aiQuotaServer";
import { getGeminiEndpoint } from "@/lib/geminiConfig";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB

const SYSTEM_PROMPT = `당신은 항공권/여행 티켓 분석 및 맞춤 짐 싸기 가이드 AI 전문가입니다.
사용자가 업로드한 항공권 예약 확인서, 탑승권, KTX/기차표, 여행 일정표 이미지나 PDF를 분석하여 여행 정보를 추출하고 실용적인 맞춤 가방 팩과 짐 목록을 생성하세요.

반드시 아래 JSON 형식으로만 응답하세요. 그 외의 설명이나 코드블록 기호(\`\`\`)는 절대 포함하지 마세요.

{
  "bagName": "도쿄 3박 4일 여행",
  "travelDate": "2026-09-15",
  "airlineInfo": "대한항공 KE703 (인천 T2) / 위탁 23kg, 기내 10kg",
  "packs": [
    {
      "name": "🧳 기내 반입 수하물",
      "items": [
        { "text": "여권 및 탑승권", "checked": false },
        { "text": "보조배터리 (위탁 불가, 기내 소지)", "checked": false },
        { "text": "100ml 이하 액체류 지퍼백", "checked": false },
        { "text": "목베개 / 안대", "checked": false }
      ]
    },
    {
      "name": "📦 위탁 수하물 (의류/생활)",
      "items": [
        { "text": "110V 돼지코 어댑터", "checked": false },
        { "text": "3박용 상하의 및 속옷", "checked": false },
        { "text": "세면도구 본품 (샴푸/바디워시)", "checked": false },
        { "text": "상비약 (소화제/진통제)", "checked": false }
      ]
    }
  ],
  "tripMemo": "출발 편명: KE703. 인천공항 T2 출국장 3시간 전 도착 권장. 기내 액체류 100ml 이하 용기 1L 지퍼백 규정을 지켜주세요."
}

규칙:
1. bagName: 목적지와 여행 기간을 고려해 간결하고 자연스럽게 지으세요 (예: "후쿠오카 2박 3일", "제주도 3박 4일").
2. travelDate: 티켓의 출발 날짜를 YYYY-MM-DD 형식으로 정확히 파악하세요. 날짜를 알 수 없으면 빈 문자열("")로 두세요.
3. airlineInfo: 항공사/편명/터미널/수하물 규정이 보이면 짧게 요약하세요.
4. packs: 목적지(국가/도시)의 특수 준비물(예: 일본 110V, 동남아 샤워필터/모기약)과 항공 수하물 규정을 반영하여 실용적인 팩 2~4개를 구성하세요.
5. tripMemo: 출국/탑승 시 챙겨야 할 주의사항이나 공항 꿀팁을 2~3줄로 정리하세요.`;

interface ParsedItem {
  text: string;
  checked: boolean;
}

interface ParsedPack {
  name: string;
  items: ParsedItem[];
}

interface SanitizedOcrResult {
  bagName: string;
  travelDate?: string;
  airlineInfo?: string;
  packs: ParsedPack[];
  tripMemo?: string;
}

function sanitizeResult(raw: unknown): SanitizedOcrResult {
  const obj = (raw ?? {}) as Record<string, unknown>;

  const bagNameRaw = typeof obj.bagName === "string" ? obj.bagName.trim() : "";
  const bagName = bagNameRaw.slice(0, 30) || "새 여행 가방";

  const travelDateRaw = typeof obj.travelDate === "string" ? obj.travelDate.trim() : "";
  const travelDate = /^\d{4}-\d{2}-\d{2}$/.test(travelDateRaw) ? travelDateRaw : undefined;

  const airlineInfo = typeof obj.airlineInfo === "string" ? obj.airlineInfo.trim().slice(0, 80) : undefined;
  const tripMemo = typeof obj.tripMemo === "string" ? obj.tripMemo.trim().slice(0, 300) : undefined;

  const packsRaw = Array.isArray(obj.packs) ? obj.packs : [];
  const packs: ParsedPack[] = packsRaw
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p) => {
      const name = typeof p.name === "string" ? p.name.trim().slice(0, 20) : "준비물";
      const itemsRaw = Array.isArray(p.items) ? p.items : [];
      const items: ParsedItem[] = itemsRaw
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
        .map((item) => ({
          text: typeof item.text === "string" ? item.text.trim().slice(0, 50) : "",
          checked: !!item.checked,
        }))
        .filter((item) => item.text.length > 0)
        .slice(0, 30);
      return { name, items };
    })
    .filter((p) => p.items.length > 0)
    .slice(0, 6);

  return { bagName, travelDate, airlineInfo, packs, tripMemo };
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

  const { fileBase64, mimeType } = (body ?? {}) as {
    fileBase64?: string;
    mimeType?: string;
  };

  if (!fileBase64 || typeof fileBase64 !== "string") {
    return NextResponse.json({ error: "업로드된 티켓 파일이 없어요" }, { status: 400 });
  }

  const approxBytes = Math.floor(fileBase64.length * 0.75);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "파일 크기는 4MB 이하만 가능해요" }, { status: 400 });
  }

  const validMime = mimeType || "image/jpeg";
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
          contents: [
            {
              role: "user",
              parts: [
                {
                  inline_data: {
                    mime_type: validMime,
                    data: fileBase64,
                  },
                },
                {
                  text: "이 항공권/티켓 이미지를 분석하여 여행 정보와 맞춤 짐 목록을 생성해주세요.",
                },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (!res.ok) {
      console.error("[팩인백] 티켓 OCR API 호출 실패:", res.status, await res.text());
      return NextResponse.json({ error: "티켓 인식에 실패했어요. 글자가 선명한 이미지로 다시 시도해주세요" }, { status: 502 });
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
      return NextResponse.json({ error: "티켓 정보를 해석하지 못했어요" }, { status: 502 });
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
    console.error("[팩인백] 티켓 OCR 처리 오류:", err);
    return NextResponse.json({ error: "서버 처리 중 오류가 발생했어요" }, { status: 500 });
  }
}
