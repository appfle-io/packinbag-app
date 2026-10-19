# 이벤트 — events.md

기준 코드: 2026-10-19(v1.7.2와 같이). 관리자 등록 화면은 `admin.md` ADM-EVT, 규칙은 `security-rules.md`(RULE-EVT), 이벤트 파일 만드는 법은 `_secrets/claude/event-guide.md`(Claude 전용, git 밖).

- 순수 함수 · 타입: `lib/events.ts`(+ `lib/events.test.ts`)
- Firestore · Storage: `lib/eventsService.ts`(`useEvents` · `loadEvents` · 관리자 쓰기)
- 화면: `components/v2/events/EventScreens.tsx`(EventsScreen · EventDetailScreen · EventSlideCard), 홈 `components/v2/home/BagCarousel.tsx` · `HomeScreenV2.tsx`, 설정 `SettingsScreenV2.tsx`

## 0. 데이터

| 대상 | 필드 | 쓰임 |
|---|---|---|
| events/{id} | `title`(30자) · `summary`(40자) · `startDate` · `endDate`("YYYY-MM-DD", 둘 다 포함. `endDate` ""는 끝나는 날 없음) | 카드 · 목록 |
| | `coverUrl` · `coverPath` | 정사각 커버(Storage `events/{id}/cover-…`) |
| | `bodyType`(html \| image) · `bodyUrl` · `bodyPath` | 본문(Storage `events/{id}/body-…`) |
| | `buttonLabel`(12자) · `links`(이름 20자 + 주소, 최대 5개, 10/20) · `buttonUrl`(예전 하나짜리, 지금은 첫 링크와 같은 값) | 아래 고정 버튼(선택) |
| | `published` · `createdAt` · `updatedAt` · `createdBy` | 게시 여부 · 기록 |
| | `slug`(10/20, 영문 소문자 · 숫자 · - 3~40자) | 공개 페이지 주소 끝(EVT-WEB). 없으면 문서 id |
| 이 기기 | `pib_seen_events_v1`(본 이벤트 id, 최근 50개) | 설정 줄 빨간 점 |

| ID | 규칙 |
|---|---|
| EVT-DATA-01 | 상태(`eventStatus`): 게시 안 함 = 숨김 / 오늘 < 시작 = 예정 / 오늘 > 끝 = 끝남 / 그 밖 = 진행 중. **오늘은 기기 날짜** |
| EVT-DATA-02 | 사용자 화면은 게시한 것만 한 번 읽는다(`where published == true`, 앱 실행당 1회 캐시 + 설정 > 이벤트를 열 때 다시). 실시간 구독 없음. 오프라인 모드 · 체험은 읽지 않음 |
| EVT-DATA-03 | 진행 중 정렬: 시작일 늦은 것 먼저 / 지난 이벤트: 끝난 날 늦은 것 먼저. 예정 · 숨김은 사용자에게 안 보임 |
| EVT-DATA-04 | (2026-10-20) 끝나는 날 없음(`endDate` "" 또는 없음): 시작일부터 계속 진행 중(끝남이 되지 않음). 기간 표기 "10월 20일(화)부터", 홈 카드 작은 줄 "이벤트 · 진행 중". 닫을 때는 관리자가 끝나는 날을 넣거나(지난 이벤트로) 게시를 끈다(숨김). 선착순 · 재고 소진처럼 끝을 미리 모르는 이벤트용 |

## 1. EVT-HOME 홈 캐러셀

| ID | 규칙 |
|---|---|
| EVT-HOME-01 | 진행 중 이벤트를 **가방 카드 뒤에** 최대 3장(`EVENT_CAROUSEL_MAX`). 자동 넘김 · 점 · 화살표는 가방과 같이 돈다 |
| EVT-HOME-02 | 폴더 칩 "전체"에서만(폴더를 고르면 안 보임). 검색 중 · 가방이 하나도 없을 때(첫 가방 안내 화면)는 캐러셀 자체가 없음 |
| EVT-HOME-03 | 카드: 가방 카드와 같은 틀 · 높이. 왼쪽 위 작은 줄 "이벤트 · 10월 31일까지"(끝나는 날이 오늘이면 "이벤트 · 오늘까지", brand) + 제목(2줄) + 한 줄 설명(2줄), 오른쪽 정사각 커버(없으면 선물 아이콘). 누르면 EVT-VIEW. 길게 누르기 없음 |

## 2. EVT-LIST 설정 > 이벤트

| ID | 규칙 |
|---|---|
| EVT-LIST-01 | 설정 > 지원 맨 위 "이벤트" ›. 오른쪽: 진행 중인데 이 기기에서 안 본 것이 있으면 빨간 점("새 이벤트") / 아니면 "진행 중 N" / 없으면 비움. 오프라인 모드에는 지원 묶음 자체가 없음. 인터넷 필요(`guard`) |
| EVT-LIST-02 | 하위 화면 "이벤트": 열 때마다 서버에서 다시 받음(그동안 "불러오고 있어요"). 묶음 "진행 중 N"(없으면 "지금은 진행 중인 이벤트가 없어요") → "지난 이벤트 N"(있을 때만) |
| EVT-LIST-03 | 줄: 커버 56px + 제목 + 기간 "11월 1일(일) ~ 11월 30일(월)"(올해가 아니면 연도). 지난 이벤트는 커버 흐리게 · 제목 회색 · "끝남" 배지. 누르면 EVT-VIEW |

## 3. EVT-VIEW 이벤트 보기

| ID | 규칙 |
|---|---|
| EVT-VIEW-01 | 머리 "이벤트" + 뒤로 ‹(오른쪽 밀기로도 닫힘 — 본문 칸 위에서는 칸이 손가락을 먹어 머리에서만) |
| EVT-VIEW-02 | HTML 본문: Storage 주소를 **`sandbox=""` iframe**으로 화면 남은 높이를 채워 띄움(칸 안에서 세로 스크롤). 스크립트 · 링크 · 폼 · 팝업 모두 동작 안 함. 앱 화면 모드가 라이트 · 다크로 정해져 있으면 iframe `color-scheme`으로 넘김(본문은 `prefers-color-scheme`로 색을 바꿈), 시스템이면 지정 안 함 |
| EVT-VIEW-03 | 이미지 본문: 가로 꽉 찬 긴 이미지 한 장(최대 폭 2xl, 모서리 14), 세로 스크롤 |
| EVT-VIEW-04 | 아래 고정: 진행 중 + 버튼 문구 + 링크가 1개 이상이면 [버튼 문구] — 누르면 EVT-VIEW-07. 끝난 이벤트는 버튼 대신 "끝난 이벤트예요 · 기간" |
| EVT-VIEW-05 | 열면 이 기기에 본 것으로 기록(`markEventSeen`) → 설정 줄 빨간 점이 꺼짐 |
| EVT-VIEW-06 | 본문 주소가 없으면 "내용을 불러오지 못했어요" |
| EVT-VIEW-07 | (10/20) 버튼 누르기(`eventLinks` — `links`, 없으면 예전 `buttonUrl` 하나, 이름이 없으면 도메인, `/…` · https 아닌 주소는 뺀다): **1개 + 앱 경로** → 확인 없이 그 주소로 / **1개 + 바깥** → 확인 시트 "외부로 이동합니다" + "이름 · 도메인"(같으면 하나) + [취소] [이동] / **2개 이상** → 시트 "외부로 이동합니다" · "어디로 갈까요?" + 줄(이름 굵게 · 도메인 · ›), 줄을 누르면 바로 열림. 바깥은 `openExternalLink`(iOS 앱은 사파리). 시트는 이벤트 보기 화면 안에 둔다(층) |

## 4. EVT-WEB 공개 페이지 (10/20)

- 화면 `app/about/events/[key]/page.tsx` · `EventLinksButton.tsx` · `events.module.css`, 짧은 주소 `app/e/[key]/page.tsx`, 서버 읽기 `lib/eventsServer.ts`(Admin SDK)

| ID | 규칙 |
|---|---|
| EVT-WEB-01 | 주소 `/about/events/{key}`. key = `slug`(먼저) 또는 문서 id. 게시한 것만, 아니면 "없거나 내려간 이벤트예요" + [팩인백 둘러보기]. 1분 캐시(`revalidate 60`), 로그인 없음. 상태는 **한국 날짜**(`kstDateKey`) 기준. 예정이면 "곧 열리는 이벤트예요 · 기간" |
| EVT-WEB-02 | 메타: 제목 "{제목} · 팩인백 이벤트", 설명 = 한 줄 설명, OG 이미지 = 커버(800²) → 카톡 · 문자 미리보기 카드. canonical은 `https://packinbag.seeuson.com/about/events/{key}` |
| EVT-WEB-03 | 화면: 위 줄(로고 "팩인백 이벤트" → /about, [팩인백 써 보기] → /about) + 본문(앱과 같은 `sandbox=""` iframe, 남은 높이를 채움, 늘 라이트) + 아래 버튼(EVT-VIEW-07과 같은 규칙: 1개 바깥은 "외부로 이동합니다" 확인, 2개 이상은 "어디로 갈까요?", Esc · 바깥으로 닫기). 끝난 이벤트는 "끝난 이벤트예요 · 기간" |
| EVT-WEB-04 | 짧은 주소 `/e/{key}` → `/about/events/{key}`로 옮김(307). 나눌 때는 이 주소(관리자 [복사], ADM-EVT-11) |
| EVT-WEB-05 | 소개 페이지(/about) 맨 위 줄: 오늘 진행 중인 이벤트가 있으면 연두 띠 "[이벤트] 제목 · 한 줄 설명 (외 N개) ›" → 첫 이벤트 공개 페이지. 없으면 안 보임. /about은 5분 캐시(`revalidate 300`) |
| EVT-WEB-06 | 읽기 비용: 페이지 캐시 주기마다 한 번(공개 페이지 1~2회, /about은 게시한 이벤트 수만큼). 못 읽으면 없는 것으로 보고 소개 페이지는 그대로 |
| EVT-WEB-07 | 관리자에서 저장 · 삭제하면 `POST /api/admin/revalidate-events`(마스터만, keys = 그 이벤트의 id · 새 slug · 예전 slug)로 /about · 공개 페이지 캐시를 바로 비움(10/20 — 예전 제목 · 주소가 캐시 동안 보이던 문제). 실패해도 1분 · 5분 뒤에는 바뀜. **본문 HTML 안 제목은 파일에 적힌 것**이라 관리자 제목을 바꿔도 안 바뀜(파일을 다시 올려야 함). 앱 홈 캐러셀은 앱을 다시 열면 새로 받음(EVT-DATA-02) |

## 확인 필요

| # | 내용 |
|---|---|
| 1 | Firebase Storage 내려받기 주소의 HTML이 iframe 안에서 그대로 보이는지(내려받기로 바뀌지 않는지) · iOS 앱(WKWebView)에서 바깥 주소 iframe이 사파리로 빠지지 않는지(QA EV-04) |
| 2 | Safari가 iframe `color-scheme`을 안쪽 `prefers-color-scheme`에 넘기는지(QA EV-05). 안 되면 본문은 기기 설정을 따름 |

## 테스트 (단위)

| 대상 | ID |
|---|---|
| `eventStatus`(시작 · 끝 포함, 숨김, 끝나는 날 없음) · `splitEvents`(정렬 · 예정/숨김 제외) — `lib/events.test.ts` | EVT-DATA-01 · 03 · 04 |
| `eventPeriodLabel` · `eventEyebrow` · `isSafeEventLink` · `hasUnseenEvent` | EVT-LIST-03, EVT-HOME-03, EVT-VIEW-04 · 05 |
| `eventLinks` · `linkHost`(예전 buttonUrl 읽기 · 안전하지 않은 주소 빼기 · 이름 없으면 도메인) | EVT-VIEW-07 |
