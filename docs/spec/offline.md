# 연결 흐름 · 오프라인 — offline.md

기준 코드: v1.6.1 + 10/15 수정(확인 필요 10건 반영). 로그인 화면의 끊김 화면 · 앱을 켤 때 판단은 `auth.md`(AUTH-NET · AUTH-BOOT), 설정의 오프라인 데이터 가져오기 줄 · 시트 문구는 `settings.md`(SET-DATA-02 · 03 · SET-IMP), Firestore 멈춤 자동 복구 화면 · 탭바 · 넓은 화면은 `shell.md`에서 다룬다.

핵심: 인터넷이 되든 안 되든(폐쇄망 포함) 같은 앱 · 같은 데이터를 끊김 없이 이어서 쓴다.
- 원칙 1. 로그인 세션이 있으면 언제나 **계정 모드**. 끊기면 Firestore 캐시로 계속 쓰고, 연결되면 알아서 올린다. 오프라인 모드로 빠지지 않는다
- 원칙 2. 세션이 없을 때만 **오프라인 모드**(이 기기 저장). 나중에 로그인하면 계정으로 옮긴다
- 원칙 3. 인터넷이 꼭 필요한 기능만 막고, 누르기 전에 이유를 알린다

- 연결 판단: `lib/v2/connectivity.ts`(useConnectivity · recheckConnectivity · RECONNECTED_EVENT) · `lib/networkUtils.ts` `checkIsOnline` · `isElectronApp`
- 상태 줄: `components/v2/shell/ConnectionBar.tsx`, 막기: `components/v2/shell/useOnlineGuard.ts`
- 만들기 대기: `lib/v2/pendingCreates.ts`(+ AppShell `createPendingBag` · `openNewPack` · `flushPendingCreates`)
- 오프라인 모드 저장소: `lib/localBagsService.ts`, 모드 전환: `AuthProvider` `startOfflineMode` · `exitOfflineMode` · `switchToOnlineMode`
- 옮기기(합치기): `lib/offlineImportService.ts` · `components/v2/settings/OfflineImportSheet.tsx`(mode merge · settings)
- Firestore 멈춤 복구: `lib/v2/firestoreRecovery.ts`(shell.md)

---

## 0. 데이터

| 대상 | 키 | 쓰임 |
|---|---|---|
| 이 기기(localStorage) | `pib_offline_mode` | 오프라인 모드로 쓰는 중 표시 |
| 이 기기 | `pib_offline_bags` · `pib_offline_library_packs` · `pib_offline_profile`(예전 `pib_offline_trashed_*`는 읽을 때 합침) | 오프라인 모드 데이터(가방 · 보관함 · 프로필). 휴지통은 같은 목록 안 `trashedByOwnerAt` · `trashedAt` |
| 이 기기 | `pib_pending_creates:{uid}` { bags[{bag, ownerProfile, blocked?}] · packs[{pack, blocked?}] } | 계정 모드에서 끊겼을 때 만든 새 가방 · 팩(만들기 대기) |
| 이 기기 | `pib_imported_offline_ids` | 계정으로 옮긴 오프라인 항목 id(다시 안 옮기게) |
| 이 기기(sessionStorage) | `pib_offline_import_notified` | 합치기 시트를 이번 세션에 띄웠는지 |
| 메모리 | 연결 상태 `unknown` · `online` · `offline` | 앱 전체 공통 하나 |

### 한도 · 상수

| ID | 규칙 | 값 | 코드 |
|---|---|---|---|
| OFF-LIM-01 | 끊긴 동안 다시 확인 | 5초마다 | `OFFLINE_INTERVAL_MS` |
| OFF-LIM-02 | 연결된 동안 다시 확인 | 30초마다(탭이 숨겨지면 멈추고 보이면 바로) | `ONLINE_INTERVAL_MS` |
| OFF-LIM-03 | 확인 요청 제한 시간 | 기본 2초(앱 시작 · 로그인 화면 "다시 확인"은 1.5초) | `recheckConnectivity(timeoutMs)` |
| OFF-LIM-04 | 오프라인 모드 고정 uid | `local-offline-user` | `OFFLINE_USER_UID` |

---

## 1. OFF-NET 연결 판단

| ID | 규칙 |
|---|---|
| OFF-NET-01 | 포터블: 메인 프로세스 IPC(`electronAPI.checkInternet`, 실제 HTTPS 확인). 웹 · iOS 앱: `https://packinbag.seeuson.com`에 HEAD(no-cors, 캐시 없음). 응답이 오면 online, 실패 · 시간 초과면 offline |
| OFF-NET-02 | 브라우저의 `navigator.onLine` · online/offline 이벤트는 **신호로만** 쓴다(폐쇄망을 못 알아채고, iOS 웹뷰는 늦게 바뀜). offline 이벤트는 바로 offline으로, online 이벤트는 다시 확인 |
| OFF-NET-03 | 확인 전(`unknown`)에는 대부분 online처럼 다룸. 앱 시작 · 로그인 화면만 결과를 기다림 |
| OFF-NET-04 | 겹쳐 불러도 확인은 한 번만(진행 중인 확인을 같이 기다림) |
| OFF-NET-05 | offline → online으로 바뀌는 순간: Firestore 네트워크 다시 켜기(`enableNetwork`, **이 한 곳에서만**) + `pib:reconnected` 이벤트(만들기 대기 올리기 · "다시 연결됐어요" 토스트가 들음) |
| OFF-NET-06 | 서버 호출이 네트워크 오류로 실패하면 `reportNetworkFailure()` → 주기를 기다리지 않고 바로 다시 확인 |
| OFF-NET-07 | 다른 코드는 `navigator.onLine`을 보지 않고 이 판단만 쓴다(10/15 메모로 가방 만들기 · 새 폴더도 맞춤) |

---

## 2. OFF-BAR 상태 줄

- 코드: `ConnectionBar`(AppShell 맨 위, 좁은 · 넓은 화면 공통). 로그인 전에는 없음. 모양은 화면 위 한 줄 안내 공통(높이 44 · 아이콘 16 · 한 줄 글 · 누르면 펼침)

| ID | 상태 | 줄 |
|---|---|---|
| OFF-BAR-01 | 계정 모드 + 끊김 | 회색 바탕 + 구름 끔 아이콘 + "연결이 끊겨 저장된 내용을 보고 있어요" ▾ → 누르면 "체크·수정·새 가방은 이 기기에 저장해 두었다가 다시 연결되면 자동으로 올라가요. AI·사진 올리기·공유·초대는 연결된 뒤에 쓸 수 있어요." 닫기 없음 |
| OFF-BAR-02 | 계정 모드 + 다시 연결 | 줄이 사라지고 토스트 "다시 연결됐어요. 바뀐 내용을 맞추고 있어요" |
| OFF-BAR-03 | 오프라인 모드 + 연결됨 | 연한 브랜드 바탕 + 와이파이 아이콘 + "인터넷에 연결됐어요" ▾(→ "로그인하면 이 기기에서 만든 가방과 팩을 계정으로 옮길 수 있어요. 다른 기기에서도 이어서 쓸 수 있어요.") + "로그인"(→ OFF-MODE-05) + 닫기(이번 실행만) |
| OFF-BAR-04 | 오프라인 모드 + 끊김 | 아무것도 안 띄움(폐쇄망에서 쓰는 중) |

---

## 3. OFF-GUARD 인터넷이 필요한 기능 막기

- 코드: `useOnlineGuard().guard(fn, { localOk })`. 끊겨 있으면 fn을 부르지 않고 토스트 **"인터넷에 연결되면 쓸 수 있어요"**. 확인 전(unknown)은 막지 않음
- `localOk`: 오프라인 모드에서는 연결 없이 되는 기능(사진 · 파일 첨부 — 이 기기에 data URL로 저장)

| ID | 막는 것(계정 모드에서 끊겼을 때) | 위치 |
|---|---|---|
| OFF-GUARD-01 | AI(가져오기 · 빠진 것 확인 · 날씨 · 메모로 가방 만들기 · 팩으로 나눠 담기) | bag.md · home.md |
| OFF-GUARD-02 | 사진 · 파일 첨부(오프라인 모드는 허용) | bag.md · memo.md |
| OFF-GUARD-03 | 가방 참여(코드 · 링크) · 초대 · 공유 링크(가방 `/v` · 팩 `/p`) · 메모 공유 | share.md |
| OFF-GUARD-04 | 계정 연동 · 프리미엄 · 내가 만든 URL · 공지 · 문의 · 테스트 알림 | settings.md SET-SUB-05 |
| OFF-GUARD-05 | 비밀번호 바꾸기 · 회원 탈퇴(프로필 화면에서 흐리게 보이고 누르면 안내) | settings.md SET-PROF-08 · 11 |

---

## 4. OFF-ACC 계정 모드에서 끊겼을 때

| ID | 규칙 |
|---|---|
| OFF-ACC-01 | 읽기 · 체크 · 수정 · 삭제 · 휴지통은 Firestore 캐시(IndexedDB)로 그대로 되고, 연결되면 SDK가 올림. 오프라인 모드로 바뀌지 않음 |
| OFF-ACC-02 | 새 가방 · 새 팩(+ 메모)은 서버 API로만 만들 수 있어서(규칙 create false) **만들기 대기**로 → § OFF-PEND |
| OFF-ACC-03 | 공유 가방 저장은 트랜잭션이 실패하면 통째 저장으로 대신(캐시에 바로 반영, 연결되면 전송) — bag.md 자동저장 |
| OFF-ACC-04 | 개인 잠금 설정 쓰기는 기다리지 않음(화면에 바로, 연결되면 올라감 — SET-LOCK-09) |

### OFF-PEND 만들기 대기

| ID | 규칙 |
|---|---|
| OFF-PEND-01 | 언제: 계정 모드 + 연결 판단이 offline일 때 새 가방(`openNewBag`) · 메모로 가방 만들기(`openNewBagFromNote`) · 새 팩 · 메모(`openNewPack`) · 새 폴더(`handleCreateFolder`, 토스트 "폴더를 만들었어요. 인터넷에 연결되면 계정에 올라가요")를 누름. 또는 서버 호출이 네트워크 오류로 실패했을 때(그때 연결 다시 확인). 10/15 전에는 메모로 가방 만들기 · 새 폴더만 `navigator.onLine`을 보고 오프라인 모드 저장소에 들어갔다 |
| OFF-PEND-02 | 바로 만든 것처럼 열고 편집 그대로. 토스트 "가방을 만들었어요. 인터넷에 연결되면 계정에 올라가요" / "팩을 만들었어요. 인터넷에 연결되면 계정에 올라가요" |
| OFF-PEND-03 | 목록 · 캐러셀 · 팩 탭 줄에 "올리기 대기" 배지(서버 목록 + 대기 중인 것, 서버에 이미 있는 id는 뺌 `withPending`) |
| OFF-PEND-04 | 대기 중 수정: `saveBagRemote` · `saveLibraryPackRemote`가 서버 대신 대기 목록에 저장. 대기 가방을 지우면 대기 목록에서만 빠짐(토스트 "가방을 지웠어요" / "팩을 지웠어요") |
| OFF-PEND-05 | 올리기: 앱을 켤 때(연결돼 있으면)와 다시 연결될 때 `flushPendingCreates`. 가방 → 팩 순서로 하나씩, **같은 id로** 서버에 만듦(바꿔 끼울 것 없음). 만드는 사이에 고친 가방 · 팩은 만든 뒤 한 번 더 저장(팩은 10/15부터). 결과 토스트 "끊겨 있는 동안 만든 N개를 계정에 올렸어요" |
| OFF-PEND-06 | 네트워크 오류("Failed to fetch" · "Load failed" · "NetworkError…" 문구만, 10/15 — 예전에는 TypeError면 모두)면 그 자리에서 멈추고 다음 연결 때 다시. 무료 개수 초과면 그 항목에 `blocked`를 적고 남겨 두고 다음 것 계속 + 프리미엄 시트는 **그 항목 처음 한 번만**(10/15, 다시 시도는 계속). 그 밖 오류는 콘솔만 남기고 그 항목은 남김 |
| OFF-PEND-07 | 겹쳐 불러도 한 번만 돈다. 서버(create-bag)는 같은 id가 이미 내 것이면 그대로 돌려줘서 재시도해도 두 번 안 생김 |
| OFF-PEND-08 | 대기는 계정(uid)별로 이 기기에만. 다른 기기에서는 안 보임 |

---

## 5. OFF-MODE 오프라인 모드 (로그인 없이 이 기기 저장)

| ID | 규칙 |
|---|---|
| OFF-MODE-01 | 들어가는 길: 앱을 켤 때 세션 없음 + 끊김 · 폐쇄망(모든 플랫폼, AUTH-BOOT-04) / 로그인 화면 끊김 화면의 "오프라인 모드로 시작" / 주소 `?offline=true` / 지난번에 오프라인 모드로 쓰다 끈 경우(`pib_offline_mode`) |
| OFF-MODE-02 | 가짜 사용자(`local-offline-user`, "오프라인 사용자")와 로컬 프로필로 연다. 프로필은 `role: master` · 구매함으로 만들어 **모든 로컬 기능이 무제한**. Firestore는 구독하지 않음(폐쇄망 캐시의 "문서 없음"이 로컬 프로필을 덮어 닉네임 화면으로 튀던 문제) |
| OFF-MODE-03 | 저장: 가방 · 보관함 · 프로필 모두 localStorage. 사진 · 파일 첨부는 data URL로 문서 안에. 메모 본문도 가방 안에 그대로(notes로 나누지 않음) |
| OFF-MODE-04 | 화면에서 빠지는 것: 알림 종 · 프리미엄 · AI 줄 · 내가 만든 URL · 지원(공지 · FAQ · 문의) · 잠금 · 서버 푸시 · 관리자 · 팩 고정 · 순서 · 공유. 프로필은 "오프라인" 배지(SET-SCR-02) |
| OFF-MODE-05 | 계정으로 바꾸기: 상태 줄 "로그인"(OFF-BAR-03) · 설정 "온라인 계정으로 전환"(SET-DATA-02) → `switchToOnlineMode`: 새로고침 없이 그 자리에서. 이 기기에 로그인 세션이 남아 있으면 바로 그 계정, 없으면 로그인 화면. 이 기기 오프라인 데이터는 남음 → 로그인 뒤 § OFF-MERGE |
| OFF-MODE-06 | 끝내기: 설정 · 프로필 "오프라인 모드 종료"(확인 없음) → 로그인 화면. 이 기기 데이터는 남아서 다음에 오프라인 모드로 다시 들어오면 그대로 |
| OFF-MODE-07 | 데이터 초기화(설정)는 이 기기 오프라인 데이터 전부(SET-ACC-06) |
| OFF-MODE-09 | 휴지통: 30일이 지난 가방 · 팩은 앱을 열 때 이 기기에서 완전히 지움(10/15, 계정 모드와 같은 기준 · 실행당 한 번) |
| OFF-MODE-10 | 이 기기 저장이 실패하면(localStorage 용량 약 5MB 초과 등) 토스트 "이 기기 저장 공간이 부족해 저장하지 못했어요. 사진을 줄이거나 백업 파일로 내보낸 뒤 정리해 주세요"(10초에 한 번, `pib:local-save-failed`, 10/15. 백업 파일에는 10/20부터 사진이 안 들어감). 만들기 대기 저장 실패도 같음 |
| OFF-MODE-08 | 로그인 세션이 생기는 순간(onAuthStateChanged) 오프라인 표시를 지우고 계정 모드가 이김 |

### OFF-PORT 포터블(Electron) 차이

| ID | 규칙 |
|---|---|
| OFF-PORT-01 | 연결 판단은 메인 프로세스 IPC(OFF-NET-01) |
| OFF-PORT-02 | Google · Apple 로그인 · 연동 버튼 없음(이메일 · 게스트만, AUTH-FORM-11) |
| OFF-PORT-03 | 웹과 같은 오프라인 모드 · 만들기 대기 · 합치기. 폐쇄망에서 세션 없이 켜면 바로 오프라인 모드 |
| OFF-PORT-04 | iOS 앱은 서버 주소(server.url) 구조라 폐쇄망에서 **처음 실행**은 안 됨(쓰던 중 끊김은 위 흐름대로) — 알려진 한계 |

### OFF-DEMO 체험 모드 (2026-10-18)

- 코드: `lib/demoMode.ts`(판정 · 문구 · 시작하기) · `lib/demoSeed.ts`(시작 데이터). /about 소개 페이지 안에서 로그인 없이 써 보는 모드. 오프라인 모드(OFF-MODE) 위에 얹는다

| ID | 규칙 |
|---|---|
| OFF-DEMO-01 | 들어가는 길: 주소 `?demo=1`만. 이 탭(sessionStorage `pib_demo_mode`) 안에서만 유지되고, 다음 방문에 저절로 켜지지 않는다. `?demo=0`이면 표시를 지운다(새 탭이 sessionStorage를 복사해도 풀리게) |
| OFF-DEMO-02 | 이 브라우저에 로그인 세션이 있어도 **무시**하고 체험 화면을 보여 준다(AUTH-BOOT-00). `pib_offline_mode`는 쓰지 않는다 |
| OFF-DEMO-03 | 저장: 가방 · 보관함 · 프로필 모두 이 탭 저장소(sessionStorage) `pib_demo_*` 키(`localBagsService`가 체험이면 바꾼다). 탭을 닫으면 사라진다. 진짜 오프라인 데이터(`pib_offline_*`) · 계정은 읽지도 쓰지도 않는다. 서버 쓰기 없음(`isOfflineEnvironment`가 맨 앞에서 true) |
| OFF-DEMO-04 | 시작 데이터: 탭마다 처음 한 번 새 가입자 샘플과 같은 가방 2개 · 보관함 5개(`buildSampleData`). 닉네임 "체험 중" |
| OFF-DEMO-05 | 막힘: 오프라인 모드에서 빠지는 것(OFF-MODE-04) + `useOnlineGuard`를 거치는 기능 전부(**사진 · 파일 첨부 포함**) → 토스트 "체험에서는 쓸 수 없어요. 로그인하면 쓸 수 있어요" |
| OFF-DEMO-06 | 안내 줄(ConnectionBar, 연결 상태 대신): "체험 중이에요 · 창을 닫으면 사라져요"(누르면 "여기서 만든 가방과 팩은 이 창에만 있어요. AI · 사진 첨부 · 가족과 공유는 로그인하면 쓸 수 있어요.") + "시작하기"(새 탭 `/?demo=0`) + 닫기(이번 실행만) |
| OFF-DEMO-07 | 설정: 프로필 배지 "체험"(프로필 화면 "이 창에만 저장돼요", 계정 묶음 없음). "온라인 계정으로 전환" · "오프라인 데이터 가져오기" · 백업 내보내기 · 불러오기 · "오프라인 모드 종료" · "데이터 초기화" 숨김 → 맨 아래 "팩인백 시작하기"(새 탭) |
| OFF-DEMO-08 | 팩인백 화면은 같은 주소에서만 iframe으로 띄울 수 있다(모든 경로 `Content-Security-Policy: frame-ancestors 'self'`, next.config.ts). 다른 사이트가 띄우는 것(클릭재킹) 차단 |

---

## 6. OFF-MERGE 이 기기의 가방 · 팩을 계정으로 옮기기

- 시트: settings.md SET-IMP와 같은 `OfflineImportSheet`. 여기서는 로그인 직후 자동으로 뜨는 쪽(mode merge)과 옮기는 계산

| ID | 규칙 |
|---|---|
| OFF-MERGE-01 | 자동으로 띄우기: 계정 모드 + 게스트 아님 + 아직 안 옮긴 오프라인 항목이 1개 이상 → 세션당 한 번 "이 기기의 가방·팩 옮기기" 시트 |
| OFF-MERGE-02 | 안내: "오프라인으로 쓰던 가방 N개 · 팩 M개를 계정으로 옮길게요. 다른 기기에서도 보이고, 이 기기의 사본은 그대로 남아요." + 무료 한도 안내(무료일 때) + "나중에 하려면 설정 > 데이터 > 오프라인 데이터 가져오기에서 언제든 할 수 있어요." |
| OFF-MERGE-03 | 버튼: "N개 내 계정으로 옮기기"(진행 중 "옮기는 중") + "나중에 하기". 아직 안 옮긴 것이 처음부터 골라져 있음 |
| OFF-MERGE-04 | 대상: 이 기기의 휴지통 아닌 가방 · 보관함 항목 중 고른 것 |
| OFF-MERGE-05 | 보관함 먼저(폴더 → 팩 · 메모): 고른 항목마다 새 id(`pack_…`). 폴더 안이면 `parentId`를 새 id로 — 이번에 같이 옮기는 폴더이거나 **예전에 옮긴 폴더**(옛 id → 새 id를 이 기기 `pib_imported_offline_map`에 기록, 10/15)면 그 안으로, 아니면 맨 위. `locked: false` · `create-library-pack`으로 하나씩, **하나 올릴 때마다 "가져옴"으로 기록**(중간에 멈춰도 다시 하면 두 번 안 올라감) |
| OFF-MERGE-10 | 빠른팩(`quick-pack`): 새 팩으로 올리지 않고 **계정 빠른팩 끝에 아이템을 이어 붙임**(아이템 새 id, 계정 빠른팩이 없으면 만듦). 아이템이 없으면 "가져옴"만 기록. 10/15 — 예전에는 목록에 안 보이는 빠른팩 사본이 생겼다 |
| OFF-MERGE-11 | 사진 · 파일(data URL — 가방 · 팩 사진, 메모 본문 사진 · 파일 첨부)은 **옮기지 않는다**(`lib/offlineMediaStrip`, 10/15). 고른 것에 있으면 먼저 시트 "사진 · 파일은 옮기지 않아요" / "고른 가방 · 팩에 이 기기에만 저장된 사진 · 파일이 N개 있어요. 계정으로는 내용만 옮기고, 사진 · 파일은 이 기기의 오프라인 데이터에 그대로 남겨 두어요." + "백업 파일에도 사진 · 파일은 들어가지 않아요. 계정에서 필요하면 옮긴 뒤 가방 · 메모에 다시 첨부할 수 있어요." + "사진 · 파일 빼고 옮기기"(설정에서는 "…가져오기") · "취소". 10/20 전에는 "백업 파일 저장" 버튼이 있었지만 백업에도 사진이 빠지게 돼서(settings.md SET-BAK-11) 그 버튼은 지웠다. 결과 토스트 끝에 ". 사진 · 파일 N개는 이 기기에만 남아 있어요" |
| OFF-MERGE-06 | 가방: 새 id(`bag_…`), 나 혼자 멤버 · 그룹장, 초대코드는 서버가 새로(`create-bag`, 메모 본문은 서버가 notes로 나눔). 가방 속 팩의 `linkedLibraryPackId`는 이번에 같이 옮긴 보관함 항목이면 새 id로 |
| OFF-MERGE-07 | 무료 개수를 넘으면 그 자리에서 멈추고 나머지는 이 기기에 남김 → 토스트 "N개를 계정에 옮겼어요. M개는 무료 개수를 넘어 이 기기에 남겨 두었어요"(하나도 못 옮기면 "무료 개수를 넘어 옮기지 못했어요. 이 기기에 그대로 있어요") + 프리미엄 시트 |
| OFF-MERGE-08 | 끝나면 "가방 N개, 팩 M개를 내 계정으로 옮겼어요"(+ OFF-MERGE-11 사진 안내) / 실패 "옮기지 못했어요. 설정 > 데이터에서 다시 해 주세요" |
| OFF-MERGE-09 | 이 기기의 오프라인 데이터는 지우지 않음(사본). 다시 오프라인 모드로 들어가면 그대로 있음 |
| OFF-MERGE-12 | 다른 기기(포터블 · 오프라인 모드)의 데이터는 백업 파일로 옮긴다(10/20): 그쪽에서 설정 > 데이터 > 백업 파일 내보내기 → 앱 · 웹 계정에서 백업 파일 불러오기(settings.md SET-DATA-04 · 05 · SET-BAK). 사진 · 파일은 빠짐 |

---

## 확인 필요

| # | 내용 | 위치 |
|---|---|---|
| ~~1~~ ✅ 10/15 만들기 대기로 맞춤(OFF-PEND-01) | **계정 모드에서 끊겼을 때 "메모로 가방 만들기"와 "새 폴더"는 만들기 대기가 아니라 오프라인 모드 저장소에 들어간다.** 두 곳만 `navigator.onLine`을 보고 `saveLocalBag` · `saveLocalLibraryPack`(오프라인 모드용 localStorage)에 저장 → 계정 화면 목록에는 안 보이고(새 폴더는 아무 데서도 안 보임), 메모로 만든 가방은 토스트대로 "오프라인 데이터 가져오기"로만 옮겨짐. 또 폐쇄망(onLine은 true)에서는 서버 호출이 실패해 "생성에 실패했어요"가 뜸. 원칙 1과 다르니 만들기 대기로 맞출지 | AppShell `openNewBagFromNote` · `handleCreateFolder` |
| ~~2~~ ✅ 10/15 계정 빠른팩에 합침(OFF-MERGE-10) | **빠른팩도 옮겨진다**: 오프라인 모드 빠른팩(`quick-pack`)이 새 id + `isQuickPack`으로 계정에 올라가 목록에 안 보이는 팩이 생김(백업 복원에서 고친 것과 같은 문제). 계정 빠른팩에 아이템을 합칠지 / "빠른팩 (오프라인)" 보통 팩으로 올릴지 | `importOfflineDataToOnline` |
| ~~3~~ ✅ 10/15 사진 빼고 옮기기 + 먼저 확인 · 백업 권함(OFF-MERGE-11) | **오프라인 모드 사진 · 파일(data URL)이 그대로 계정 문서에 들어간다.** Storage에 올리지 않아 가방 · 팩 문서가 커지고(Firestore 문서 1MB 한도), 사진이 많으면 옮기기가 실패할 수 있음. 옮길 때 Storage로 올릴지 / 사진은 빼고 안내할지 | `importOfflineDataToOnline` |
| ~~4~~ ✅ 10/15 옛 id → 새 id 기록(OFF-MERGE-05) | 폴더 안 팩만 옮기고 폴더는 예전에 따로 옮긴 경우, 예전 매핑을 모르니 팩이 맨 위로 감(폴더 구조가 끊김). 옛 id → 새 id를 기록해 두면 이어 붙일 수 있음 | OFF-MERGE-05 |
| ~~5~~ ✅ 10/15 blocked 기록 · 안내는 한 번(OFF-PEND-06) | 만들기 대기 중 무료 개수를 넘은 항목은 `blocked`를 기록하지 않아, 앱을 켤 때 · 다시 연결될 때마다 다시 시도하고 프리미엄 시트가 매번 다시 뜸(FREE_LAUNCH 동안은 해당 없음) | `flushPendingCreates` |
| ~~6~~ ✅ 10/15 팩도 한 번 더 저장(OFF-PEND-05) | 만들기 대기 **팩**은 가방과 달리 "만드는 사이에 고친 내용 한 번 더 저장"이 없음 → 올리는 순간(1초 남짓) 고친 내용이 사라질 수 있음 | `flushPendingCreates` 팩 부분 |
| ~~7~~ ✅ 10/15 fetch 실패 문구만(OFF-PEND-06) | 네트워크 오류 판정이 오류 문장에 `TypeError`가 들어 있으면 모두 네트워크로 봄 → 코드 버그(TypeError)도 "다음 연결 때 다시"로 조용히 남아 영영 안 올라갈 수 있음 | `isNetworkError` |
| ~~8~~ ✅ 10/15 30일 자동 삭제(OFF-MODE-09) | 오프라인 모드 휴지통은 30일 자동 삭제가 돌지 않는다(AppShell 자동 정리가 계정 모드만). 휴지통 화면 안내는 "30일 뒤 자동 삭제" | AppShell 휴지통 자동 정리 · SET-TRASH-02 |
| ~~9~~ ✅ 10/15 실패 토스트(OFF-MODE-10) | 오프라인 모드는 localStorage 하나에 사진(data URL)까지 저장하는데, 용량(브라우저 약 5MB)을 넘으면 저장 실패가 콘솔에만 남고 화면은 저장된 것처럼 보임. 사진이 몇 장만 쌓여도 닿을 수 있음 | `localBagsService.safeSetItem` |
| ~~10~~ ✅ 10/15 함수 삭제 | `switchToOfflineMode`(계정 → 오프라인 모드)는 이제 화면에서 쓰지 않음(원칙 1, 10/4 제거). 남겨 둘지 | `AuthProvider` |
| ~~11~~ ✅ 10/15 로그인 없음 + 표시 있음이면 항상 오프라인(표시는 AuthProvider만 지움) | **웹 오프라인 모드에서 인터넷이 다시 되면 저장이 서버로 간다.** `isOfflineEnvironment()`는 로그인 없이 `pib_offline_mode`가 있어도 “포터블이 아니고 `navigator.onLine`이면” 예전 표시로 보고 **표시를 지우고 false**를 돌려준다. 그런데 가방 화면 자동저장(`useBagDocument` → `saveBagRemote` · 메모 본문 구독)은 이 판정으로 로컬 · 서버를 고르므로, 로그인 화면에서 "오프라인 모드로 시작"한 뒤 인터넷이 돌아오면 오프라인 가방 저장이 Firestore로 가려다 실패하고(로그인 없음), 다음에 앱을 켜면 오프라인 모드가 풀려 있을 수 있음. 포터블은 해당 없음. 표시는 AuthProvider만 지우고(세션이 생기면 이미 지움), 여기서는 “로그인 없음 + 표시 있음”이면 true로 고칠지 | `lib/premiumLimits.ts` `isOfflineEnvironment` |

## 테스트 후보 (단위, Firebase 없이)

| 대상 | ID |
|---|---|
| `withPending`(서버에 있는 id는 빼고 대기 먼저) · `isNetworkError` | OFF-PEND-03, OFF-PEND-06, 확인 필요 7 |
| `pendingCreates` 읽기 · 쓰기 · 지우기(가짜 localStorage, uid별 분리, 비면 키 삭제) | OFF-PEND-04 · 08 |
| `flushPendingCreates`(가짜 deps: 성공 · 네트워크 오류에서 멈춤 · 한도 초과 남김 · 만드는 사이 수정은 다시 저장 · 겹쳐 부르면 한 번) | OFF-PEND-05 ~ 07 |
| `getOfflineDataSummary` · `getImportedOfflineIds`(휴지통 제외 · 가져온 것 개수) | OFF-MERGE-01 |
| `importOfflineDataToOnline`(가짜 서버: parentId · linkedLibraryPackId 매핑 · 한도 초과 멈춤 · 하나씩 가져옴 기록) — 저장 부분을 주입받게 바꾸면 쉬움 | OFF-MERGE-05 ~ 07 |
| connectivity 상태 기계(offline → online에서만 이벤트 · 겹친 확인 한 번 · 숨김이면 예약 안 함) — `checkIsOnline` 주입 | OFF-NET-04 · 05 |
| `useOnlineGuard` 판정(끊김 · localOk + 오프라인 모드 · unknown은 통과) — 순수 함수로 빼면 쉬움 | OFF-GUARD |
| `stripPackMedia` · `stripBagMedia` · `countOfflineMedia`(images의 data URL · 메모 본문 imageAttachment/fileAttachment data URL 빼기 · 깊은 곳 노드 · https 주소는 남김 · 없으면 같은 객체) | OFF-MERGE-11 |
| `flushPendingCreates` blocked(처음만 blockedMessage, 두 번째는 조용히) · 팩 다시 저장 | OFF-PEND-05 · 06 |
