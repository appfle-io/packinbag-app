# iOS 네이티브 — native-ios.md

기준 코드: v1.6.1 웹 + iOS 1.6(Build 6, 10/16 기준 제출 전) / 스토어 1.5(Build 5). 서버 라우트(`/api/native/*` · 기기 토큰)는 `api.md` API-NAT, 알림 설정 화면(설정 > 알림)은 `settings.md`, 가방 더보기의 알림 시트는 `bag.md`, 개인 잠금 화면은 `settings.md`에서 다룬다. 이 문서는 **웹 화면 ↔ 네이티브 다리, 위젯 · 잠금화면 · 단축어 · 푸시 · 링크가 어떻게 이어지는지**를 적는다.

- 앱 구조: `capacitor.config.ts` `server.url = https://packinbag.seeuson.com`(웹 화면을 불러옴). 웹을 배포하면 앱 화면도 바뀌고, 네이티브(Swift)를 바꾸면 스토어 새 빌드가 필요
- 웹 쪽: `lib/v2/nativeBridge.ts`(플러그인 `PackInBagNative`), `lib/v2/bagReminders.ts`(로컬 알림 · 누름 · 링크), `lib/v2/serverPush.ts`, `lib/v2/biometric.ts`, `lib/v2/appBridge.ts` · `components/AppBridge.tsx`, `lib/nativeSummary.ts`, `lib/haptics.ts`, `components/v2/bag/sheets/LiveActivitySheet.tsx`
- 서버: `app/api/native/*`, `lib/nativeDeviceServer.ts`, `app/.well-known/apple-app-site-association`
- Cloud Functions(서울 `asia-northeast3`): `functions/src/index.ts` · `bagEvents.ts` · `live.ts` · `devices.ts` · `apns.ts`, 비밀 `APNS_KEY_P8`(Secret Manager)
- Swift: `ios/App/App/AppDelegate.swift`(MainViewController · `PackInBagNativePlugin` · `PIBPush` · 단축어 · Spotlight), `ios/App/Shared/`(앱 · 위젯 공통: `PIBShared.swift` · `PIBActivity.swift` · `PIBIntents.swift`), `ios/App/PackInBagWidget/`(위젯 · 실시간 현황 화면 · 글꼴). 기획 · 진행 기록은 `docs/packinbag_ios_native_plan.md`

---

## 0. NAT-AVAIL 쓸 수 있는 곳

| ID | 규칙 |
|---|---|
| NAT-AVAIL-01 | 웹 쪽 네이티브 호출은 모두 "플러그인이 있을 때만"(`Capacitor.isNativePlatform()` + `isPluginAvailable`). 웹 · PC · 포터블 · 플러그인이 없는 옛 앱(스토어 1.3)에서는 아무것도 하지 않고 조용히 넘어간다 |
| NAT-AVAIL-02 | 플러그인 목록은 `capacitor.config.ts` `includePlugins`(app · haptics · local-notifications · push-notifications · splash-screen · status-bar · social-login). 새 npm 플러그인은 여기에도 넣어야 `npx cap sync ios`가 넣는다. RevenueCat은 빠져 있음(무료 출시, premium.md) |
| NAT-AVAIL-03 | 빌드별: 1.5 = 로컬 알림 · 위젯 · 잠금화면 · 단축어 · 서버 푸시 / 1.6 = Face ID · 잠금화면 글자색 · 완료 항목 숨기기 · 위젯 열 수 · Siri/Spotlight · 유니버설 링크. 1.6 옵션을 1.5 앱에 보내면 무시된다 |
| NAT-AVAIL-04 | 위젯 · 잠금화면 위젯 iOS 17 이상, 실시간 현황 16.2 이상(잠금화면에서 체크는 17), Spotlight 색인 18 이상. 앱 자체는 15.6 |

---

## 1. NAT-SESSION 기기 연결 (웹 → 네이티브)

| ID | 규칙 |
|---|---|
| NAT-SESSION-01 | 로그인 확인 · 가입 흐름이 끝난 뒤(`loading` · `authBusy` 아님) `syncNativeSession(user, 오프라인 모드)`를 부른다. 로그인 복원 전 잠깐 user가 null인 때는 건너뜀(켤 때마다 토큰을 새로 받지 않게) |
| NAT-SESSION-02 | 로그인 상태 + 계정 모드: 네이티브에 같은 uid 토큰이 이미 있으면 그대로. 없거나 다르면 `POST /api/native/device-token`(Firebase 토큰)으로 새 기기 토큰을 받아 `setSession({ uid, token, apiBase: 지금 주소 })` → App Group에 저장, 위젯 · 단축어가 이 토큰으로 서버를 부른다 |
| NAT-SESSION-03 | 로그아웃 · 오프라인 모드: `clearSession()` → 네이티브가 서버에서 그 토큰도 지운다. 위젯은 로그인 안내로 |
| NAT-SESSION-04 | 여러 번 불려도 앞의 것이 끝난 뒤 차례로(겹쳐 토큰을 두 번 받지 않게). 실패는 콘솔 "[팩인백] 위젯 연결 실패"만 |
| NAT-SESSION-05 | 탈퇴: `delete-account-data`가 `deviceTokens`를 지우고, Auth 계정 삭제 트리거 `onUserDeleted`도 그 uid 기기 토큰을 모두 지운다(api.md API-AUTH-05) |

## 2. NAT-SUM 가방 요약 (`lib/nativeSummary.ts`)

| ID | 규칙 |
|---|---|
| NAT-SUM-01 | 만드는 곳 둘: 앱이 열려 있으면 웹(`pushNativeSummary`, 가방 · 보관함 · 고정 · 보관 목록이 바뀌고 1.2초 뒤), 앱이 닫혀 있으면 서버(`GET /api/native/summary`). 모양은 같다 |
| NAT-SUM-02 | 넣는 것: 체크리스트 팩의 **체크 아이템만**(메모 팩 · 글 아이템 · 폴더 빼고, 메모 본문은 절대 안 넣음). 가방 30개 · 팩당 아이템 80개 · 글자 80자 |
| NAT-SUM-03 | 가방: 내가 휴지통에 넣은 것 · 보관함 가방 · 개인 잠금한 가방은 뺀다. 고정한 가방이 먼저(`pinned: true`), 그다음 최근 체크(`lastCheckedAt`, 없으면 `updatedAt`) 순 |
| NAT-SUM-04 | 팩: 미분류가 맨 앞(`inbox: true`), 빈 미분류는 뺌. 체크 아이템이 없는 팩도 넣는다(단축어 "가방에 추가"에서 고를 수 있게). 개인 잠금한 팩, 잠근 보관함 팩을 불러온 팩은 뺀다 |
| NAT-SUM-05 | 보관함 팩(`library`, 1.6 검색용): 웹만 넣는다(서버 요약에는 없음 → 네이티브는 마지막 받은 목록 유지). 휴지통 · 빠른팩 · 올리기 대기 · 폴더 · 잠근 팩 빼고 최근 100개, 메모는 이름만(`kind: "note"`) |
| NAT-SUM-06 | 같은 내용이면 다시 보내지 않는다(가방 목록 + 보관함 JSON 비교). 저장이 실패하면 다음에 다시 |
| NAT-SUM-07 | 개인 잠금 설정이 바뀌면(AuthProvider → `setNativeSummaryLocks`) 바로 다시 보낸다 |
| NAT-SUM-08 | 잠금화면에 띄우기 직전에는 지금 화면의 가방을 요약에 곧바로 반영한다(1.2초 묶음을 기다리지 않음) |

---

## 3. NAT-WID 홈 화면 · 잠금화면 위젯 (Swift)

| ID | 규칙 |
|---|---|
| NAT-WID-01 | 크기: 작게 · 중간 · 크게 + 잠금화면 위젯(원형 · 한 줄 · 사각) |
| NAT-WID-02 | 길게 눌러 편집: 가방(곧 출발 D-7 이내 · 고정한 가방 · 최근 쓴 가방 묶음 + 검색) → 팩(그 가방 팩, 맨 위 "가방 전체"). 팩을 비우거나 예전 가방 팩이 남아 있으면 가방 전체 |
| NAT-WID-03 | 편집 항목: 배경(시스템 · 라이트 · 다크) · 글꼴(기본 · 프리텐다드 · 지마켓 산스 · 개구 · D2코딩) · 글자 크기 · 열 수(1.6, 1열 · 2열, 기본 2열 — 작게는 1열 고정). 투명도는 없음(10/11 제거) |
| NAT-WID-04 | 보이는 것: 팩 이름 · n/m · 체크 아이템(글 아이템 없음). 줄 수는 위젯 높이 · 글자 크기로 자동. 챙긴 것은 항상 아래로(앱 설정과 무관). "외 N개" 줄 없음(1.6). 체크 아이템이 없는 팩이면 "체크할 아이템이 없어요" |
| NAT-WID-05 | 가방 전체: 팩 순서대로(미분류 먼저) 아이템을 잇고, 체크는 그 아이템의 원래 팩으로 |
| NAT-WID-06 | 위젯에서 체크: 누르면 바로 취소선 + 아래로(위젯 확장에서 `POST /api/native/toggle-item`). 못 보낸 체크는 쌓아 두었다 다음에 보내고, 서버가 거절하면 되돌린다. 휴지통 가방 · 잠긴 가방 · 멤버 아님은 서버가 거절(API-NAT-04) |
| NAT-WID-07 | 맨 아래 줄: "14시 05분에 새로고침"(다른 날이면 "10/9 14시 05분") + ↻(서버 요약 받기). 시각 = 요약을 받은 때(위젯 체크로는 안 바뀜) |
| NAT-WID-08 | 자동 새로고침: 1시간 넘게 지난 요약만 서버에서(안전망, `PIB.staleAfter`, 10/17 30분 → 1시간 — 새 빌드부터), 자정에 D-Day 다시 그림. 다른 멤버 변경은 조용한 푸시(NAT-PUSH-06)로 |
| NAT-WID-09 | 누르면 그 가방이 열린다(`packinbag://bag/{id}`, NAT-LINK-02) |
| NAT-WID-10 | 로그아웃 · 다른 계정: 요약이 지워져 예전 계정 내용이 안 보인다 |
| NAT-WID-11 | 글꼴: 앱 글꼴은 woff2라 iOS가 못 써서 위젯에 TTF/OTF를 따로 넣는다(`ios/App/PackInBagWidget/Fonts/`). 없으면 시스템 글꼴 |

---

## 4. NAT-LIVE 잠금화면에 띄우기 (실시간 현황, `LiveActivitySheet`)

- 진입: 가방 더보기 > 챙길 때 > 잠금화면에 띄우기(iOS 앱 + 플러그인 있을 때만 줄이 보임, bag.md)
- 닫기: 시트 공통(shell.md SHELL-SHEET)

| ID | 요소 | 보이는 조건 | 동작 · 문구 |
|---|---|---|---|
| NAT-LIVE-01 | 미리 보기 | 항상(스크롤해도 맨 위에 붙음) | 실제 잠금화면 카드와 같은 모양(배경화면 흉내 위 시계 + 카드: 제목 · 옆 글 · n/m 또는 "다 챙겼어요" · 진행 막대 · 2열 2줄 최대 4개 · "외 N개 · N시 NN분에 새로고침" · ↻). 고르는 즉시 바뀜. 팩이 없으면 "띄울 팩이 없어요" |
| NAT-LIVE-02 | 잠근 가방 안내 | 개인 잠금한 가방 | "잠근 가방은 잠금화면에 띄울 수 없어요. 가방 잠금을 풀면 띄울 수 있어요." + 띄우기 흐림 |
| NAT-LIVE-03 | 꺼짐 안내 | 아이폰 설정에서 실시간 현황이 꺼짐 | "실시간 현황이 꺼져 있어요. 아이폰 설정 > 팩인백 > 실시간 현황을 켜 주세요." + 띄우기 흐림 |
| NAT-LIVE-04 | 팩 칩 | 체크 아이템이 있는 팩이 하나 이상 | 맨 앞 "전체"(packId `*`, 기본) + 팩들(미분류는 "미분류"). 이 가방이 이미 떠 있으면 떠 있는 팩이 골라진 채. 없으면 "체크 아이템이 있는 팩이 없어요." |
| NAT-LIVE-05 | 완료된 항목 보이기 | | 토글(기본 켬). 끄면 챙긴 아이템은 잠금화면에서 빠짐(1.6) |
| NAT-LIVE-06 | 배경 | | 시스템 · 라이트 · 다크 · 직접. 직접이면 색 6개(딥그린 · 블랙 · 화이트 · 네이비 · 테라코타 · 머스터드) + 더 고르기(iOS 색 고르기 창, 옛 빌드면 "앱을 최신 버전으로 업데이트하면 색을 자유롭게 고를 수 있어요") + 불투명도 0~100%(5% 단위) |
| NAT-LIVE-07 | 글자 | | 색: 자동(배경 밝기에 맞춤) · 흰색 · 검정 · 직접(6개 + 더 고르기, 1.6) / 글꼴 5개 / 크기 작게 · 보통 · 크게 |
| NAT-LIVE-08 | 안내 글 | | "잠금화면에서 바로 체크할 수 있어요. iOS 규칙으로 최대 8시간 보이고, 다 챙기면 내려가요. 계속 띄워 두려면 단축어 앱 > 자동화에 '잠금화면 다시 띄우기'를 하루 세 번(예: 0시 · 8시 · 16시) 걸어 두세요. …불투명도가 조금 덜 비쳐 보일 수 있어요." |
| NAT-LIVE-09 | [잠금화면에 띄우기] / [이 설정으로 다시 띄우기] | 이 가방이 떠 있으면 아래 문구 | 요약을 먼저 반영하고 띄움 → "잠금화면에 띄웠어요" + 시트 닫힘. 실패 → 오류 문구 또는 "잠금화면에 띄우지 못했어요". 한 번에 하나만 뜬다(다른 가방이 떠 있으면 바뀜) |
| NAT-LIVE-10 | [잠금화면에서 내리기] | 무엇이든 떠 있을 때 | "잠금화면에서 내렸어요" + 닫힘 |

- 데이터: 꾸미기는 이 기기 localStorage `pib_live_activity_style`(배경 · 글꼴 · 크기 · 색 · 불투명도 · 글자색 · 완료 항목). 서버에는 실시간 현황 토큰만(NAT-PUSH-07)
- 잠금화면 동작(Swift): 아이템 2열 2줄(최대 4개) · "외 N개 · 시각" 한 줄(iOS가 카드를 160pt로 자름). 잠금화면에서 체크 · ↻. 다 챙겨도 바로 내리지 않고 `doneAt`을 적은 뒤 5분 지나 다음 갱신 때 내린다(끝난 화면은 다시 풀 수 없어서). 다이내믹 아일랜드는 항상 검은 바탕
- 단축어 "잠금화면 다시 띄우기": 같은 설정으로 내렸다 새로 띄움(8시간 제한은 띄운 때부터라). 없거나 다 챙긴 건 안 띄움
- 미리 보기 값(여백 18/14 · 색 · 글자 배율 0.88/1/1.14)은 `PackInBagWidgetLiveActivity.swift` · `PIBStyle.swift`와 같아야 한다. 하나를 바꾸면 같이

---

## 5. NAT-SC 단축어 · Siri · Spotlight (App Intents)

| ID | 단축어 | 동작 |
|---|---|---|
| NAT-SC-01 | 빠른팩에 입력 | 화면 위 입력창 → 앱을 열지 않고 빠른팩 끝에(줄마다 하나, 최대 20줄 · 200자, `POST /api/native/quick-add`). 끊겼으면 App Group에 쌓아 두고 다음에 |
| NAT-SC-02 | 팩인백 새로고침 | 서버 요약을 받아 위젯 · 실시간 현황을 바로 다시 그림. 자동화(매일 아침 등)로도 |
| NAT-SC-03 | 가방에 추가 | 가방(필수, 위젯 편집과 같은 묶음 · 검색) → 팩(선택, 비우면 미분류 — 없으면 맨 앞에 새로, 팩 10개면 거절) → 내용(`POST /api/native/add-item`) |
| NAT-SC-04 | 잠금화면 다시 띄우기 | NAT-LIVE 참고 |
| NAT-SC-05 | 검색(1.6) | 가방 · 가방 속 팩(부제 = 가방 이름) · 보관함 팩을 Spotlight에 색인(`IndexedEntity`, iOS 18+). 요약 저장 · 조용한 푸시 뒤 다시 색인(id · 이름이 바뀌면 바로, 부제만이면 30분에 한 번), 로그아웃 때 지움. 개인 잠금한 것은 요약에서 이미 빠짐 |
| NAT-SC-06 | 검색 결과 열기 | 가방 → 그 가방, 가방 속 팩 → 그 가방 + 그 팩으로 스크롤, 보관함 팩 → 팩 탭 + 그 팩(NAT-LINK-02) |

- 앱을 설치하면 단축어 앱에 바로 보인다(App Shortcuts). 위젯 · 단축어 서버 호출은 기기 토큰 인증(하루 800회, api.md API-NAT-01)

---

## 6. NAT-NOTI 로컬 알림 (D-Day · 반복, `lib/v2/bagReminders.ts`)

설정 화면(가방 더보기 > 알림)은 bag.md. 여기서는 예약 규칙만.

| ID | 규칙 |
|---|---|
| NAT-NOTI-01 | 설정은 가방이 아니라 내 계정 `UserProfile.bagReminders[bagId]`(`ddayOffsets` · `ddayTime` · `repeatDays` · `repeatTime`). 같은 계정의 다른 아이폰 · 아이패드도 각자 이 값으로 예약. 옛 `Bag.reminderOffsets`는 안 씀 |
| NAT-NOTI-02 | 서버 없이 기기가 예약. 다른 멤버가 D-Day를 바꾸면 이 기기에서 앱을 다음에 열 때 맞춰진다 |
| NAT-NOTI-03 | D-Day: 출발일(YYYY-MM-DD)이 있을 때만. D-N(0~30)마다 `ddayTime`(기본 09:00)에 한 번. 지난 시각은 뺌. 문구 제목 = 가방 이름(**개인 잠금한 가방은 "잠근 가방"**, 10/16 — AppShell이 `nativeLockFilter`로 넘김), 본문 "D-N · 챙길 것을 미리 확인해 보세요" / 당일 "오늘이 D-Day예요. 빠진 것 없는지 확인해 보세요" |
| NAT-NOTI-04 | 반복: 요일마다 `repeatTime`(기본 07:30) 매주. 본문 "챙길 시간이에요. 체크하고 출발하세요". D-Day 없이도 된다 |
| NAT-NOTI-05 | 가까운 것부터 최대 60개만 예약(iOS 앱당 64개 한도) |
| NAT-NOTI-06 | 다시 예약: 가방 목록 · 알림 설정이 바뀌고 1.5초 뒤. 팩인백이 예약한 것(`extra.kind = pib-bag-reminder`)을 모두 지우고 다시. 내용이 같으면 건너뜀(체크할 때마다 불려도). 내가 휴지통에 넣은 가방은 빼고 넘김 |
| NAT-NOTI-07 | 권한은 알림을 처음 켤 때만 묻는다(앱 시작 때 안 물음). 권한이 없으면 지우기만 |

## 7. NAT-PUSH 서버 푸시 (Cloud Functions → APNs 직접)

| ID | 규칙 |
|---|---|
| NAT-PUSH-01 | 받는 기기: `deviceTokens/{hash}.apns = { token, env, alerts }`가 있는 문서(네이티브 `PIBPush`가 로그인 · 앱 시작 때 등록하고 `POST /api/native/push-token`으로 올림, 바뀐 것만). 보이는 알림은 `alerts: true`(알림 권한 있음) 기기만. 죽은 토큰(410 등)은 `apns`를 지운다 |
| NAT-PUSH-02 | 대상: **함께 쓰는 가방(2명 이상) · 휴지통 아님**만. 내가 한 변경은 나에게 안 보냄(누가 했는지 = 가방 `editedBy`, 모르면 활동 알림 안 보냄) |
| NAT-PUSH-03 | 활동(추가 · 체크 · 다 쌌어요): `pushQueue/{bagId}`에 **읽지 않고** 쌓고(increment · arrayUnion), 10분 칸의 첫 활동 10분 뒤 Cloud Tasks 작업(`bagPushTask`)이 보냄. 다 싼 순간은 바로. 예약이 실패한 묶음은 1시간마다 도는 `sweepBagActivity`가(20분 넘게 남은 것). 10/17 전에는 2분마다 도는 `flushBagActivity`가 조회(아무도 안 써도 하루 읽기 1,440건). 받는 사람마다 자기 활동은 빼고 "OO님이 N개 챙겼어요 (n/m)" · "N개 챙기고 M개 추가했어요" · "N개 추가했어요: 이름, 이름 외 N개" · "다 쌌어요! OO님이 마지막 아이템을 챙겼어요". 체크 해제 · 삭제 · 이름 바꾸기 · 메모 수정은 안 알림 |
| NAT-PUSH-04 | 담당 지정: 바로, 맡은 사람에게만 "OO님이 N개를 맡겼어요: 이름…" |
| NAT-PUSH-04a | 개인 잠금(10/16): 받는 사람이 그 가방을 잠갔으면(`users.privateLock`에 PIN 있고 `bags`에 그 가방) 제목을 "잠근 가방"으로, 본문에서 아이템 이름을 빼고 보낸다("OO님이 N개를 맡겼어요" · "N개 추가했어요"). 사람마다 따로 판단(`wantsPush` → `PushTarget.locked`). 팩만 잠근 것은 가리지 않는다 |
| NAT-PUSH-05 | 새 멤버: 바로, 그룹장에게만 "OO님이 가방에 참여했어요 (N명)" |
| NAT-PUSH-06 | 조용한 푸시(위젯 갱신): 함께 쓰는 가방의 팩이 바뀌면 2분 칸마다 Cloud Tasks 작업을 하나 예약(멤버는 예약할 때 값) → 2분 뒤 멤버 기기에 background 푸시 → 앱이 깨어나 서버 요약 → 위젯 · 실시간 현황. 10/17 전에는 `pushSilent/{bagId}` 표시 + 2분마다 조회. iOS가 횟수를 줄일 수 있고 강제 종료한 앱에는 안 옴 |
| NAT-PUSH-06a | 예약(`functions/src/tasks.ts`): 같은 id의 작업은 한 번만(두 번째는 task-already-exists → 무시). id = 종류 + 가방 + 시간 칸(활동 10분 · 조용한 푸시 2분 · 다 쌌어요는 그 순간). 실패하면 30초 뒤부터 두 번 더. 필요한 권한: 기본 컴퓨트 서비스 계정에 Cloud Tasks Enqueuer · 서비스 계정 사용자 |
| NAT-PUSH-07 | 실시간 현황 원격 갱신: 띄울 때 받은 토큰을 `POST /api/native/live-token`(그 가방 멤버만) → `deviceTokens.apnsLive { token, bagId, packId, env }` + **가방 문서 `liveOn: true`**(없을 때만 씀, 서버 전용 필드, 10/17). 트리거는 `liveOn`이 있는 가방만 deviceTokens를 조회(예전에는 모든 저장마다 조회 1), 띄운 기기가 하나도 없으면 표시를 지움(그 사이 가방이 바뀌었으면 안 지움). 가방 이름 · 팩이 바뀌면(**혼자 쓰는 가방도**) 그 가방을 띄운 기기에 새 화면. 팩이 사라졌거나 가방이 지워졌거나 **더 이상 멤버가 아니면** 내린다. 가방 완전 삭제 트리거 `onBagDeleted`도 내림 |
| NAT-PUSH-08 | 받는 사람 설정: `users.pushPrefs { activity, assign, member }`(없으면 켜짐) · `pushMutedBagIds`(가방 모두 끄기) · `bagPushOff[bagId]`(가방별로 끈 종류). 화면은 settings.md · bag.md |
| NAT-PUSH-09 | 권한 묻기: 공유 가방을 처음 열 때 iOS 허용 창 한 번(`pib_push_asked_v1`). 거절하면 "알림을 허용하지 않아 함께 쓰는 사람 소식을 받지 않아요. 설정 > 알림에서 바꿀 수 있어요", 이미 꺼져 있으면 한 번만 "알림이 꺼져 있어 … 아이폰 설정 > 팩인백 > 알림에서 켤 수 있어요" |
| NAT-PUSH-10 | 앱을 보는 중에는 배너를 띄우지 않는다(`presentationOptions: []`) |
| NAT-PUSH-11 | 테스트 알림: 호출형 `sendTestPush` → 5초 뒤 내 기기들에 "팩인백 · 알림이 잘 도착했어요"(문구 · 결과는 settings.md SET-PUSH) |

---

## 8. NAT-LINK 링크 · 누르면 열기

| ID | 규칙 |
|---|---|
| NAT-LINK-01 | 한 곳에서 받는다(`onBagNotificationTap`, AppShell이 구독): 로컬 알림 누름(`extra.bagId`) · 서버 푸시 누름(`data.bagId`) · `appUrlOpen` · 앱을 켤 때 받은 주소(`getLaunchUrl`, 처음 한 번) |
| NAT-LINK-02 | `packinbag://bag/{id}`(`?pack={packId}`) → 그 가방을 열고(열려 있던 팩 닫음) 팩이면 그 팩으로 스크롤. `packinbag://library/{id}` → 팩 탭 + 그 보관함 팩. id는 영문 · 숫자 · `_` · `-`만 |
| NAT-LINK-03 | 가방 목록이 아직 안 왔으면(앱이 꺼져 있다 열림) 올 때까지 기다렸다 연다. 15초 지나면 포기 |
| NAT-LINK-04 | 같은 누름이 두 길로 오면 1.5초 안 한 번만 |
| NAT-LINK-05 | 유니버설 링크(1.6): `https://packinbag.seeuson.com/…`를 같은 경로의 `packinbag://open?to=`로 바꿔 처리. AASA는 `/?invite=*` · `/v/*`만(짧은 URL은 다른 사이트로 가는 링크라 뺌, API-MISC-03) |
| NAT-LINK-06 | `packinbag://open?to={경로}` → 앱 안에서 그 경로로 이동(이 사이트 안 경로만 `isSafeAppPath`: `/`로 시작 · `//` 아님 · `\` 없음 · 500자 미만). 같은 주소는 15초 안 한 번, 앱을 켤 때 받은 주소는 세션에 한 번(되풀이 새로고침 방지) |

### NAT-BRIDGE 공유 링크 브리지 (웹, `lib/v2/appBridge.ts` · `components/AppBridge.tsx`)
| ID | 연 곳 | 동작 |
|---|---|---|
| NAT-BRIDGE-01 | 아이폰 앱 안 브라우저(카톡 등) | 바로 팩인백 앱 열기 시도(`packinbag://open?to=`) + 카드 "팩인백 앱에서 여는 중이에요 · 앱이 없으면 앱스토어로 이동해요". 2.2초 안 화면을 안 떠나면 앱스토어 |
| NAT-BRIDGE-02 | 아이폰 사파리 | 자동으로 열지 않고(앱이 없으면 오류 창) 카드 "팩인백 앱에서 바로 참여해요 · 앱이 있으면 로그인 없이 그 가방으로 들어가요" + [앱에서 열기] [앱 받기] |
| NAT-BRIDGE-03 | 안드로이드 앱 안 브라우저 | 기본 브라우저로(카톡 `kakaotalk://web/openExternal`, 그 밖 `intent://`) |
| NAT-BRIDGE-04 | PC · 보통 브라우저 · 팩인백 앱 안 | 아무것도 안 함 |
| NAT-BRIDGE-05 | 자동 시도는 같은 주소에서 한 번(sessionStorage `pib_bridge_tried:…`). 쓰는 곳: `/v`의 초대 링크, 첫 화면 `/?invite=코드` |

---

## 9. NAT-ETC 그 밖

| ID | 규칙 |
|---|---|
| NAT-ETC-01 | Face ID · Touch ID(1.6): `biometricInfo` → 쓸 수 있는지 · 종류, `authenticateBiometric({ reason })` → 성공 여부(취소 · 실패 · "PIN 입력"은 false). 결과는 처음 한 번 기억. 쓸 수 없으면 PIN만(settings.md 잠금) |
| NAT-ETC-02 | 햅틱: 체크 · 해제 가볍게(`tapHaptic`), 다 쌌을 때 성공(`successHaptic`). 웹 · PC는 아무것도 안 함 |
| NAT-ETC-03 | 시작 화면(네이티브): 0.8초, 흰 바탕, 로고는 가운데 404pt 고정(웹 로고 104pt와 크기 맞춤) |
| NAT-ETC-04 | 화면 켜두기는 웹 Wake Lock(bag.md). iOS 앱 웹뷰에서 안 되면 keep-awake 플러그인이 필요(Xcode 단계) |

---

## 확인 필요

| # | 내용 | 위치 |
|---|---|---|
| ~~1~~ ✅ 10/16 가림(NAT-NOTI-03 · NAT-PUSH-04a) | ~~개인 잠금한 가방도 알림 · 푸시 제목에 가방 이름이 그대로~~ | `lib/v2/bagReminders.ts` · `functions/src/bagEvents.ts` |
| ~~2~~ ✅ 10/16 주석 고침 | ~~`lib/haptics.ts` 주석 "미설치"~~ | `lib/haptics.ts` |
| 3 | → 그대로 둠(10/16). 실시간 현황은 한 기기에 하나만 뜨고, 다른 가방이 떠 있어도 시트에 안내가 없다 | `LiveActivitySheet` |

## 테스트 후보 (단위, Firebase 없이)

| 대상 | ID |
|---|---|
| `planBagNotifications`(지난 시각 빼기 · 0~30 범위 · 같은 요일 지난 시각이면 다음 주 · 60개 · 가까운 순 · 잠근 가방 제목) · `reminderSummary`(매일 · 평일 · 주말 · 요일 나열) | NAT-NOTI-03~05 |
| `buildNativeSummary`(휴지통 · 보관 · 잠금 제외 · 고정 먼저 · 미분류 먼저 · 빈 미분류 제외 · 30/80/80 자르기) · `buildNativeLibrary` | NAT-SUM-02~05 |
| `isSafeAppPath` · `externalBrowserUrl` · `detectBridgeEnv`(UA별) | NAT-LINK-06 · NAT-BRIDGE |
| Functions `diffBag` · `activityBody`(자기 활동 빼기 · 다 쌌어요 · 문구 4종) · `liveState`(가방 전체 · 미분류 먼저 · 5개) | NAT-PUSH-03 · 07 |
