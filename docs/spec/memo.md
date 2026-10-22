# 메모 편집기 — memo.md

기준 코드: v1.6.1 (2026-10-14). 가방 안 메모 섹션 · 여는 법은 `bag.md` § BAG-MEMO, 보관함 메모 목록은 `packs.md`, 받는 쪽 공유 화면(`/p`)은 `share.md`, 짧은 URL 서버 · "내가 만든 URL" 관리 화면은 `settings.md` · `api.md`에서 다룬다.

- 화면: `components/screens/PackNoteEditorScreen.tsx` (보관함 메모 · 가방 안 메모 공용)
- 툴바 · 시트: `components/v2/note/NoteToolbar.tsx` · `NoteMoreSheet.tsx` · `NoteTableSheet.tsx` · `NoteColorSheet.tsx`(NoteColorSheet · NoteTocSheet) · `LinkSheet.tsx` · `MemoShareSheet.tsx`
- 편집기 확장: `lib/noteEditorExtensions.ts`(TipTap), `lib/noteEditorMarkdownPaste.ts`, `lib/noteEditorTableUtils.ts`, `lib/noteEditorAttachmentExtensions.ts`, `lib/toggleBlockExtension.ts`, `lib/indentExtension.ts`, `components/editor/CodeBlockComponent`
- 용량 · 요약: `lib/editorDocLimits.ts`, 첨부 주소: `lib/editorDocAttachmentUtils.ts`, 병합: `lib/syncMerge.mergeEditorDocs`, 가방 메모 본문 분리: `lib/bagNotesCore.ts` · `bagNotesService.ts`
- 사진 · PDF 보기는 `bag.md` § BAG-ATT-07 · 08과 같은 뷰어

---

## 0. 두 가지 쓰임

| ID | 구분 | 보관함 메모 | 가방 안 메모 |
|---|---|---|---|
| MEMO-CTX-01 | 여는 곳 | 팩 탭 메모 줄 · 검색 | 가방 화면 메모 섹션 · 검색 |
| MEMO-CTX-02 | 저장 위치 | `users/{uid}/packs/{id}`의 `editorDoc` | 본문 `bags/{bagId}/notes/{packId}`, 가방 문서에는 제목 · 미리보기 · `searchText`(앞 2,000자) · `attachmentUrls`만(§ MEMO-NOTE) |
| MEMO-CTX-03 | 첨부 올리는 곳 | Storage 사용자 경로(`uid`) | Storage 가방 경로(`bags/{bagId}/packs/{packId}/…`, 멤버만) |
| MEMO-CTX-04 | 삭제 | 더보기 "메모 삭제" → 확인 → 휴지통 | 더보기 "메모 삭제" → 확인 → 편집기 닫고 가방에서 삭제(bag.md BAG-PACKOP-04) |
| MEMO-CTX-05 | 함께 쓰기 | 없음(내 보관함) | 같은 가방 멤버가 동시에 편집 · 접속자 표시(§ MEMO-SYNC) |
| MEMO-CTX-06 | 보관함 연결 | - | 보관함에서 불러온 메모면 자동 동기화 줄(§ MEMO-STAT) |
| MEMO-CTX-07 | 개인 잠금 | 잠근 보관함 메모면 이 화면이 잠금 화면("잠긴 메모")으로 덮음 | 가방 화면이 먼저 막음(bag.md BAG-LOCK) |
| MEMO-CTX-08 | 읽기 전용 | 무료 한도로 잠긴 팩 | 무료 한도로 잠긴 가방 |

### 한도

| ID | 규칙 | 값 | 코드 |
|---|---|---|---|
| MEMO-LIM-01 | 본문 하나 | 300KB. 넘으면 저장 멈춤(§ MEMO-STAT) | `MAX_EDITOR_DOC_BYTES` |
| MEMO-LIM-02 | 가방 문서 전체(본문을 뗀 뒤) | 900KB | `checkBagSizeForSave` |
| MEMO-LIM-03 | 중첩 깊이 | 60단계 | `MAX_EDITOR_DOC_NESTING_DEPTH` |
| MEMO-LIM-04 | 미리보기 | 120자(넘으면 "…") | `MAX_EDITOR_PREVIEW_CHARS` |
| MEMO-LIM-05 | 이미지가 아닌 첨부 | 10MB | `MAX_PACK_ATTACHMENT_FILE_BYTES` |
| MEMO-LIM-06 | 자동저장 | 0.6초 모았다가 | `AUTOSAVE_DEBOUNCE_MS` |
| MEMO-LIM-07 | 글자 크기 | 8 ~ 28px(기본 16) | `changeFontSize` |
| MEMO-LIM-08 | 제목 단계 | 제목 1 · 2 · 3 | StarterKit heading levels |
| MEMO-LIM-09 | 커스텀 URL 주소 | 한글 · 영문 · 숫자 · - · _, 2~20자 | `validateCustomCode` |

---

## 1. MEMO-SCR 화면 구조 (위에서 아래로)

| ID | 요소 | 보이는 조건 | 동작 · 문구 |
|---|---|---|---|
| MEMO-SCR-01 | 뒤로(‹) | 항상 | 대기 중 저장을 바로 내보내고(읽기 전용 제외) 공유 링크 갱신(§ MEMO-SHARE-05) 후 닫기. 화면 어디서나 오른쪽으로 밀어도 같음(입력 중이면 왼쪽 끝에서만 - shell.md) |
| MEMO-SCR-02 | 공유 | 계정 모드 | 끊겨 있으면 미리 막음. § MEMO-SHARE |
| MEMO-SCR-03 | ⋯ 더보기 | 항상 | § MEMO-MORE |
| MEMO-SCR-04 | 제목 | 항상 | 큰 입력칸, 자리글 "새 메모". 엔터 = 확정. 칸을 벗어날 때 앞뒤 공백 제거, 비면 "새 메모". **보관함 메모는 같은 폴더에 같은 이름의 팩 · 메모가 있으면 토스트 "같은 폴더에 같은 이름의 팩이 있어요" + 원래 이름**(10/14, packs.md PACK-NAME-03과 같은 기준, AppShell이 `isNameTaken`을 넘김). 가방 안 메모는 검사 없음. 바뀌었으면 바로 저장(본문 포함). 읽기 전용이면 고칠 수 없음 |
| MEMO-SCR-05 | 상태 한 줄 | § MEMO-STAT 중 하나라도 | 높이 44px 회색 칸 |
| MEMO-SCR-06 | 툴바 | 읽기 전용 아님 | § MEMO-TB. 가로 스크롤 |
| MEMO-SCR-07 | 본문 | 항상 | 자리글 "메모를 입력해보세요". 폭 최대 768px 가운데. 아래 여백 80px |
| MEMO-SCR-08 | 목차 칸 | 넓은 화면 + 제목이 하나 이상 | 오른쪽 208px 칸 "목차". 제목 1 굵게 / 2 들여쓰기 / 3 더 들여쓰기 작게. 누르면 그 제목으로 이동 |
| MEMO-SCR-09 | 올리는 중 알림 | 첨부 올리는 동안 | 본문 위 가운데 검은 알약 + 도는 아이콘 + "이미지를 첨부하고 있어요..." / "N장의 이미지를 첨부하고 있어요..." / "파일을 첨부하고 있어요..." |

### MEMO-STAT 상태 한 줄 (하나만, 위가 우선)

| ID | 상태 | 조건 | 문구 · 버튼 |
|---|---|---|---|
| MEMO-STAT-01 | ~~다른 기기 변경 "다른 기기에서 고친 내용이 있어요 · 반영"~~ | 삭제(10/14) - 받은 본문은 늘 바로 합치거나 바꿔서 켜는 곳이 없었음(§ MEMO-SYNC-03) | |
| MEMO-STAT-02 | 용량 초과 | 본문 300KB 초과 | 빨간 경고 "용량이 커서 저장이 멈췄어요. 표나 글을 조금 줄여 주세요". 줄이면 다음 저장 때 풀림 |
| MEMO-STAT-03 | 깊이 초과 | 중첩 60단계 초과 | 빨간 경고 "목록·토글이 너무 깊게 겹쳐 저장이 멈췄어요. 몇 개를 바깥으로 꺼내 주세요" |
| MEMO-STAT-04 | 함께 쓰는 중 | 가방 안 메모 + 다른 멤버가 이 메모를 열어 둠 | 사람 아이콘(브랜드색) "닉네임님과 함께 쓰는 중이에요" |
| MEMO-STAT-05 | 보관함 동기화 | 가방 안 메모 + 보관함에서 불러온 메모(`linkedLibraryPackId`) | 켜짐 "보관함 팩과 자동 동기화 중"(아이콘 브랜드색) + "끄기" / 꺼짐 "보관함 팩과 동기화 꺼짐" + "켜기". 누르면 `autoSyncEnabled` 전환 → 토스트 "보관함 팩과 자동으로 맞춰요" / "보관함 동기화를 껐어요". 읽기 전용이면 버튼 없음. 동기화 동작은 bag.md BAG-MEMO-05 |

---

## 2. MEMO-TB 툴바

- 버튼은 44px, 눌러도 편집기 포커스를 뺏지 않음. 켜진 서식은 브랜드 연한 바탕
- 상황에 따라 줄이 바뀐다(iOS 복사 · 붙여넣기 말풍선과 겹치지 않게 떠 있는 메뉴 대신)

| ID | 상황 | 버튼(왼쪽부터) |
|---|---|---|
| MEMO-TB-01 | 기본 | 체크박스 목록 · 제목(누를 때마다 본문 → 제목1 → 제목2 → 제목3 → 본문, 아이콘이 H1/H2/H3로) · 굵게 · 표 넣기(2×2, 머리 행 있음) · 링크 · 첨부(가능할 때) · ⋯ |
| MEMO-TB-02 | 글자를 고름 | 굵게 · 기울임 · 밑줄 · 취소선 · 글씨 색 · 링크 · 서식 지우기(모든 마크 제거). ⋯ 없음 |
| MEMO-TB-03 | 커서가 표 안 | 행+(아래) · 열+(오른쪽) · 행-(빨강) · 열-(빨강) · 표 메뉴 · 굵게 · ⋯ |
| MEMO-TB-04 | 첨부 버튼 | 자물쇠 없음(10/14). 끊겨 있으면 미리 막음(오프라인 모드는 허용) → 파일 고르기(여러 개, 무료는 사진만 고를 수 있음 `accept="image/*"`). 제한은 § MEMO-ATT-02. 올리는 중 도는 아이콘 + 비활성 |
| MEMO-TB-05 | 편집기 준비 전 | 빈 줄(높이만) |

---

## 3. MEMO-MORE 더보기 시트

| ID | 묶음 | 요소 | 보이는 조건 | 동작 |
|---|---|---|---|---|
| MEMO-MORE-01 | 서식 | 기울임 · 밑줄 · 취소선 · 코드 블록 | 읽기 전용 아님 | 누르면 적용하고 시트 닫힘 |
| MEMO-MORE-02 | | 문단 종류 "본문 · 제목 1 · 제목 2 · 제목 3" | 〃 | 고르면 적용 + 닫힘 |
| MEMO-MORE-03 | | 글자 크기 − 숫자 + | 〃 | 시트는 열린 채. 고른 글자(또는 지금부터 칠 글자)에만. 8 · 28에서 비활성 |
| MEMO-MORE-04 | | 글씨 색 › | 〃 | 글씨 색 시트(§ MEMO-COLOR) |
| MEMO-MORE-05 | 메모 | 맞춤법 검사(토글) "틀린 글자 아래 빨간 밑줄" | 읽기 전용 아님 | 계정 설정 `packSettings.noteSpellcheckEnabled`(기본 꺼짐, 모든 메모 공통). 토스트 "맞춤법 검사를 켰어요" / "껐어요". 바로 반영 |
| MEMO-MORE-06 | | 목차 › | 제목이 하나 이상 | 목차 시트(좁은 화면용. 누르면 그 제목으로 이동 + 닫힘) |
| MEMO-MORE-07 | | 용량 "N% 사용" | 읽기 전용 아님 | 300KB 대비. 90% 넘으면 빨강 |
| MEMO-MORE-08 | | 메모 삭제(빨강) | 읽기 전용 아님 + 삭제할 수 있는 곳 | 확인 "이 메모를 삭제할까요?" / "휴지통으로 옮겨져서 설정 > 휴지통에서 되살릴 수 있어요." · 취소 / 삭제 → § MEMO-CTX-04 |
| MEMO-MORE-09 | | 공유 | 숨김(`canShare={false}`) | 공유는 위 버튼으로만 |

### MEMO-COLOR 글씨 색

| ID | 규칙 |
|---|---|
| MEMO-COLOR-01 | 23가지 견본(6칸 격자) + 무지개 "직접 고르기"(시스템 색 고르기). 누르면 적용 + 닫힘 |
| MEMO-COLOR-02 | 아래 "기본 색으로" = 색 지우기 |
| MEMO-COLOR-03 | 견본 색 값은 예전 문서에 저장된 색과 같아야 해서 고정(편집기 `TEXT_COLORS`) |

---

## 4. MEMO-TABLE 표

| ID | 규칙 |
|---|---|
| MEMO-TABLE-01 | 넣기: 툴바 표 → 2×2, 첫 행이 머리 행. 열 너비는 손으로 끌어 조절(최소 72px) |
| MEMO-TABLE-02 | 표 안 툴바: MEMO-TB-03 |
| MEMO-TABLE-03 | 표 메뉴 시트 "표": 열 너비(좁게 · 넓게 = 지금 열 ±20px, 같게, 자동) · 칸(행 간격 보통 → 좁게 → 넓게 순환, 합치기 · 나누기, 왼쪽 · 가운데 · 오른쪽 정렬, 위에 행 · 왼쪽에 열) · 칸 색 8가지(없음 · 노랑 · 초록 · 파랑 · 분홍 · 보라 · 주황 · 회색) · 표 삭제 |
| MEMO-TABLE-04 | 토스트: "열을 좁혔어요" · "열을 넓혔어요" · "열 너비를 똑같이 맞췄어요" · "열 너비를 내용에 맞췄어요" · "행 간격: 좁게/보통/넓게" |
| MEMO-TABLE-05 | 표 삭제: 확인 "이 표를 삭제할까요?" · 취소 / 삭제. 되돌리기는 편집기 실행 취소(⌘Z)로만 |
| MEMO-TABLE-06 | 행+/열+/행-/열-는 바로 적용(확인 없음) |

---

## 5. MEMO-BLOCK 그 밖 문단 종류 (편집기 확장)

| ID | 종류 | 규칙 |
|---|---|---|
| MEMO-BLOCK-01 | 체크박스 목록 | 안에 또 체크박스(중첩) 가능. 체크는 본문에 저장(가방 진행률과 무관) |
| MEMO-BLOCK-02 | 토글(접기) | "> " 입력으로 만듦(인용구는 끔). 요약 줄 + 접히는 내용 |
| MEMO-BLOCK-03 | 코드 블록 | 더보기 · "```"로. 문법 강조, 기본 언어 plaintext, 언어 고르기 · 복사 · 접기(`isCollapsed`). 글꼴은 늘 D2코딩 |
| MEMO-BLOCK-04 | 들여쓰기 | `IndentExtension`(단축키 · 단계는 다음에 `lib/indentExtension.ts`를 읽고 채운다) |
| MEMO-BLOCK-05 | 제목 | 1~3단계. 목차에 모임(텍스트가 비면 "제목 없음") |
| MEMO-BLOCK-06 | 사진 · 파일 카드 | § MEMO-ATT |

---

## 6. MEMO-PASTE 붙여넣기 · 끌어 놓기

| ID | 규칙 |
|---|---|
| MEMO-PASTE-01 | 클립보드에 파일이 있으면(파일 목록 → 없으면 이미지 항목: 캡처 도구 · 브라우저 이미지 복사 등) 첨부로 올림(§ MEMO-ATT) |
| MEMO-PASTE-02 | 마크다운 글이면 서식으로 바꿔 넣음(표 · 제목 · 목록 · 체크 · 굵게 등). 서식 있는 HTML이 같이 오면 HTML 우선(`noteEditorMarkdownPaste`) |
| MEMO-PASTE-03 | 주소만 붙여넣으면 링크가 됨(`linkOnPaste`). 타이핑 중 자동 링크는 꺼짐(v1.2.0 같은 글이 링크가 되지 않게) |
| MEMO-PASTE-04 | 파일을 본문 위로 끌어 놓으면 놓은 자리에 첨부 |
| MEMO-PASTE-05 | 읽기 전용이면 붙여넣기 · 끌어 놓기 첨부 안 됨 |

---

## 7. MEMO-ATT 첨부 (사진 · 파일)

| ID | 규칙 |
|---|---|
| MEMO-ATT-01 | 첨부는 **본문 안 카드**로 들어감(커서 자리 또는 끌어 놓은 자리). 사진 = 이미지 카드, 그 밖 = 파일 카드(확장자 · 이름, PDF 표시) |
| MEMO-ATT-02 | **무료 회원 = 메모 첨부 없음**(10/21, 예전 사진 1장 10/14). 툴바 첨부에 자물쇠, 누르면 파일 고르기 대신 프리미엄 시트 "사진 · 파일 첨부는 프리미엄 기능이에요." 붙여넣기 · 끌어 놓기도 같음. storage.rules도 사진까지 프리미엄만(`canUpload`) |
| MEMO-ATT-03 | 이미지가 아닌 파일이 하나라도 10MB를 넘으면 "이미지가 아닌 파일은 10MB 이하만 첨부할 수 있어요"로 전부 안 올림 |
| MEMO-ATT-04 | 하나씩 차례로 올리고 실패한 것은 건너뛰고 계속(10/14). 끝나면: 다 됨 "본문에 추가했어요"(여러 개면 "N개를 본문에 추가했어요") / 일부 "N개는 추가했고 M개는 올리지 못했어요" / 모두 실패 "파일을 올리지 못했어요"(여러 개면 "N개 모두 올리지 못했어요") |
| MEMO-ATT-05 | 오프라인 모드는 data URL로 본문 안에 저장 |
| MEMO-ATT-06 | 사진 카드 누르기 → 사진 보기(본문의 모든 사진을 순서대로 넘김, **무료는 저장 버튼 · 길게 눌러 저장 없음** 10/21). 파일 카드 → **무료는 프리미엄 시트 "사진 저장 · 파일 열기는 프리미엄 기능이에요…"**(10/21), 프리미엄은 PDF면 PDF 보기(오프라인 첨부도 주소로 한 번 더 판단), 그 밖은 원래 이름으로 저장(실패 "파일을 저장하지 못했어요") |
| MEMO-ATT-07 | 예전 메모의 `images[]`(본문 밖 사진)는 열 때 본문 맨 위로 옮기고 `images`를 비워 바로 저장(한 번) |
| MEMO-ATT-11 | **HTML · SVG · XML 첨부 금지**(10/22): 형식(text/html · image/svg+xml · xhtml · xml) 또는 확장자(html · htm · xhtml · svg · xml · mht 등)면 "HTML · SVG 같은 웹 페이지 파일은 첨부할 수 없어요"로 전부 안 올림. 오프라인 모드도 같음. storage.rules `isBlockedType` 함께(`lib/uploadSafety.ts`) |
| MEMO-ATT-08 | 정리: 편집기를 닫을 때, 이번에 열어 둔 동안 본문에 있다가 사라진 첨부를 Storage에서 지움. 다른 가방 · 보관함 팩이 같은 파일을 쓰면 남김, **함께 쓰는 가방 메모 첨부는 지우지 않음**. 읽기 전용 · 오프라인 모드는 안 함(`sweepRemovedAttachments`). 닫은 뒤라 실행 취소로 되살릴 수 없음 |

---

## 8. MEMO-LINK 링크

- 코드: `components/v2/note/LinkSheet.tsx` · 시트 하나가 단계(menu · insert · shorten · custom · edit)를 바꿔 가며 쓰임

| ID | 규칙 |
|---|---|
| MEMO-LINK-01 | 툴바 링크(insert): 제목 "링크", 주소 칸(자리글 "https://", 자동 포커스) + "글자를 고른 뒤 누르면 그 글자에, 아니면 주소 그대로 넣어요." + 이미 링크 안이면 "링크 해제". "적용"(엔터): 빈 칸이면 "웹 주소를 입력해 주세요", http(s)가 없으면 앞에 https:// 붙임. 고른 글자 · 링크 안이면 그 글자에 링크, 아니면 주소를 글자로 넣음 |
| MEMO-LINK-02 | 본문 링크 누르기: 우리 짧은 · 커스텀 링크면 → 로그인 상태에서 내가 만든 링크인지 확인(`fetchLinkMeta.canEdit`) → 내 것이면 관리 메뉴, 아니면 바로 열기. 일반 링크면 → 짧은 URL 기능을 쓸 수 있으면 탭 메뉴, 아니면 바로 열기 |
| MEMO-LINK-03 | 탭 메뉴(menu): 위에 주소, "링크 열기" · "링크 해제 · 일반 글자로 바꿔요"(읽기 전용이면 없음) · "짧은 URL로 바꾸기 ›" · "커스텀 URL로 바꾸기 ›" |
| MEMO-LINK-04 | 관리 메뉴: "링크 열기" · "링크 해제" · "이름 · 주소 수정 ›" |
| MEMO-LINK-05 | 짧은 URL 만들기: "표시 이름 (선택)"(자리글 "비워 두면 링크 그대로 보여요") · 뒤로 / 저장 → 서버(shorten-url) → 본문의 원래 주소를 짧은 주소로 바꿈 + 토스트 "링크를 바꾸었어요" |
| MEMO-LINK-06 | 커스텀 URL 만들기: `{origin}/c/` + "원하는 주소"(20자) + 표시 이름 + 안내 "한글 · 영문 · 숫자 · - · _ 만, 2~20자". 주소가 비면 저장 비활성. 서버(custom-shorten-url, 프리미엄) |
| MEMO-LINK-07 | 링크 수정: 표시 이름 + "연결되는 주소"(비면 "연결될 주소를 입력해 주세요") → 서버(update-short-link) → 토스트 "링크를 수정했어요" |
| MEMO-LINK-08 | 오류는 시트 안 빨간 글(서버 문구, 없으면 "처리하지 못했어요"). 저장 중 버튼 "저장 중" |
| MEMO-LINK-09 | 화면 표시: 짧은 · 커스텀 링크는 **본문 글자는 그대로 두고** 화면에서만 표시 이름으로 바꿔 보여 줌(글자가 주소 그대로이거나 전에 바꿔 둔 자리만, 직접 다른 글로 적은 링크는 안 건드림). 이름은 캐시(`linkLabelCache`)에 두고 처음 볼 때 서버에서 받음 |
| MEMO-LINK-10 | 링크 해제 → 토스트 "링크를 해제했어요" |
| MEMO-LINK-11 | 짧은 URL 기능 사용 가능 = 계정 모드 + `isShortUrlFeatureEnabled`(계정 설정). 아니면 일반 링크는 누르면 바로 열림 |
| MEMO-LINK-12 | 앱 내부 경로 링크 차단(10/22): 주소에 `_capacitor_`가 있으면(대소문자 · % 인코딩 무시) 붙여넣기 · 링크 넣기에서 링크가 안 걸리고(TipTap `isAllowedUri`), 이미 저장된 것은 href 없이 그려지며, 누르면 안 열림(`openExternalLink`, 콘솔 경고만). Capacitor 6.2.1 CVE-2026-103922 임시 방어, `lib/linkSafety.ts` |

---

## 9. MEMO-SHARE 링크 공유

| ID | 규칙 |
|---|---|
| MEMO-SHARE-01 | 시트 "공유", 안내 "링크가 있으면 누구나 이 메모를 볼 수 있어요. 받은 사람은 '내 팩 보관함에 담기'로 가져갈 수 있어요." |
| MEMO-SHARE-02 | 열 때마다 **편집 중인 지금 내용**(제목 · 본문 · 미리보기)으로 `/api/share-pack` 스냅샷 갱신(가방 안 메모면 bagId 함께). 처음이면 토큰을 받아 메모에 저장(`publicShareToken`). 주소는 늘 같음 |
| MEMO-SHARE-03 | 링크 칸 · 열어 보기 · "링크 복사"(→ "복사됨" 2초) · "보내기"(지원 기기) · 실패 문구는 packs.md PACK-SHARE-04 · 05와 같음. 공유 창 제목 = 메모 이름(없으면 "메모") |
| MEMO-SHARE-04 | 아래 안내: 갱신 중 "지금 내용으로 갱신하는 중이에요" / "메모를 고치면 편집기를 나갈 때 링크에도 자동으로 반영돼요. 주소는 그대로예요." |
| MEMO-SHARE-05 | 자동 갱신: 이미 공유한 메모를 고친 뒤 편집기를 나갈 때(뒤로 · 화면이 사라질 때) 한 번 다시 올림. 안 고쳤거나 공유 안 한 메모 · 오프라인 모드는 요청 안 함. 실패는 조용히(다음에 시트를 열면 갱신) |

---

## 10. MEMO-SAVE 저장

| ID | 규칙 |
|---|---|
| MEMO-SAVE-01 | 본문이 바뀌면 0.6초 뒤 저장(처음 열 때 생기는 변경 한 번은 건너뜀). 읽기 전용이면 저장 안 함 |
| MEMO-SAVE-02 | 저장 전 검사: 300KB 초과 → 저장 안 하고 MEMO-STAT-02 / 깊이 초과 → MEMO-STAT-03. 화면의 글은 그대로 남아 있음 |
| MEMO-SAVE-03 | 저장 내용: 제목 · 본문 · 미리보기(120자) · `updatedAt = 지금` |
| MEMO-SAVE-04 | 바로 저장: 뒤로 · 화면이 사라질 때 · 앱이 뒤로 갈 때(visibility hidden) · pagehide · beforeunload에 대기 중 저장을 내보냄(iOS가 앱을 얼려 잃지 않게) |
| MEMO-SAVE-05 | 제목은 칸을 벗어날 때 바로 저장 |
| MEMO-SAVE-06 | 보관함 메모 → AppShell `handleSavePack`(무료 한도로 잠긴 팩이면 안 보내고 이용권 안내). 가방 안 메모 → 가방 자동저장(bag.md BAG-SAVE, 본문 분리) |

### MEMO-SYNC 다른 기기 · 함께 편집

| ID | 규칙 |
|---|---|
| MEMO-SYNC-01 | 보관함 메모: AppShell이 구독 중인 보관함 목록에서 최신본을 받아 화면에 넘김(추가 읽기 없음) |
| MEMO-SYNC-02 | 가방 안 메모: 열린 가방의 notes 구독으로 받음(bag.md BAG-SAVE-07 · 09) |
| MEMO-SYNC-03 | 받은 본문이 내 마지막 동기화본과 다를 때: **아직 올리지 않은 내 변경이 있으면**(편집기 포커스 · 자동저장 대기 중 · 화면 본문이 마지막 동기화본과 다름 중 하나) 마지막 동기화본 대비 내 변경과 상대 변경을 문단 단위로 합침(다른 문단은 둘 다 살림), 없으면 받은 본문으로 바꿈. 커서는 그 문단을 찾아 같은 자리로. (10/14 수정 - 예전에는 포커스가 없으면 통째로 바꿔 칸을 벗어난 직후 0.6초 안의 입력이 사라질 수 있었음) |
| MEMO-SYNC-04 | 제목도 받은 값으로 바꿈(지금 제목 칸에 입력 중이면 안 바꿈) |
| MEMO-SYNC-05 | 합친 결과는 예약된 자동저장이 올림(따로 쓰기 없음) |
| MEMO-SYNC-06 | 내 저장이 되돌아온 것(같은 본문)은 아무것도 안 함 |

---

## 11. MEMO-SRCH 검색으로 들어옴

| ID | 규칙 |
|---|---|
| MEMO-SRCH-01 | 검색어를 받으면 0.15초 · 0.5초 뒤 두 번 본문에서 첫 위치를 찾아 가운데로 스크롤 + 2.8초 강조 + 그 글자 선택 |
| MEMO-SRCH-02 | 대소문자 무시. 편집기 위치로 못 찾으면 화면 글자에서 다시 찾음 |

---

## 12. MEMO-NOTE 가방 안 메모 본문 분리 (요점)

- 자세한 규칙은 bag.md BAG-SAVE-07 ~ 10, 코드 `lib/bagNotesCore.ts`

| ID | 규칙 |
|---|---|
| MEMO-NOTE-01 | 가방 문서에 남는 것: 이름 · `editorPreviewText` · `searchText`(본문 글 앞 2,000자) · `attachmentUrls`(본문 + 옛 images의 첨부 주소) · `noteSeparated: true` |
| MEMO-NOTE-02 | 저장할 때 본문이 바뀐 메모만 notes에 씀. 서버에 있다고 알던 메모가 가방에서 사라졌으면 그 notes를 지움. 목록에서 바로 저장하는 경우(본문을 모름)는 지우지 않음 |
| MEMO-NOTE-03 | 본문 도착 전(`notesReady=false`)에는 편집기 대신 "메모를 불러오고 있어요", 메모 휴지통 · 보관함 저장은 막힘(bag.md BAG-MEMO-03) |
| MEMO-NOTE-04 | 오프라인 모드 · 만들기 대기 가방은 본문이 가방 안에 그대로 |
| MEMO-NOTE-05 | 서버(create-bag · 이전 스크립트)는 `splitPacksPlain`으로 같은 규칙. 본문이 JSON 문자열이어도 받음 |

---

## 확인 필요

| # | 내용 | 위치 |
|---|---|---|
| ~~1~~ | ~~메모 제목 같은 이름 검사 없음~~ → 10/14 보관함 메모 검사(MEMO-SCR-04) | |
| ~~2~~ | ~~쓰이지 않는 "다른 기기 변경 · 반영" 상태 줄~~ → 10/14 삭제(MEMO-STAT-01) | |
| ~~3~~ | ~~무료는 메모 사진도 막힘~~ → 10/14 가방과 같이 사진 1장까지(MEMO-ATT-02, storage.rules 함께) | |
| ~~4~~ | ~~포커스가 없을 때 받은 본문이 내 입력을 덮을 수 있음~~ → 10/14 올리지 않은 내 변경이 있으면 합침(MEMO-SYNC-03) | |
| ~~5~~ | ~~가방 안 메모 삭제 확인이 경로마다 다름~~ → 10/14 팩 시트에서도 같은 확인 시트(bag.md BAG-PSHEET-08) | |
| ~~6~~ | ~~여러 개 첨부 중 실패 개수를 모름~~ → 10/14 결과 개수 안내(MEMO-ATT-04) | |
| 7 | 무료 사진 1장 제한은 앱에서만 막는다(Storage 규칙은 개수를 모름). 가방 사진도 같은 방식 | `storage.rules` |
| 8 | 이 파일은 기본 lint 범위 밖이라, 넣고 돌리면 React Compiler 규칙 오류 7건이 나온다(렌더 중 ref 쓰기 4 · effect 안 setState 1 · 선언 전 사용 1 · hook에 넘긴 ref 수정 1). 10/14 전부터 있던 것. 따로 작업으로 정리 예정 | `PackNoteEditorScreen.tsx` |

## 테스트 후보 (단위, Firebase 없이)

| 대상 | ID |
|---|---|
| `checkEditorDocSizeForSave` · `checkBagSizeForSave` · `checkEditorDocDepthForSave` · `getEditorDocByteSize` | MEMO-LIM-01 ~ 03, MEMO-SAVE-02 |
| `extractPlainTextPreview`(120자 · "…") · `getEditorDocFullText`(문단 구분 공백) | MEMO-LIM-04, MEMO-NOTE-01 |
| `splitBagForSave`(바뀐 것만 · 지우기 · known=null) · `hydrateBag` · `noteSummary` · `splitPacksPlain`(문자열 본문) — ✅ 10/17 `lib/bagNotesCore.test.ts` | MEMO-NOTE-01 · 02 · 05 |
| `mergeEditorDocs`(서로 다른 문단 둘 다 살림 · 같은 문단 충돌) | MEMO-SYNC-03 |
| `migratePackImagesToDoc` · `extractDocAttachmentUrls` | MEMO-ATT-07 · 08 |
| `noteEditorMarkdownPaste` 변환(표 · 제목 · 체크) | MEMO-PASTE-02 |
| `validateCustomCode` · `validateLinkLabel` | MEMO-LIM-09, MEMO-LINK-06 |
| `isBlockedAppInternalUrl` — ✅ 10/22 `lib/linkSafety.test.ts` | MEMO-LINK-12 |
| `isBlockedUploadFile` — ✅ 10/22 `lib/uploadSafety.test.ts` | MEMO-ATT-11, BAG-ATT-11 |
