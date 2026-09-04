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

const SYSTEM_PROMPT = `당신은 모든 종류의 프로젝트 WBS, 업무 관리, QA 검수표, 기획서, 회의록, 여행/출장 등 다양한 스프레드시트(구글 시트, 엑셀)를 분석하여 팩인백(PackInBag)의 '자유문서형 메모팩(TipTap Rich Note Editor)'으로 아름답고 정갈하게 정리해주는 전문 AI 도우미입니다.

사용자가 제공한 스프레드시트 데이터를 빠짐없이 꼼꼼하게 분석하여 각 섹션을 [인터랙티브 표(table), 체크박스 할 일 목록(taskList), 글머리 기호(bulletList), 콜아웃(callout), 소제목(heading)] 서식이 적용된 메모팩들로 정리해주세요. 단순 평문 나열을 지양하고, 실제 웹 문서처럼 격자 표와 서식을 풍성하게 사용하세요.

응답 형식 (JSON):
{
  "bagName": "시트 전체 주제를 대표하는 가방 이름 (예: 2026.09 하와이(호놀룰루) 여행, [프로젝트] 결제 연동 업무 WBS 등)",
  "travelDate": "2026-09-09", // 시트에 출발일, 마감일, 배포일, 행사일 등 주요 날짜가 있다면 YYYY-MM-DD 형식으로 추출 (없으면 생략)
  "packs": [
    {
      "name": "섹션 이름 (예: ✈️ 비행 및 항공편, 🏨 숙소 예약 현황, 💰 사전 지출 내역, ✅ 여행 준비 체크리스트, 🏄 투어 및 액티비티 등)",
      "preview": "카드에 노출될 1줄 요약 (예: 인천-호놀룰루 왕복 YP151/YP152, 힐튼 와이키키 5박 등)",
      "blocks": [
        // 표 데이터 (항공편, 숙소, 지출, WBS 등은 반드시 table로 구성)
        {
          "type": "table",
          "headers": ["구분", "노선", "일시", "편명", "터미널"],
          "rows": [
            ["출국", "인천 -> 호놀룰루", "26/9/9 22:30 -> 12:30", "YP151", "1터미널"],
            ["귀국", "호놀룰루 -> 인천", "26/9/14 14:30 -> 19:05", "YP152", "2터미널"]
          ]
        },
        // 콜아웃/팁
        { "type": "callout", "text": "무료 취소 기한: 2026년 6월 10일까지 (-91일)" },
        // 체크리스트 (준비물, 투두, 액션아이템)
        {
          "type": "taskList",
          "items": [
            { "text": "국제면허증 발급 (삿포로 때 발급 완료)", "checked": true },
            { "text": "ESTA 비자 신청 및 확인 (접수 완료)", "checked": true },
            { "text": "eSim 구매 및 확인", "checked": false },
            { "text": "공항버스 예매", "checked": false }
          ]
        },
        // 불릿 리스트
        {
          "type": "bulletList",
          "items": [
            "거북이 투어 알아보기 및 예약",
            "쥬라기 투어 (쿠알로아 랜치) 예약",
            "하나우마베이 스노쿨링 예약/일정 확인"
          ]
        }
      ]
    }
  ]
}

규칙:
1. 모든 팩은 빈틈없이 풍성한 서식 블록(blocks)을 갖추어야 합니다. 단순 텍스트 나열을 금지합니다.
2. 표 데이터: 항공편, 숙소 예약, 예산/지출, WBS 작업목록, 담당자표 등 다열 데이터는 무조건 "table" 블록(headers, rows)으로 깔끔한 격자 표를 만드세요.
3. 체크리스트: 준비물, 점검항목, 할 일 등은 "taskList" 블록을 쓰고, 완료된 항목은 checked: true, 미완료는 checked: false로 지정하세요.
4. 예약번호, 링크, 금액, 특이사항 등은 표의 비고 열이나 "callout", "paragraph" 블록을 활용하세요.
5. 팩은 최대 ${MAX_PACKS}개까지만 생성하세요.`;

interface DocBlock {
  type?: "heading" | "table" | "taskList" | "bulletList" | "paragraph" | "callout";
  level?: 2 | 3;
  text?: string;
  bold?: boolean;
  headers?: string[];
  rows?: string[][];
  items?: Array<{ text?: string; checked?: boolean } | string>;
}

interface ParsedPackRaw {
  name?: string;
  preview?: string;
  blocks?: DocBlock[];
  // 구버전 호환용
  tableData?: string[][];
  items?: Array<{ text?: string; checked?: boolean } | string>;
}

function convertBlocksToTipTapDoc(blocks: DocBlock[]): object {
  const content: object[] = [];

  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;

    if (block.type === "heading" && block.text) {
      content.push({
        type: "heading",
        attrs: { level: block.level || 2 },
        content: [{ type: "text", text: String(block.text).trim() }],
      });
    } else if (block.type === "table" && Array.isArray(block.rows) && block.rows.length > 0) {
      const tableRows: object[] = [];
      if (Array.isArray(block.headers) && block.headers.length > 0) {
        tableRows.push({
          type: "tableRow",
          content: block.headers.map((h) => ({
            type: "tableHeader",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: String(h || "").trim(), marks: [{ type: "bold" }] }],
              },
            ],
          })),
        });
      }
      for (const row of block.rows) {
        if (Array.isArray(row)) {
          tableRows.push({
            type: "tableRow",
            content: row.map((cell) => ({
              type: "tableCell",
              content: [
                {
                  type: "paragraph",
                  content: cell ? [{ type: "text", text: String(cell).trim() }] : [],
                },
              ],
            })),
          });
        }
      }
      if (tableRows.length > 0) {
        content.push({ type: "table", content: tableRows });
      }
    } else if (block.type === "taskList" && Array.isArray(block.items)) {
      const taskItems = block.items
        .map((item) => {
          const text = typeof item === "string" ? item.trim() : (item?.text || "").trim();
          if (!text) return null;
          const checked = typeof item === "object" && !!item?.checked;
          return {
            type: "taskItem",
            attrs: { checked },
            content: [{ type: "paragraph", content: [{ type: "text", text }] }],
          };
        })
        .filter((t): t is NonNullable<typeof t> => t !== null);

      if (taskItems.length > 0) {
        content.push({ type: "taskList", content: taskItems });
      }
    } else if (block.type === "bulletList" && Array.isArray(block.items)) {
      const listItems = block.items
        .map((item) => {
          const text = typeof item === "string" ? item.trim() : (item?.text || "").trim();
          if (!text) return null;
          return {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text }] }],
          };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null);

      if (listItems.length > 0) {
        content.push({ type: "bulletList", content: listItems });
      }
    } else if (block.type === "callout" && block.text) {
      content.push({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: `💡 ${String(block.text).trim()}`,
            marks: [{ type: "bold" }],
          },
        ],
      });
    } else if ((block.type === "paragraph" || !block.type) && block.text) {
      const marks = block.bold ? [{ type: "bold" }] : [];
      content.push({
        type: "paragraph",
        content: [{ type: "text", text: String(block.text).trim(), marks }],
      });
    }
  }

  if (content.length === 0) {
    content.push({ type: "paragraph" });
  }

  return { type: "doc", content };
}

function sanitizeSpreadsheetResult(raw: unknown) {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const bagNameRaw = typeof obj.bagName === "string" ? obj.bagName.trim() : "";
  const bagName = bagNameRaw.slice(0, 35) || "새 스프레드시트 가방";
  const travelDate =
    typeof obj.travelDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(obj.travelDate.trim())
      ? obj.travelDate.trim()
      : undefined;

  const packsRaw = Array.isArray(obj.packs) ? (obj.packs as ParsedPackRaw[]) : [];
  const packs = packsRaw
    .filter((p) => p && typeof p === "object")
    .map((p, idx) => {
      const name = (p.name || `메모팩 ${idx + 1}`).trim().slice(0, 25);

      // blocks 변환
      let editorDoc: object;
      if (Array.isArray(p.blocks) && p.blocks.length > 0) {
        editorDoc = convertBlocksToTipTapDoc(p.blocks);
      } else if (Array.isArray(p.tableData) && p.tableData.length > 0) {
        editorDoc = convertBlocksToTipTapDoc([
          { type: "table", headers: p.tableData[0], rows: p.tableData.slice(1) },
        ]);
      } else if (Array.isArray(p.items) && p.items.length > 0) {
        editorDoc = convertBlocksToTipTapDoc([
          { type: "taskList", items: p.items },
        ]);
      } else {
        editorDoc = { type: "doc", content: [{ type: "paragraph" }] };
      }

      const editorPreviewText =
        (typeof p.preview === "string" && p.preview.trim()) ||
        p.blocks?.[0]?.text ||
        p.blocks?.[0]?.headers?.join(" | ") ||
        "스프레드시트 메모";

      return {
        id: `pack-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        kind: "editor" as const,
        items: [],
        editorDoc,
        editorPreviewText: editorPreviewText.slice(0, 60),
      };
    })
    .slice(0, MAX_PACKS);

  return {
    bagName,
    travelDate,
    packs: packs.length > 0 ? packs : [
      {
        id: `pack-${Date.now()}-0`,
        name: "메모",
        kind: "editor" as const,
        items: [],
        editorDoc: { type: "doc", content: [{ type: "paragraph" }] },
        editorPreviewText: "스프레드시트 메모",
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
