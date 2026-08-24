import { NextRequest, NextResponse } from "next/server";
import { verifyAndCheckAiQuota, consumeAiQuota, AiAuthError } from "@/lib/aiQuotaServer";
import { getGeminiEndpoint } from "@/lib/geminiConfig";

export const runtime = "nodejs";

const MAX_CSV_CHAR_LIMIT = 8000;
const MAX_PACKS = 8;
const MAX_ITEMS_PER_PACK = 50;

/**
 * 구글 시트 URL에서 스프레드시트 ID와 gid(시트 탭 ID)를 추출하여
 * CSV 내보내기 직통 URL로 변환합니다.
 */
function parseGoogleSheetsUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim());
    if (!url.hostname.includes("docs.google.com") || !url.pathname.includes("/spreadsheets")) {
      return null;
    }

    // /spreadsheets/d/{SPREADSHEET_ID}/...
    const matches = url.pathname.match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/);
    if (!matches || !matches[1]) return null;

    const spreadsheetId = matches[1];

    // gid 추출 (query param ?gid=123 또는 hash #gid=123)
    let gid = url.searchParams.get("gid");
    if (!gid && url.hash) {
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, "?"));
      gid = hashParams.get("gid");
    }

    const gidParam = gid ? `&gid=${gid}` : "";
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gidParam}`;
  } catch {
    return null;
  }
}

function cleanCsv(rawCsv: string): string {
  return rawCsv
    .split(/\r?\n/)
    .map((line) => line.replace(/,{2,}/g, ",").replace(/^,+|,+$/g, "").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

const SYSTEM_PROMPT = `당신은 모든 종류의 프로젝트, 업무 관리(WBS/스프린트), QA 점검, 기획/행사, 여행/출장 등 다양한 스프레드시트(구글 시트, 엑셀)를 분석하여 팩인백(PackInBag) 가방과 팩으로 완벽하게 정리해주는 전문 범용 AI 도우미입니다.

사용자가 제공한 스프레드시트 데이터를 빠짐없이 꼼꼼하게 분석하여 모든 정보(업무 태스크, 담당자, 마감일, 상태, 스펙, 점검항목, 비용, 항공/숙소 등)를 의미 있는 팩과 항목으로 가득 채워주세요.

응답 형식 (JSON):
{
  "bagName": "시트 전체 주제를 대표하는 가방 이름 (예: [프로젝트] 백화점 POS 연동 WBS, 2026.09 하와이 여행, 신규 서버 배포 점검 등)",
  "travelDate": "2026-09-09", // 시트에 프로젝트 마감일, 배포일, 행사일, 출발일 등 주요 목표 날짜가 있다면 YYYY-MM-DD 형식으로 추출 (없으면 생략)
  "packs": [
    {
      "name": "카테고리 또는 작업 영역 이름 (예: 결제 모듈 연동, QA 점검 리스트, 항공편 정보, 숙소 예약, 사전 지출 등)",
      "items": [
        { "text": "완결성 있는 상세 업무 또는 항목 내용", "checked": false }
      ]
    }
  ]
}

규칙:
1. [필수] 빈 팩(items가 비어있는 팩)을 절대 만들지 마세요! 시트에 있는 모든 행과 데이터를 누락 없이 알맞은 팩의 항목(items)으로 가득 채워주세요.
2. 업무/프로젝트 WBS 시트의 경우:
   - 각 작업명(Task)에 담당자, 상태, 기한, 비고를 자연스럽게 결합하여 완결성 있는 텍스트로 만드세요.
   - 예: "[진행중] PG사 결제 연동 API 개발 (담당: 김철수 | 기한: 8/30 | 비고: 테스트키 발급 완료)"
3. 점검/체크리스트/QA 시트의 경우:
   - 완료 여부(TRUE, O, 완료, Done, Pass, Y, 100% 등)가 표시된 항목은 checked: true, 미완료(대기, 진행중, Fail, TODO, FALSE 등)는 checked: false로 설정하세요.
4. 여행/출장/행사/예산 시트의 경우:
   - 비행/교통: 편명, 출발/도착 시간 및 터미널, 취소기한 등을 개별 항목으로 명확히 등록하세요.
   - 숙소/장소: 숙소명, 체크인/아웃 시간, 룸타입, 결제금액, 예약사이트, 예약번호, 비고 등을 개별 항목으로 등록하세요.
   - 예산/지출: 항목별 금액과 총합계를 상세 항목으로 등록하세요.
   - 일정/투어: 세부 일정 및 활동을 개별 항목으로 등록하세요.
5. 단일 시트 내 다중 표(블록) 구조:
   - 빈 행이나 소제목(*, [], #)으로 구분된 각 표 블록을 논리적인 팩으로 분할하여 정리하세요.
6. 팩은 최대 ${MAX_PACKS}개까지만 생성하세요.`;

interface ParsedPackRaw {
  name?: string;
  kind?: "pack" | "editor";
  items?: Array<{ text?: string; checked?: boolean } | string>;
  tableData?: string[][];
}

function convertTableToTipTapDoc(table: string[][]): object {
  if (!table || table.length === 0) {
    return {
      type: "doc",
      content: [{ type: "paragraph" }],
    };
  }

  const rows = table.slice(0, 30).map((row, rowIndex) => {
    const isHeader = rowIndex === 0;
    const cells = row.slice(0, 10).map((cellText) => ({
      type: isHeader ? "tableHeader" : "tableCell",
      content: [
        {
          type: "paragraph",
          content: cellText ? [{ type: "text", text: String(cellText).trim() }] : [],
        },
      ],
    }));
    return {
      type: "tableRow",
      content: cells,
    };
  });

  return {
    type: "doc",
    content: [
      {
        type: "table",
        content: rows,
      },
    ],
  };
}

function sanitizeSpreadsheetResult(raw: unknown) {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const bagNameRaw = typeof obj.bagName === "string" ? obj.bagName.trim() : "";
  const bagName = bagNameRaw.slice(0, 30) || "새 스프레드시트 가방";
  const travelDate =
    typeof obj.travelDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(obj.travelDate.trim())
      ? obj.travelDate.trim()
      : undefined;

  const packsRaw = Array.isArray(obj.packs) ? (obj.packs as ParsedPackRaw[]) : [];
  const packs = packsRaw
    .filter((p) => p && typeof p === "object")
    .map((p, idx) => {
      const name = (p.name || `팩 ${idx + 1}`).trim().slice(0, 25);
      const isEditor = p.kind === "editor";

      // 일반 체크리스트 항목들
      const itemsRaw = Array.isArray(p.items) ? p.items : [];
      const items = itemsRaw
        .map((item, itemIdx) => {
          if (typeof item === "string") {
            const text = item.trim().slice(0, 80);
            return text ? { id: `item-${Date.now()}-${itemIdx}`, text, checked: false, type: "check" as const } : null;
          }
          if (item && typeof item === "object") {
            const text = (item.text || "").trim().slice(0, 80);
            if (!text) return null;
            return {
              id: `item-${Date.now()}-${itemIdx}`,
              text,
              checked: !!item.checked,
              type: "check" as const,
            };
          }
          return null;
        })
        .filter((i): i is NonNullable<typeof i> => i !== null)
        .slice(0, MAX_ITEMS_PER_PACK);

      if (isEditor && Array.isArray(p.tableData) && p.tableData.length > 0) {
        const editorDoc = convertTableToTipTapDoc(p.tableData);
        return {
          id: `pack-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          name,
          kind: "editor" as const,
          items,
          editorDoc,
          editorPreviewText: p.tableData[0]?.join(" | ") || "스프레드시트 표",
        };
      }

      return {
        id: `pack-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        kind: "checklist" as const,
        items: items.length > 0 ? items : [{ id: `item-${Date.now()}-0`, text: "내용 확인하기", checked: false, type: "check" as const }],
      };
    })
    .slice(0, MAX_PACKS);

  return {
    bagName,
    travelDate,
    packs: packs.length > 0 ? packs : [
      {
        id: `pack-${Date.now()}-0`,
        name: "준비물",
        items: [{ id: `item-${Date.now()}-0`, text: "시트 내용 확인하기", checked: false, type: "check" as const }],
      },
    ],
  };
}

export async function POST(req: NextRequest) {
  let quota;
  try {
    quota = await verifyAndCheckAiQuota(req);
  } catch (err) {
    if (err instanceof AiAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[스프레드시트 AI] 할당량 확인 실패:", err);
    return NextResponse.json({ error: "AI 사용량 확인에 실패했어요" }, { status: 500 });
  }

  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `오늘 무료 AI 사용 한도(${quota.limit}회)를 다 썼어요. 내일 다시 시도하거나, 설정 > 이용권 코드를 입력하면 무제한으로 쓸 수 있어요`,
        limitReached: true,
        usedCount: quota.usedCount,
        limit: quota.limit,
      },
      { status: 403 }
    );
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "올바른 요청 형식이 아니에요" }, { status: 400 });
  }

  const rawUrl = body?.url?.trim();
  if (!rawUrl) {
    return NextResponse.json({ error: "스프레드시트 링크를 입력해주세요" }, { status: 400 });
  }

  // 1. 다운로드 대상 URL 결정
  const googleExportUrl = parseGoogleSheetsUrl(rawUrl);
  const targetFetchUrl = googleExportUrl || rawUrl;

  let csvText = "";
  try {
    const fetchRes = await fetch(targetFetchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PackInBagBot/1.0)",
        Accept: "text/csv,text/plain,application/json,*/*",
      },
      redirect: "follow",
    });

    if (!fetchRes.ok) {
      if (fetchRes.status === 401 || fetchRes.status === 403 || googleExportUrl) {
        return NextResponse.json(
          {
            error: "구글 시트에 접근할 수 없어요. 공유 설정을 '링크가 있는 모든 사용자(뷰어)'로 변경해주세요.",
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: `스프레드시트를 불러오지 못했어요 (${fetchRes.status})` },
        { status: 400 }
      );
    }

    const contentType = fetchRes.headers.get("content-type") || "";
    const responseText = await fetchRes.text();

    // 구글 로그인 리디렉션 페이지(HTML) 감지
    if (responseText.includes("accounts.google.com") || responseText.includes("ServiceLogin") || (contentType.includes("text/html") && googleExportUrl)) {
      return NextResponse.json(
        {
          error: "구글 시트가 비공개 상태예요. 구글 시트 우측 상단 [공유]에서 '링크가 있는 모든 사용자(뷰어)'로 변경해주세요.",
        },
        { status: 400 }
      );
    }

    const cleaned = cleanCsv(responseText);
    csvText = cleaned.slice(0, MAX_CSV_CHAR_LIMIT);
  } catch (fetchErr) {
    console.error("[스프레드시트 AI] 시트 데이터 가져오기 실패:", fetchErr);
    return NextResponse.json(
      { error: "스프레드시트 주소에 연결할 수 없어요. 주소를 다시 확인해주세요." },
      { status: 400 }
    );
  }

  if (!csvText.trim()) {
    return NextResponse.json({ error: "스프레드시트에 담긴 내용이 없어요" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[스프레드시트 AI] GEMINI_API_KEY가 설정되어 있지 않아요");
    return NextResponse.json(
      { error: "AI 분석 기능이 아직 설정되지 않았어요" },
      { status: 500 }
    );
  }

  // 2. Gemini AI 호출 (일시적 과부하 방어용 재시도 포함)
  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 900;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  let geminiRes: Response | null = null;
  let lastStatus = 0;
  let lastErrText = "";

  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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
                  text: `[사용자가 제공한 스프레드시트 데이터]\n${csvText}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      });

      if (res.ok) {
        geminiRes = res;
        break;
      }

      lastStatus = res.status;
      lastErrText = await res.text();
      console.warn(`[스프레드시트 AI] Gemini 응답 오류 (시도 ${attempt + 1}/${MAX_RETRIES + 1}):`, lastStatus, lastErrText);

      if ((lastStatus === 429 || lastStatus === 503) && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      break;
    }

    if (!geminiRes) {
      console.error("[스프레드시트 AI] Gemini API 호출 실패:", lastStatus, lastErrText);
      return NextResponse.json({ error: "AI 분석 중 오류가 발생했어요" }, { status: 500 });
    }

    const aiData = await geminiRes.json();
    const replyText =
      aiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "{}";

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(replyText);
    } catch {
      const cleaned = replyText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      parsedJson = JSON.parse(cleaned);
    }

    const sanitized = sanitizeSpreadsheetResult(parsedJson);

    // AI 사용량 1회 차감
    await consumeAiQuota(quota.uid);

    return NextResponse.json(sanitized);
  } catch (aiErr) {
    console.error("[스프레드시트 AI] 분석 실패:", aiErr);
    return NextResponse.json({ error: "스프레드시트 분석에 실패했어요" }, { status: 500 });
  }
}
