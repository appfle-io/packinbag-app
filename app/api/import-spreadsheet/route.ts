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

const SYSTEM_PROMPT = `당신은 여행, 외출, 프로젝트, 업무 정리용 스프레드시트(구글 시트, 엑셀 표) 데이터를 분석하여 팩인백(PackInBag) 가방과 팩으로 정리해주는 전문 AI 도우미입니다.
사용자가 제공한 스프레드시트 CSV 데이터를 분석하여 아래 JSON 형식으로만 응답하세요. 그 외의 설명, 인사말, 코드블록 기호(\`\`\`)는 절대 포함하지 마세요.

{
  "bagName": "시트 내용에 어울리는 대표 가방 이름 (예: 2026.08 도쿄 여행, 백화점 POS 연동 프로젝트, 제주도 워크샵 등)",
  "packs": [
    {
      "name": "카테고리 또는 작업 영역 이름",
      "kind": "pack", // 단순 체크/준비물 목록인 경우 "pack", 일정표/R&R/회의록/다열 업무표인 경우 "editor"
      "items": [
        { "text": "항목 내용", "checked": false }
      ],
      "tableData": [ // kind가 "editor"인 경우 표 데이터 (2차원 배열). 없을 경우 빈 배열
        ["구분", "내용", "담당자"],
        ["기능개발", "API 연동", "김철수"]
      ]
    }
  ]
}

규칙:
1. bagName: 스프레드시트의 주제를 가장 잘 나타내는 간결하고 명확한 제목을 지어주세요.
2. 팩 분류:
   - 단순 할 일(To-do)이나 짐 목록 성격의 행들은 kind: "pack"으로 묶고, items 배열에 담으세요.
   - 다열 표(3열 이상), 타임라인 일정표, 담당자별 R&R, 세부 스펙 문서는 kind: "editor"로 지정하고 tableData에 행과 열 데이터를 2차원 배열로 담으세요.
3. 체크 여부(checked): 원본 시트에 완료 표시("O", "V", "완료", "Y", "TRUE", "☑", 취소선 등)가 있다면 checked: true, 미완료면 checked: false로 설정하세요.
4. 팩은 최대 ${MAX_PACKS}개까지만 생성하세요.
5. 불필요한 공백 행이나 헤더 찌꺼기는 정리하고 깔끔한 텍스트만 추출하세요.`;

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

  const packsRaw = Array.isArray(obj.packs) ? (obj.packs as ParsedPackRaw[]) : [];
  const packs = packsRaw
    .filter((p) => p && typeof p === "object")
    .map((p, idx) => {
      const name = (p.name || `팩 ${idx + 1}`).trim().slice(0, 20);
      const isEditor = p.kind === "editor";

      if (isEditor && Array.isArray(p.tableData) && p.tableData.length > 0) {
        const editorDoc = convertTableToTipTapDoc(p.tableData);
        return {
          id: `pack-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          name,
          kind: "editor" as const,
          items: [],
          editorDoc,
          editorPreviewText: p.tableData[0]?.join(" | ") || "스프레드시트 표",
        };
      }

      // 일반 체크리스트 팩
      const itemsRaw = Array.isArray(p.items) ? p.items : [];
      const items = itemsRaw
        .map((item, itemIdx) => {
          if (typeof item === "string") {
            const text = item.trim().slice(0, 60);
            return text ? { id: `item-${Date.now()}-${itemIdx}`, text, checked: false, type: "check" as const } : null;
          }
          if (item && typeof item === "object") {
            const text = (item.text || "").trim().slice(0, 60);
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

      return {
        id: `pack-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        kind: "normal" as const,
        items: items.length > 0 ? items : [{ id: `item-${Date.now()}-0`, text: "준비물", checked: false, type: "check" as const }],
      };
    })
    .slice(0, MAX_PACKS);

  return {
    bagName,
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

    csvText = responseText.slice(0, MAX_CSV_CHAR_LIMIT);
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
