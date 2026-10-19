# 이벤트 — events.md

기준 코드: 2026-10-19(v1.7.2와 같이). 관리자 등록 화면은 `admin.md` ADM-EVT, 규칙은 `security-rules.md`(RULE-EVT), 이벤트 파일 만드는 법은 `_secrets/claude/event-guide.md`(Claude 전용, git 밖).

- 순수 함수 · 타입: `lib/events.ts`(+ `lib/events.test.ts`)
- Firestore · Storage: `lib/eventsService.ts`(`useEvents` · `loadEvents` · 관리자 쓰기)
- 화면: `components/v2/events/EventScreens.tsx`(EventsScreen · EventDetailScreen · EventSlideCard), 홈 `components/v2/home/BagCarousel.tsx` · `HomeScreenV2.tsx`, 설정 `SettingsScreenV2.tsx`

## 0. 데이터

| 대상 | 필드 | 쓰임 |
|---|---|---|
| events/{id} | `title`(30자) · `summary`(40자) · `startDate` · `endDate`("YYYY-MM-DD", 둘 다 포함) | 카드 · 목록 |
| | `coverUrl` · `coverPath` | 정사각 커버(Storage `events/{id}/cover-…`) |
| | `bodyType`(html \| image) · `bodyUrl` · `bodyPath` | 본문(Storage `events/{id}/body-…`) |
| | `buttonLabel`(12자) · `buttonUrl` | 아래 고정 버튼(선택) |
| | `published` · `createdAt` · `updatedAt` · `createdBy` | 게시 여부 · 기록 |
| 이 기기 | `pib_seen_events_v1`(본 이벤트 id, 최근 50개) | 설정 줄 빨간 점 |

| ID | 규칙 |
|---|---|
| EVT-DATA-01 | 상태(`eventStatus`): 게시 안 함 = 숨김 / 오늘 < 시작 = 예정 / 오늘 > 끝 = 끝남 / 그 밖 = 진행 중. **오늘은 기기 날짜** |
| EVT-DATA-02 | 사용자 화면은 게시한 것만 한 번 읽는다(`where published == true`, 앱 실행당 1회 캐시 + 설정 > 이벤트를 열 때 다시). 실시간 구독 없음. 오프라인 모드 · 체험은 읽지 않음 |
| EVT-DATA-03 | 진행 중 정렬: 시작일 늦은 것 먼저 / 지난 이벤트: 끝난 날 늦은 것 먼저. 예정 · 숨김은 사용자에게 안 보임 |

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
| EVT-VIEW-04 | 아래 고정: 진행 중 + 버튼이 있으면 [버튼 문구] — 앱 경로(`/…`)는 그 주소로 이동, https는 바깥 브라우저(`openExternalLink`). 끝난 이벤트는 버튼 대신 "끝난 이벤트예요 · 기간" |
| EVT-VIEW-05 | 열면 이 기기에 본 것으로 기록(`markEventSeen`) → 설정 줄 빨간 점이 꺼짐 |
| EVT-VIEW-06 | 본문 주소가 없으면 "내용을 불러오지 못했어요" |

## 확인 필요

| # | 내용 |
|---|---|
| 1 | Firebase Storage 내려받기 주소의 HTML이 iframe 안에서 그대로 보이는지(내려받기로 바뀌지 않는지) · iOS 앱(WKWebView)에서 바깥 주소 iframe이 사파리로 빠지지 않는지(QA EV-04) |
| 2 | Safari가 iframe `color-scheme`을 안쪽 `prefers-color-scheme`에 넘기는지(QA EV-05). 안 되면 본문은 기기 설정을 따름 |

## 테스트 (단위)

| 대상 | ID |
|---|---|
| `eventStatus`(시작 · 끝 포함, 숨김) · `splitEvents`(정렬 · 예정/숨김 제외) — `lib/events.test.ts` | EVT-DATA-01 · 03 |
| `eventPeriodLabel` · `eventEyebrow` · `isSafeEventLink` · `hasUnseenEvent` | EVT-LIST-03, EVT-HOME-03, EVT-VIEW-04 · 05 |
