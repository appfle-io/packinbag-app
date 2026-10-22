# 앱 틀 — shell.md

기준 코드: v1.6.1 (2026-10-16). 탭 화면 안쪽(홈 · 팩 · 설정)은 각 화면 명세(home · packs · settings), 연결 상태 줄 · 만들기 대기는 `offline.md`, 로그인 화면 · 시작 판단은 `auth.md`에서 다룬다. 이 문서는 **화면들을 담는 틀**(탭 · 넓은 화면 · 겹 화면 · 시트 · 제스처 · 단축키 · 기다리는 화면 · 공통 알림)만 적는다.

- 틀: `components/AppShell.tsx`(상태 · 화면 고르기), `components/v2/shell/*`(TabBarV2 · WideShell · BusyOverlay · FirestoreRecoveryOverlay · ConnectionBar · useOnlineGuard)
- 폭 · 단축키 · 셸 명령: `lib/v2/shell.ts`, 상세 칸 강조 · 자리: `lib/v2/openDetail.ts`
- 겹 화면 · 시트: `components/SlideScreen.tsx` · `components/SlideUpSheet.tsx` · `components/v2/ui/Sheet.tsx` · `components/v2/ui/PageStack.tsx` · `components/v2/ui/Screen.tsx`
- 제스처: `lib/useHorizontalSwipe.ts` · `lib/useSwipeBack.ts` · `lib/swipeBackRegistry.ts`, 층 순서 `lib/overlayLayer.ts`, Esc `lib/useEscapeToClose.ts`
- 공통 알림: `components/Toast.tsx` · `components/EmailVerifyBanner.tsx` · `components/InstallPrompt.tsx` · `components/SplashScreen.tsx`

---

## 0. SHELL-WIDTH 화면 폭

| ID | 폭 | 구성 | 코드 |
|---|---|---|---|
| SHELL-WIDTH-01 | 900px 미만(폰 · 아이패드 세로) | 탭 화면 1단(최대 폭 3xl · md 이상 4xl, 가운데) + 떠 있는 탭바. 가방 · 메모는 오른쪽에서 겹쳐 들어오고, 체크리스트 팩 편집은 아래에서 올라오는 시트 | `AppShell` 좁은 화면 분기 |
| SHELL-WIDTH-02 | 900px 이상 | [목록 384px \| 상세]. 목록 칸 아래에 같은 탭바 | `WIDE_QUERY` · `WideShell` |
| SHELL-WIDTH-03 | 1200px 이상 | [레일 84px \| 목록 \| 상세]. 탭바 대신 레일 | `RAIL_QUERY` |
| SHELL-WIDTH-04 | 1024px 이상 | 시트가 화면 가운데 창(SHELL-SHEET-03) | `DIALOG_QUERY` |
| SHELL-WIDTH-05 | 1024px 이상(`useIsDesktop`) | 예전 화면에서 쓰는 PC 판정. `SlideScreen desktopTransition="fade"`면 이 폭부터 밀기 대신 확대 + 흐려짐 | `lib/useIsDesktop.ts` |

- 폭은 미디어 쿼리로 본다(기기 종류가 아님). 창 폭을 바꾸면 그 자리에서 1단 ↔ 2단 ↔ 3단이 바뀐다
- 첫 화면 깜빡임: `useMediaQuery`는 `useSyncExternalStore`라 서버 렌더는 좁은 화면, 붙자마자 실제 폭

---

## 1. SHELL-TAB 탭 (팩 · 가방 · 설정)

| ID | 규칙 |
|---|---|
| SHELL-TAB-01 | 탭은 3개, 순서 팩 → 가방 → 설정(`TAB_ORDER`). 앱을 열면 항상 가방 탭(`useState("home")`) |
| SHELL-TAB-02 | 좁은 화면: 세 탭을 가로로 이은 트랙(300%)을 옮겨 보여 준다. 세 화면 모두 그려 둔다(탭을 바꿔도 스크롤 · 입력 상태 유지). 전환 280ms |
| SHELL-TAB-03 | 넓은 화면: 목록 칸에 지금 탭 화면 하나만 그린다(탭을 바꾸면 새로 그림) |
| SHELL-TAB-04 | 다른 탭으로 가는 길: 탭바 · 레일 · 좁은 화면 가로 밀기(SHELL-GES-02) · 설정 화면 `onBack`(가방 탭으로) · 공유 팩 가져오기 성공(팩 탭) · Siri/검색으로 보관함 팩 열기(팩 탭) |

### SHELL-DOCK 떠 있는 탭바 (`TabBarV2`)

| ID | 요소 | 보이는 조건 | 동작 · 문구 |
|---|---|---|---|
| SHELL-DOCK-01 | 캡슐 [팩 · 가방 · 설정] | 좁은 화면 · 2단. 홈 · 팩 탭 **여러 개 선택 중에는 숨김** | 지금 탭은 옅은 알약이 미끄러져 옮겨 가고 글자가 굵어짐(`aria-current="page"`). 아이콘 22px |
| SHELL-DOCK-02 | 검은 동그라미 + | 캡슐과 같이 | "빠른팩에 적기"(SHELL-QUICK-01, 항상 빠른 입력 시트). 폭 = 캡슐 높이 |
| SHELL-DOCK-03 | 위치 | | 부모(탭 화면 칸) 아래쪽에 겹쳐 뜬다. 목록은 탭바 뒤로 지나가고 마지막 줄은 탭바 위에서 끝난다. 탭바 옆 빈 곳은 터치가 통과(`pointer-events-none`), 탭바를 끌어도 탭이 넘어가지 않음(스와이프 영역 밖) |
| SHELL-DOCK-04 | 높이 재기 | | 그려진 높이를 부모의 `--pib-dock`에, 화면 아래에서 탭바 윗변까지를 html의 `--pib-dock-viewport`에 적는다(ResizeObserver · resize). `ScreenBody`가 `dock-pad-body` · `dock-scroll-pad`로 아래 여백 · scroll-padding에 더하고, 토스트는 `toast-lift`로 그 위에. **숫자로 박지 않는다** |
| SHELL-DOCK-05 | 글 쓰는 동안 숨김 | 터치 기기(`pointer: coarse`)에서 탭 화면 안 입력칸 · 글 칸 · contenteditable에 포커스 | 아래로 내려가며 사라지고 `inert`, `--pib-dock-viewport`는 0. 칸을 옮겨 다닐 때는 한 프레임 뒤에 다시 봐서 깜빡이지 않음 |
| SHELL-DOCK-06 | 탭바 바로 위 줄 | 팩 탭 빠른팩 줄 | 그 화면 `ScreenBody dockless` + 줄에 `dock-mb`(packs.md) |
| SHELL-DOCK-07 | 투명도 줄이기 · 다크 | | `dock-glass`(전역 CSS)가 처리 |

### SHELL-RAIL 레일 (1200px 이상, `WideShell`)

| ID | 요소 | 동작 |
|---|---|---|
| SHELL-RAIL-01 | 맨 위 로고 | 장식 |
| SHELL-RAIL-02 | 팩 · 가방 · 설정 | 탭 전환. 설정 툴팁 "설정 (⌘I)"(윈도우 Ctrl+I) |
| SHELL-RAIL-03 | 아래 빠른팩 | "빠른팩에 적기 (⌘P)". SHELL-QUICK-01과 같음 |
| SHELL-RAIL-04 | 오프라인 표시 | **오프라인 모드일 때만** 와이파이 끔 아이콘 + "오프라인"(툴팁 "오프라인 · 이 기기에만 저장돼요"). 계정 모드 끊김은 연결 상태 줄(offline.md)로 |

---

## 2. SHELL-DETAIL 넓은 화면 상세 칸

| ID | 규칙 |
|---|---|
| SHELL-DETAIL-01 | 상세 칸에는 하나만: 팩 · 메모가 열려 있으면 그것(메모는 편집기, 체크리스트 팩은 팩 편집 화면), 아니면 가방. 둘 다 없으면 빈 칸 |
| SHELL-DETAIL-02 | 빈 칸: 로고 48px + "왼쪽에서 가방이나 팩을 골라 주세요" + "새로 만들기 ⌘N · 검색 ⌘K · 빠른팩 ⌘P" + [새 가방] [새 팩] 버튼 |
| SHELL-DETAIL-03 | 가방을 고르면 열려 있던 팩 · 메모는 닫는다. 가방 위에 팩을 열었다 닫으면 가방으로 돌아온다(가방 상태는 그대로) |
| SHELL-DETAIL-04 | 새 가방은 만드는 순간 서버에 저장되고, 손대지 않고 다른 가방을 고르거나 Esc로 닫거나 새 가방을 또 만들어도 **그대로 남는다**(10/16). ~~손대지 않은 새 가방은 완전 삭제~~ |
| SHELL-DETAIL-05 | 목록 강조: 상세 칸에 열린 가방 · 팩 줄을 둥근 회색 바탕 + `aria-current`(`OpenDetailContext`). 팩이 열려 있으면 가방 강조는 끔. 좁은 화면은 강조 없음 |
| SHELL-DETAIL-06 | 설정 하위 화면(프로필 · 휴지통 · 문의 · 잠금 등 `SlideScreen`)은 설정 탭일 때 **상세 칸 안**에 열린다(`DetailPaneContext`). 이때 뒤는 어둡게 깔지 않고 앱 바탕색으로 채운다 |
| SHELL-DETAIL-07 | 넓은 화면에서 체크리스트 팩 편집은 시트가 아니라 상세 칸 화면. 다른 기기에서 고친 팩 · 메모는 열린 채로 최신본으로 바뀐다(id가 같을 때만) |

---

## 3. SHELL-STACK 겹 화면 (좁은 화면)

| ID | 화면 | 층(z) | 들어오는 쪽 · 닫기 |
|---|---|---|---|
| SHELL-STACK-01 | 가방 | 65 | 오른쪽에서. 뒤로 버튼 · 오른쪽으로 밀기(SHELL-GES-03) |
| SHELL-STACK-02 | 메모 편집기(보관함 메모) | 70 | 오른쪽에서, 폭 3xl(md 6xl). 밀기 · 뒤로 |
| SHELL-STACK-03 | 체크리스트 팩 편집 | 75 | 아래에서 올라오는 시트(`SlideUpSheet`, 높이 85vh, 뒤 `bg-scrim`). 바깥 누르기 · Esc |
| SHELL-STACK-04 | 설정 하위 화면 | 자동(부모 층 + 20) | 오른쪽에서. 밀기 · 뒤로 |
| SHELL-STACK-05 | 새 가방에서 뒤로 | | 그대로 남는다(10/16). ~~한 번도 저장하지 않은 새 가방이면 조용히 완전 삭제~~ |
| SHELL-STACK-06 | 닫히는 동안 | | 바로 사라지지 않고 닫힘 움직임(280ms, Sheet와 같은 ease-snappy)이 끝난 뒤 지운다. 그동안 내용은 마지막 값(`displayedBag` 등)으로 그린다. 뒤 어둠은 v2 토큰 `bg-scrim`(10/16, 예전 40 · 45% 고정값 · 250 · 220ms) |
| SHELL-STACK-07 | 층 순서 | | 겹 화면이 열릴 때 "지금 층"을 자식에게 물려준다(`overlayLayer`: 바탕 40, 화면 +20, 시트 +10, 팝오버 +30). 숫자를 넘긴 곳(위 표)은 그 값이 우선 |

### SHELL-PAGE 탭 안 한 단계 들어가기 (`PageStack`)
- 쓰는 곳: 팩 탭 폴더, 가방 탭 → 보관함, 설정 일부

| ID | 규칙 |
|---|---|
| SHELL-PAGE-01 | 들어갈 때 새 화면이 오른쪽에서 들어오고 아래 화면은 화면 폭의 30% 왼쪽으로 물러난다(300ms) |
| SHELL-PAGE-02 | 바로 아래 화면은 숨긴 채 계속 그려 둔다 → 돌아오면 스크롤 위치 그대로 |
| SHELL-PAGE-03 | 가려진 층은 `inert`만(포커스 · 클릭 · 보조기기 제외). 맨 위가 바뀌면 가려진 층에 남은 포커스를 푼다 |
| SHELL-PAGE-04 | 오른쪽으로 밀면 위 화면이 따라오고 아래 화면이 드러난다(SHELL-GES-01 기준). 왼쪽으로 미는 것은 바깥(탭 넘기기)에 양보 |
| SHELL-PAGE-05 | 부모가 닫기를 거절하면(stack 그대로) 120ms 뒤 제자리로 |

---

## 4. SHELL-SHEET 시트 (`components/v2/ui/Sheet.tsx`)

| ID | 규칙 |
|---|---|
| SHELL-SHEET-01 | 1024px 미만: 아래에서 올라오는 시트, 최대 높이 화면 88%(`size="tall"`이면 88% 고정), 폭 최대 xl. 위 손잡이 · 제목 줄을 끌어 96px 넘게 내리거나 빠르게(0.6px/ms) 튕기면 닫힘 |
| SHELL-SHEET-02 | 닫는 길: 끌어내리기 · 바깥(어둠) 누르기 · X · Esc |
| SHELL-SHEET-03 | 1024px 이상: 화면 가운데 창(최대 폭 lg, 최대 높이 88%), 끌어내리기 없음. 바깥 · Esc · X로 닫기 |
| SHELL-SHEET-04 | 열 때 포커스를 시트로 옮기고, 닫으면 연 버튼으로 돌려준다. `role="dialog"` · `aria-modal="true"` |
| SHELL-SHEET-05 | 아래 고정 영역(`footer`)은 본문이 스크롤돼도 보인다. 안전영역만큼 아래 여백 |
| SHELL-SHEET-06 | 시트 안에서 또 뜨는 시트는 그 위 층(+20) |
| SHELL-SHEET-07 | 열림 · 닫힘 280ms. 닫히는 동안 내용 유지 |

---

## 5. SHELL-GES 제스처 (손가락을 따라오는 가로 이동)

| ID | 규칙 | 코드 |
|---|---|---|
| SHELL-GES-01 | 공통 판정: 10px 넘게 움직였을 때 가로가 세로의 1.15배보다 크면 가로. 그때부터 세로 스크롤을 막고 손가락을 따라간다. 30% 넘게 끌었거나 그 방향으로 빠르게(0.35px/ms, 16px 이상) 튕기면 끝까지, 아니면 제자리. 반대로 튕기면(0.2px/ms 넘게) 제자리. 남은 거리는 손 뗀 속도로 | `useHorizontalSwipe` · `shouldCommit` · `settleDuration` |
| SHELL-GES-02 | 탭 넘기기(좁은 화면): 탭 트랙이 손가락을 따라옴. 첫 · 마지막 탭에서 바깥으로 밀면 25%만 따라오는 고무줄. 홈 · 팩 탭 여러 개 선택 중에는 꺼짐 | `AppShell` |
| SHELL-GES-03 | 겹 화면 뒤로(가방 · 메모 · 설정 하위): 화면 어디서나 오른쪽으로 밀면 화면과 뒤 어둠이 같이 따라옴. 닫는 함수는 안쪽 화면이 `useSwipeBack`으로 등록한 것 → `onSwipeBack` → `onBackdropClick` 순. 닫기가 막히면(저장 확인 등) 제자리로. 상세 칸 안(넓은 화면)이나 `fade` 전환이면 밀기 없음 | `SlideScreen swipeBack` |
| SHELL-GES-04 | 안쪽 우선: 안쪽 요소가 먼저 가져간 터치는 바깥이 물러난다(폴더 안 오른쪽 밀기 = 폴더 뒤로, 왼쪽 밀기 = 탭 넘기기) | `pibSwipeTaken` |
| SHELL-GES-05 | 입력칸 · 글 칸 · select · contenteditable · `[data-swipe-ignore]`에서 시작하면 무시. **화면 왼쪽 끝 24px 안**에서 시작하면 허용 | `TEXT_SELECTOR` · `EDGE_PX` |
| SHELL-GES-06 | 가로 스크롤 영역(칩 · 캐러셀 · 가방 목록)이 그 방향으로 더 넘어갈 수 있으면 그 영역이 먼저. 끝에 닿으면 바깥 제스처로 | `blockedByContent` |
| SHELL-GES-07 | 끌기가 끝난 직후 350ms 동안 클릭을 막는다(손 뗀 자리 버튼이 눌리지 않게). 두 손가락이 닿으면 제자리 | |
| SHELL-GES-08 | 터치 전용. PC 마우스로 끌어 탭을 넘기는 기능은 없다. 길게 누르기 = 오른쪽 클릭(README 공통 표기) | |
| SHELL-GES-09 | 예전 방식(`useSwipeBack`, 등록소 없는 곳): 왼쪽 끝 22px에서 시작해 80px 넘게 오른쪽으로 밀고 뗄 때 한 번에 뒤로. 세로 50px 넘게 움직이면 취소 | `lib/useSwipeBack.ts` |

---

## 6. SHELL-KEY 단축키 (넓은 화면만, `useAppShortcuts`)

맥 ⌘ / 윈도우 Ctrl(둘 다 받음). Alt · Shift가 같이 눌리면 무시, 한글 조합 중(`isComposing`)이면 무시.

| ID | 키 | 동작 | 예외 |
|---|---|---|---|
| SHELL-KEY-01 | N | 지금 탭에서 새로 만들기(가방 탭 새 가방 · 팩 탭 새 팩). 설정 탭이면 가방 탭으로 간 뒤 80ms 후 새 가방 | 웹 브라우저 탭에서는 브라우저가 먼저 가져가 안 됨(포터블은 됨) |
| SHELL-KEY-02 | K | 지금 탭 검색 열기. 설정 탭이면 가방 탭으로 가서 | |
| SHELL-KEY-03 | I | 설정 탭으로 | 메모 본문(ProseMirror · contenteditable) 안에서는 기울임이 우선 |
| SHELL-KEY-04 | P | 빠른팩(SHELL-QUICK-01) | 인쇄 대신 |
| SHELL-KEY-05 | Esc | 열린 시트 · 창(`aria-modal`)이 있으면 그쪽이 닫힘. 입력칸에 포커스가 있으면 포커스만 뺌. 그 밖에는 상세 칸 닫기(팩 · 메모 먼저, 그다음 가방 — 새 가방도 그대로 남음) | |
| SHELL-KEY-06 | 툴팁 표기 | 맥 "⌘K", 그 밖 "Ctrl+K"(`shortcutLabel`) | |
| SHELL-KEY-07 | ⌘F | 건드리지 않음(브라우저 찾기) | |

- 셸 → 탭 화면 명령: `sendShellCommand(tab, "new" | "search")` → 각 화면이 `useShellCommands`로 자기 탭 명령만 받는다
- Esc 닫기 순서(`useEscapeToClose`): 열려 있는 닫기 함수를 스택으로 쌓고 맨 위(가장 나중에 열린 것)만 부른다. capture 단계 리스너 하나라 메모 편집기 안에서도 동작. 스택에는 Esc로는 닫지 않는 칸(`useHardwareBack`, swipeBack 겹 화면)도 함께 쌓이고, Esc는 그 칸을 건너뛴다(예전과 같은 동작)

### SHELL-BACK Android 하드웨어 뒤로 가기 (2026-10-22, `lib/v2/androidBack.ts`, Android 앱만)

| ID | 규칙 |
|---|---|
| SHELL-BACK-01 | Android 앱(`isAndroidApp`)에서만 `App.addListener("backButton")` 하나를 단다(AppShell). 웹 · iOS · 포터블은 아무것도 안 함 |
| SHELL-BACK-02 | 순서: ① 닫기 스택 맨 위(시트 · 창 · 잠금 취소 · 사진/PDF 보기 · swipeBack 겹 화면 — 스와이프와 같은 닫기 함수 · 화면에 보이는 탭의 `PageStack` 한 단계(팩 폴더 · 보관함 · 설정 일부, 안 보이는 탭은 건너뜀)) ② 넓은 화면 상세 칸(팩 · 메모 먼저, 그다음 가방) ③ 가방 탭이 아니면 가방 탭으로 ④ 가방 탭이면 앱을 내림(`minimizeApp`, 종료 아님) |
| SHELL-BACK-03 | 키보드가 떠 있으면 시스템이 키보드부터 내린다(이벤트가 오지 않음) |
| SHELL-BACK-04 | 한계: 닫기 함수를 스택에 올리지 않는 화면(Esc · swipeBack 둘 다 없는 SlideScreen), 홈 · 팩 탭 여러 개 선택 모드는 ②~④로 넘어간다 → 실기기에서 확인(native-android.md 확인 필요) |

---

## 7. SHELL-QUICK 빠른팩 버튼

| ID | 규칙 |
|---|---|
| SHELL-QUICK-01 | 탭바 + · 레일 빠른팩 · ⌘P 모두 같은 함수(`openQuickAdd`): **항상 빠른 입력 시트**(`QuickAddSheet`)를 연다(10/16). 빠른팩 화면은 시트 안 "빠른팩 열기 N개" · 팩 탭 빠른팩 줄로. ~~아이템이 있으면 빠른팩 화면을 바로 열었다~~ |
| SHELL-QUICK-02 | 빠른 입력 시트에서 넣을 때마다 빠른팩 끝에 붙인다. 빠른팩이 없으면 id `quick-pack`으로 새로 만든다(무료 한도와 무관). 시트 안 "빠른팩 열기 N개"는 시트를 닫고 빠른팩을 연다. 입력 방식은 packs.md PACK-QUICK |

---

## 8. SHELL-WAIT 기다리는 화면 · 시작 화면

| ID | 화면 | 보이는 조건 | 모양 · 문구 |
|---|---|---|---|
| SHELL-WAIT-01 | 시작 화면(`SplashScreen`) | 로그인 확인 중이거나 앱을 연 지 900ms 전 | 바탕색 + 가운데 로고 104px. 380ms에 걸쳐 사라짐(층 200) |
| SHELL-WAIT-02 | 가방 만드는 중 | 새 가방 · 메모로 만들기를 서버에 쓰는 동안 | 바탕을 덮고 가운데 동그라미 + "가방을 만들고 있어요" |
| SHELL-WAIT-03 | 팩 만드는 중 | 새 팩 · 폴더를 서버에 쓰는 동안 | "팩을 만들고 있어요" |
| SHELL-WAIT-04 | 이용권 상태 바뀜 | 프리미엄 → 무료로 바뀐 순간 700ms | 문구 없는 동그라미 → 토스트 "무료 회원으로 전환되어 일부 기능이 제한돼요" |
| SHELL-WAIT-05 | 여러 가방 정리 중 | 홈 여러 개 선택 → 삭제 · 나가기 | 뒤를 어둡게 + 카드 "가방을 정리하고 있어요" · "N / 전체 · %" · 진행 막대. 끝나고 150ms 뒤 사라짐 |
| SHELL-WAIT-06 | Firestore 멈춤 | `lib/v2/firestoreRecovery` 감지 | "다시 연결하고 있어요" → 자동 새로고침. 2분 안 또 멈추면 "연결을 다시 맞추지 못했어요 · 새로고침하면 이어서 쓸 수 있어요. 저장해 둔 내용은 그대로예요" + [새로고침](offline.md) |

- 기다리는 층(02~06)은 층 210, 숨길 때도 그려 두고 투명도로만(사라지는 모습이 보이게)

---

## 9. SHELL-NOTE 공통 알림

### SHELL-TOAST 토스트 (`components/Toast.tsx`)
| ID | 규칙 |
|---|---|
| SHELL-TOAST-01 | 화면 아래 검은 띠 하나(최대 폭 md, 층 300). 한 번에 하나, 새 토스트가 오면 바로 바뀜 |
| SHELL-TOAST-02 | 보이는 시간 1.7초, 버튼("되돌리기" · "실행취소")이 있으면 4초, `durationMs`가 있으면 그 값. 끝나기 220ms 전부터 흐려짐 |
| SHELL-TOAST-03 | 버튼을 누르면 동작 후 바로 닫힘. 버튼이 없으면 터치가 통과 |
| SHELL-TOAST-04 | 떠 있는 탭바 위로 올라간다(`toast-lift` = `--pib-dock-viewport`) |

### SHELL-BAR 화면 위 한 줄
| ID | 줄 | 보이는 조건 | 문구 · 동작 |
|---|---|---|---|
| SHELL-BAR-01 | 연결 상태 줄 | offline.md OFF-BAR | |
| SHELL-BAR-02 | 이메일 인증 줄 | 계정 모드 · 이메일 · 비밀번호 계정 · 인증 안 함(게스트 · Google · Apple 제외) | 메일 아이콘 + "이메일 인증이 아직 안 됐어요" + [다시 받기](보내는 중 "보내는 중", 성공 "인증 메일을 다시 보냈어요", 실패 "잠시 후 다시 시도해주세요") + ✕("하루 동안 숨기기"). ✕는 **계정마다 이 기기에서 24시간** 숨김(`pib_email_verify_snooze:{uid}`, 10/16 — 예전에는 이번 실행만). 다음 날 다시 보인다 |
| SHELL-BAR-03 | 위치 | 좁은 화면: 탭 화면 위. 넓은 화면: 목록 칸 위 | |

### SHELL-INSTALL 홈 화면에 추가 안내 (`InstallPrompt`)
| ID | 규칙 |
|---|---|
| SHELL-INSTALL-01 | 아이폰 · 아이패드 웹 브라우저에서만(iOS 앱 · 이미 설치한 PWA 제외). 좁은 화면은 탭 화면 아래, 넓은 화면은 **목록 칸 맨 아래**(탭바 아래, `WideShell footer`, 10/16). 로그인 화면에도 보인다 |
| SHELL-INSTALL-02 | 문구: 사파리 "공유 버튼 → 홈 화면에 추가하면 앱처럼 쓸 수 있어요" / 카톡 · 네이버 · 인스타 · 라인 · 페이스북 안 브라우저 "Safari에서 열면 앱처럼 설치할 수 있어요 (오른쪽 위 메뉴 → Safari로 열기)" |
| SHELL-INSTALL-03 | ✕를 누르면 7일 동안 안 보임(`packinbag-install-prompt-dismissed-at`) |
| SHELL-INSTALL-04 | 홈 · 팩 탭 여러 개 선택 중에는 숨김 |

---

## 10. SHELL-START 앱을 열 때 틀이 하는 일

순서 · 조건만. 각 기능의 상세는 해당 명세.

| ID | 일 | 조건 | 상세 |
|---|---|---|---|
| SHELL-START-01 | 주소의 `?invite=` · `?join=` · `?openBag=` · `?importPack=`를 sessionStorage에 옮기고 주소에서 지움 | 처음 한 번 | 로그인 · 가입 뒤에도 이어서 처리(share.md) |
| SHELL-START-02 | 보류한 일 실행: 공유 팩 가져오기 → 초대 참여(성공하면 그 가방 열기) → 가방 열기(멤버일 때만, 아니면 "가방에 접근할 권한이 없어요.") | 로그인 + 닉네임 있음, 한 번만 | |
| SHELL-START-03 | 시작 공지 시트 | 계정 모드, 프로필 도착 뒤 한 번 | settings.md · 안 본 공지(기간 안 · 다시 보지 않기 안 함)를 하나씩 |
| SHELL-START-04 | 오프라인 데이터 옮기기 시트 | 계정 모드 · 게스트 아님 · 옮기지 않은 오프라인 데이터 있음, 세션당 한 번 | offline.md OFF-MERGE |
| SHELL-START-05 | 만들기 대기 올리기 | 계정 모드, 연결돼 있으면 바로 + 다시 연결될 때마다 | offline.md OFF-PEND |
| SHELL-START-06 | 휴지통 30일 지난 것 지우기 | 계정 모드는 내가 그룹장인 가방 · 내 팩, 실행당 항목마다 한 번 시도. 오프라인 모드는 이 기기 | settings.md · premium.md |
| SHELL-START-07 | 공유 가방 내 프로필 스냅샷 맞추기 | 닉네임 · 캐릭터가 가방의 `memberProfiles`와 다르면 그 가방만, 같은 프로필 값에서 가방마다 한 번 | share.md |
| SHELL-START-08 | 잠김 맞추기 | 이용권 상태가 바뀐 순간 + 화면 계산과 서버 `locked`가 다를 때(3초 기다림, 같은 차이는 한 번) | premium.md PREM-LOCK |
| SHELL-START-09 | iOS: 기기 토큰 · 요약 · 알림 예약 · 알림 누름 | 앱 | native-ios.md |

---

## 확인 필요

| # | 내용 | 위치 |
|---|---|---|
| ~~1~~ ✅ 10/16 항상 빠른 입력 시트(SHELL-QUICK-01) | ~~빠른팩에 아이템이 있으면 빠른팩 화면을 연다~~ | `AppShell openQuickAdd` |
| ~~2~~ ✅ 10/16 새 가방은 만들자마자 저장되고 지우지 않음(SHELL-DETAIL-04 · STACK-05 · KEY-05) | ~~손대지 않은 새 가방을 Esc · 뒤로 · 다른 가방 고르기로 완전 삭제~~ | `AppShell handleBackFromEditor` |
| ~~3~~ ✅ 10/16 넓은 화면에도(SHELL-INSTALL-01) | ~~홈 화면에 추가 안내가 넓은 화면에 없다~~ | `WideShell` |
| ~~4~~ ✅ 10/16 ✕는 하루 동안 숨김(SHELL-BAR-02) | ~~이메일 인증 줄 ✕가 이번 실행에서만~~ | `EmailVerifyBanner` |
| 5 | → Android 개발 때(10/16 결정). 안드로이드 뒤로가기 버튼 처리가 없다 — 알려진 한계 | `AppShell` |
| ~~6~~ ✅ 10/16 `bg-scrim` · 280ms · ease-snappy로 맞춤(SHELL-STACK-03 · 06) | ~~겹 화면 · 팩 편집 시트 뒤 어둠 · 움직임이 Sheet와 다름~~ | `components/SlideUpSheet.tsx` · `SlideScreen.tsx` |

## 테스트 후보 (단위)

| 대상 | ID |
|---|---|
| `shouldCommit`(30% 경계 · 빠른 튕김 · 반대 방향 튕김 · dx 0) · `settleDuration`(최소 · 최대) | SHELL-GES-01 |
| `shortcutLabel`(맥 · 윈도우) | SHELL-KEY-06 |
| `useAppShortcuts` 키 매핑(조합 중 · Alt · Shift 무시, 메모 안 ⌘I 무시, 시트 열림 시 Esc 무시) — jsdom | SHELL-KEY-01~05 |
| `shouldShowInstallHint`(iOS · PWA · Capacitor · 7일) | SHELL-INSTALL-01 · 03 |
