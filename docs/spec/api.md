# 서버 라우트 — api.md

기준 코드: v1.6.1 (2026-10-16). `app/api/**/route.ts` 46개 + 리다이렉트 `app/s/[code]` · `app/c/[code]` + `app/.well-known/apple-app-site-association`.
화면 쪽 흐름은 각 화면 명세(bag · home · packs · memo · share · premium · auth · offline)에, 규칙은 `security-rules.md`, 위젯 · 푸시 · Cloud Functions는 `native-ios.md`, 관리자 화면은 `admin.md`에서 다룬다. 이 문서는 **라우트가 무엇을 검사하고 무엇을 쓰는지**만 적는다.

- 공통 헬퍼: `lib/premiumServer.ts`(`verifyRequestUser` · `isPremiumServer`), `lib/aiQuotaServer.ts`(AI 하루 횟수), `lib/shortLinkRateLimit.ts`, `lib/nativeDeviceServer.ts`(기기 토큰), `lib/adminApiAuth.ts`(`checkIsMaster` · `requireMasterUser`), `lib/bagLockSync.ts`(잠김 기록), `lib/auditLog.ts`, `lib/firestoreSanitize.ts`(`stripUndefined` · `stripServerOnlyPackFields` · `isSafeDocId`)
- 라우트는 전부 `runtime = "nodejs"`이고 Admin SDK로 쓴다 → **Firestore · Storage 규칙을 거치지 않는다**. 규칙이 `create: false`인 것(가방 · 보관함 팩 · 초대코드)은 이 라우트들로만 만들어진다

---

## 0. API-COM 공통

| ID | 규칙 |
|---|---|
| API-COM-01 | 로그인 확인: `Authorization: Bearer <Firebase idToken>` → `verifyRequestUser`가 uid · email · isAnonymous를 돌려준다. 없거나 틀리면 401 "로그인이 필요해요" / "로그인 정보를 확인할 수 없어요. 다시 로그인해주세요" |
| API-COM-02 | email은 **인증된 이메일만**(`email_verified`). 인증 안 한 이메일은 null → 마스터 이메일로 가입만 한 계정은 마스터가 아니다(10/9) |
| API-COM-03 | 게스트(익명 로그인): 막는 곳은 AI 5개(API-AI-01) · 짧은 URL · 커스텀 URL. 나머지는 일반 계정과 같다 |
| API-COM-04 | 실패 응답 모양 `{ error: "한국어 문구", code?: "영문 코드" }`. 화면은 `code`로 프리미엄 시트 등을 고른다(`BAG_LIMIT_REACHED` · `JOIN_LIMIT_REACHED` · `BAG_MEMBER_LIMIT` · `PACK_LIMIT_REACHED` · `PACK_LOCKED` · `COOLDOWN` · `DAILY_LIMIT`, AI는 `limitReached` · `premiumRequired`) |
| API-COM-05 | 프리미엄 판정은 `isPremiumServer` 하나(premium.md PREM-JUDGE-03). 지금은 FREE_LAUNCH라 항상 true → 아래의 "무료면 …" 검사는 모두 쉬는 중. **AI 하루 3회만 예외**(API-AI-02) |
| API-COM-06 | 문서 id를 클라이언트가 정하는 곳은 `isSafeDocId`로 거른다(보관함 팩 · 휴지통 사본 · 위젯 가방 id). 짧은 URL 코드는 40자 · `/` 금지 |
| API-COM-07 | 클라이언트가 보낸 팩에서 서버 전용 필드(`locked` · `isQuickPack` · `trashedAt` 등)는 `stripServerOnlyPackFields`로 뺀다(create-library-pack · trash-bag-pack · import-shared-pack, 10/9) |

### 서버만 쓰는 카운터 · 캐시 컬렉션 (규칙 없음 = 클라이언트 읽기 · 쓰기 불가)

| 컬렉션 | 문서 id | 용도 | 한도 |
|---|---|---|---|
| `aiUsage` | `{uid}_{KST날짜}` | AI 하루 횟수(`count` 무료 · `premiumCount` 프리미엄) | 3 / 50 |
| `shortLinkUsage` | `{uid}_{KST날짜}` | 짧은 · 커스텀 URL 만들기 | 합쳐서 하루 10 |
| `unlockRedeemUsage` | `{uid}_{KST날짜}` | 이용권 틀린 코드 | 하루 10 |
| `emailVerifyUsage` | `{uid}` | 인증 메일(Resend) | 60초 1통 · 하루 5통 |
| `passwordResetUsage` | sha256(이메일) | 재설정 메일(Resend) | 60초 1통 · 하루 5통 |
| `deviceTokens` | sha256(기기 토큰) | 위젯 · 단축어 기기 토큰(`day` · `count`) | 토큰마다 하루 800 |
| `geocodeCache` | 인코딩한 검색어 | 지명 좌표(못 찾은 것도) | 30일 |
| `joinFailUsage` | `{uid}_{KST날짜}` | 틀린 초대 코드(`lib/dailyCounter.ts`, 10/16) | 하루 20 |
| `sharePackUsage` | `{uid}_{KST날짜}` | 새 공유 스냅샷 토큰(10/16) | 하루 50 |
| `geocodeUsage` | `{uid}_{KST날짜}` | 캐시에 없는 지명 외부 조회(10/16) | 하루 100 |
| `adminDashboardCache` | `latest` | 관리자 대시보드 계산 결과 | 1시간 |

---

## 1. API-BAG 가방

### API-BAG-C `POST /api/create-bag` — 새 가방
- 부르는 쪽: `lib/bagsService.ts`(새 가방 · 샘플 · 메모로 만들기 · 오프라인 옮기기 · 만들기 대기)
- 요청: `{ bag: Bag(id · name · packs 필수), ownerProfile: { nickname, avatarId } }`

| ID | 규칙 |
|---|---|
| API-BAG-C-01 | 형식이 틀리면 400 "요청 데이터가 올바르지 않아요"(가방 id는 `isSafeDocId`). draft의 `locked` · `trashedByOwnerAt` · `editedBy`는 버린다(10/16) |
| API-BAG-C-02 | 무료면: 내가 만든 가방(`ownerId == 나`)을 모두 읽어, **같은 id가 이미 있으면 그대로 돌려줌**(만들기 대기 재시도) → 휴지통 아닌 것이 3개 이상이면 403 `BAG_LIMIT_REACHED` "무료로는 가방을 동시에 3개까지만 진행할 수 있어요…" |
| API-BAG-C-03 | 트랜잭션: 같은 id 문서가 있고 내 것 → 그대로 돌려줌 / 남의 것 → 409 "가방 생성에 실패했어요"(남의 가방 덮어쓰기 차단, 10/7) |
| API-BAG-C-04 | 초대코드: 헷갈리는 글자(0 O 1 I)를 뺀 32자 중 6자, `inviteCodes`에 없는 것을 최대 5번 골라 봄(못 고르면 500) |
| API-BAG-C-05 | 서버가 덮어쓰는 값: `ownerId` · `memberIds: [나]` · `memberProfiles` · `inviteCode` · `publicShareToken`(16자 hex) · `updatedAt` · `notesV: 2` · `packsRev: 1` |
| API-BAG-C-06 | 메모 본문은 떼어 `bags/{id}/notes/{packId}`에 `{ doc, rev: 1, updatedAt, updatedBy }`로(`splitPacksPlain`). 응답에는 본문이 붙은 가방을 돌려준다(열자마자 메모가 보이게) |
| API-BAG-C-07 | `inviteCodes/{code}` = `{ bagId }`를 같은 트랜잭션에서 create |

### API-BAG-J `POST /api/join-bag` — 초대 코드로 참여
- 부르는 쪽: `lib/bagsService.ts` `joinBagByCode`(홈 코드 입력 · 초대 링크). 문구 · 화면은 share.md SHARE-JOIN
- 요청: `{ inviteCode, joinerProfile: { nickname, avatarId } }`

| ID | 규칙 (검사 순서) |
|---|---|
| API-BAG-J-01 | 코드는 앞뒤 공백을 빼고 대문자로. 비면 400 "초대 코드를 입력해주세요", 프로필이 없으면 400 |
| API-BAG-J-10 | **틀린 코드는 계정마다 KST 하루 20번**(10/16, `joinFailUsage`). 먼저 횟수를 보고 20 이상이면 429 `JOIN_TOO_MANY_FAILS` "코드를 너무 많이 틀렸어요. 내일 다시 시도해주세요". J-02 · J-03의 404(영문 대문자 · 숫자 4~12자가 아닌 코드 포함)만 셈, 참여 성공 · 인원 초과 · 한도는 안 셈. 횟수 조회가 실패하면 500 |
| API-BAG-J-02 | `inviteCodes/{code}` 없음 → 404 "해당 초대코드의 가방을 찾을 수 없어요" / 가방 없음 → 404 "가방이 삭제되었거나 존재하지 않아요" |
| API-BAG-J-03 | **가방의 지금 `inviteCode`가 같아야** 참여(재발급 전 옛 코드 · 위조한 코드 문서 차단). 휴지통 가방은 404 |
| API-BAG-J-04 | 이미 멤버면 검사 없이 프로필만 다시 씀 |
| API-BAG-J-05 | 10명 이상 → 400 "가방 인원이 가득 찼어요 (최대 10명)" |
| API-BAG-J-06 | 2명 이상이면 그때만 그룹장 프리미엄 확인(Auth에서 인증된 이메일 → `isPremiumServer`). 무료면 403 `BAG_MEMBER_LIMIT` |
| API-BAG-J-07 | 내가 무료면 참여 중인 남의 가방(휴지통 제외) 3개 이상 → 403 `JOIN_LIMIT_REACHED` |
| API-BAG-J-08 | 트랜잭션으로 최신 가방을 다시 보고 코드 · 정원 · 그룹장 판정을 한 번 더 → `memberIds` arrayUnion + `memberProfiles.{uid}`(닉네임 12자) |
| API-BAG-J-09 | 성공 `{ bagId, joined: true }` |

### API-BAG-R `POST /api/regenerate-invite-code` — 코드 재발급
| ID | 규칙 |
|---|---|
| API-BAG-R-01 | 그룹장만(아니면 403 "이 가방의 초대코드를 재발급할 권한이 없어요") |
| API-BAG-R-02 | 트랜잭션으로 빈 코드를 골라 `inviteCodes` create + 가방 `inviteCode` 갱신 → 그 뒤 옛 코드 문서 삭제(실패해도 재발급은 성공) |
| API-BAG-R-03 | 감사 로그 `invite_code_regenerate`(옛 · 새 코드) |

### API-BAG-X `POST /api/cleanup-invite-code` — 남은 초대코드 문서 정리
| ID | 규칙 |
|---|---|
| API-BAG-X-01 | 로그인만 확인. 코드는 영문 대문자 · 숫자 4~12자 아니면 `{ removed: false }` |
| API-BAG-X-02 | 가리키는 가방이 **없거나, 있어도 지금 코드가 다를 때만** 지움. 가방이 이 코드를 쓰고 있으면 그대로 |

### API-BAG-RS `POST /api/restore-bag` — 휴지통 가방 되살리기
| ID | 규칙 |
|---|---|
| API-BAG-RS-01 | 그룹장만(403 "이 가방을 복구할 권한이 없어요"), 휴지통이 아니면 400 "이미 복구된 가방이에요" |
| API-BAG-RS-02 | 무료면 휴지통 아닌 내 가방 3개 이상 → 403 `BAG_LIMIT_REACHED` "…더 복구하려면 프리미엄이 필요해요." |
| API-BAG-RS-03 | `trashedByOwnerAt` 삭제 + `updatedAt`, 감사 로그 `bag_restore` |

### API-BAG-T `POST /api/transfer-bag-ownership` — 그룹장 넘기기
| ID | 규칙 |
|---|---|
| API-BAG-T-01 | 지금 그룹장만(403 "그룹장만 위임할 수 있어요"), 나 자신 400, 멤버가 아니면 400 "이 가방의 그룹원에게만 위임할 수 있어요" |
| API-BAG-T-02 | `ownerId`만 바꿈(트랜잭션 아님) → 두 사람 모두 `syncOwnedBagLocks`(실패해도 성공 응답) |

### API-BAG-P `POST /api/trash-bag-pack` — 가방 속 팩을 보관함 휴지통으로
- 가방 배열에서 지우는 것은 앱이 먼저 하고, 이 라우트는 **되살리기용 사본**만 만든다(실패하면 토스트만)

| ID | 규칙 |
|---|---|
| API-BAG-P-01 | `pack`(id · name · items) · `sourceBagId` · `sourceBagName` 필수 |
| API-BAG-P-02 | 내 보관함에 같은 id가 있으면 `{id}-trash-{시각}`으로 새 사본(덮어써서 잠긴 팩을 풀던 문제, 10/9) |
| API-BAG-P-03 | 사본: 서버 전용 필드 · 보관함 연결 필드 제거, `trashedAt` · `trashSourceBagId`(128자) · `trashSourceBagName`(60자) |
| API-BAG-P-04 | 무료 한도는 보지 않는다(휴지통은 개수에 안 들어감). 감사 로그 `bag_pack_trash`(meta에 팩 이름, 10/16 전에는 `bag_trash`) |

### API-LOCK `POST /api/sync-lock-status` — 잠김 다시 계산
- 부르는 쪽: AppShell(프리미엄 바뀜 · 어긋남 맞추기). 상세는 premium.md PREM-LOCK

| ID | 규칙 |
|---|---|
| API-LOCK-01 | 순서: 내 가방 `locked` → 보관함 `locked` → 무료면 참여 가방 3개 넘는 것에서 나가기(`leaveExcessJoinedBags`) |
| API-LOCK-02 | 응답 `{ ok, premium, leftJoinedBags }`, 실패 500 "잠금 상태 동기화에 실패했어요" |

---

## 2. API-LIB 팩 보관함

### API-LIB-C `POST /api/create-library-pack` — 새 팩 · 폴더
| ID | 규칙 |
|---|---|
| API-LIB-C-01 | `pack.id`는 `isSafeDocId`, `name` 필수 |
| API-LIB-C-02 | 빠른팩은 **문서 id `quick-pack`으로만** 알아본다(예전에는 `isQuickPack`만 보내면 한도를 건너뜀, 10/9) |
| API-LIB-C-03 | 같은 id가 있고 `locked: true` → 403 `PACK_LOCKED` "잠긴 팩이에요. 프리미엄이면 다시 고칠 수 있어요." |
| API-LIB-C-04 | 새 문서 · 빠른팩 아님 · 무료 → 휴지통 · 빠른팩 뺀 보관함 항목 10개 이상이면 403 `PACK_LIMIT_REACHED` |
| API-LIB-C-05 | 있으면 `set merge`(서버 필드 유지), 없으면 `create` |

### API-LIB-R `POST /api/restore-library-pack` — 휴지통 팩 되살리기
| ID | 규칙 |
|---|---|
| API-LIB-R-01 | 내 보관함 문서만. 휴지통이 아니면 400 "이미 복구된 팩이에요" |
| API-LIB-R-02 | `trashedAt` 삭제 → 무료면 `syncLibraryPackLocks`로 다시 잠금(한도는 거절하지 않고 오래된 것부터 잠금, 10/9) |
| API-LIB-R-03 | 폴더는 앱이 하위 항목 id마다 한 번씩 부른다. 감사 로그 `library_pack_restore` |

---

## 3. API-SHARE 공유 스냅샷

### API-SHARE-S `POST /api/share-pack` — 팩 · 폴더 · 메모 공유 만들기 · 갱신
- 요청: `{ pack | packs+folder, packId | folderId, bagId?, refreshOnly? }`. 화면은 share.md SHARE-PACK

| ID | 규칙 |
|---|---|
| API-SHARE-S-01 | `bagId`가 있으면 그 가방 멤버만(403 "이 가방의 팩을 공유할 수 없어요"), 가방 속 팩의 `publicShareToken`을 읽는다. 없으면 내 보관함 문서의 토큰 |
| API-SHARE-S-02 | **클라이언트가 보낸 토큰은 믿지 않는다**(10/7). 저장된 토큰의 스냅샷이 내 것이거나, 같은 가방 · 같은 팩에서 만든 것(`sourceBagId` · `sourcePackId`)일 때만 그 토큰을 다시 쓴다 |
| API-SHARE-S-06 | **원본이 있어야** 공유(10/16): 가방 속 팩을 찾거나 내 보관함에 그 문서가 있어야 한다. 없으면 404 "공유할 원본을 찾지 못했어요. 저장된 뒤 다시 시도해 주세요"(`refreshOnly`면 `{ skipped: true }`) |
| API-SHARE-S-07 | **새 토큰은 계정마다 KST 하루 50개**(10/16, `sharePackUsage`, 트랜잭션으로 먼저 예약 · 실패하면 되돌림). 넘으면 429 `SHARE_LIMIT_REACHED` "공유 링크는 하루에 50개까지 만들 수 있어요…". 있는 공유를 고치는 것은 안 셈 |
| API-SHARE-S-03 | 쓸 토큰이 없으면: `refreshOnly`면 `{ skipped: true }`(공유를 끈 뒤 되살아나지 않게) / 아니면 12자 hex 새 토큰 → 가방 속 팩은 트랜잭션으로 최신 `packs`에 토큰만, 보관함 팩은 문서에 토큰 |
| API-SHARE-S-04 | `sharedPacks/{token}` = `{ token, ownerUid: 나, type, title, sourceBagId?, sourcePackId?, pack?, packs?, createdAt, updatedAt }`(내용은 요청 본문 그대로) → `/p/{token}` revalidate |
| API-SHARE-S-05 | 응답 `{ token, shareUrl: {APP_URL}/p/{token} }`. APP_URL 기본 `https://packinbag.seeuson.com` |

### API-SHARE-U `POST /api/unshare-pack` — 공유 끄기
| ID | 규칙 |
|---|---|
| API-SHARE-U-01 | `tokens` 배열(영숫자 · `_` · `-` 6~64자, 중복 제거, 최대 50개) |
| API-SHARE-U-02 | 지울 수 있는 것: 내가 만든 스냅샷 / 가방 속 팩에서 만든 스냅샷 중 내가 그 가방 멤버이거나 **그 가방이 이미 없는** 것 |
| API-SHARE-U-03 | 스냅샷 삭제 → 가방 속 팩의 같은 토큰을 트랜잭션으로 뗌 → 만든 사람 보관함에서 같은 토큰 문서들의 토큰 뗌 → revalidate. 하나 실패해도 다음 토큰 계속. 응답 `{ removed }` |

### API-SHARE-I `POST /api/import-shared-pack` — 공유 팩 · 폴더 가져오기
| ID | 규칙 |
|---|---|
| API-SHARE-I-01 | 스냅샷이 없으면 404 "공유가 종료되었거나 없는 팩이에요" |
| API-SHARE-I-02 | 무료: 지금 개수 + 필요한 칸(팩 1 / 폴더 1 + 안의 항목 수) > 10 → 403 `PACK_LIMIT_REACHED` |
| API-SHARE-I-03 | 폴더: 새 최상위 폴더 → 스냅샷 안 항목을 새 id로, 부모를 옛 id → 새 id로 다시 이음(폴더 먼저 씀), 부모가 스냅샷 밖이면 새 최상위 폴더 안(10/15) |
| API-SHARE-I-04 | 아이템 id도 새로, `publicShareToken` · 서버 전용 필드 제거 |
| API-SHARE-I-05 | 사진 · 파일은 내 저장소 `users/{uid}/packs/…`로 복사(`copyPackFilesToUser`, 한 번에 최대 40개, 10/15) |
| API-SHARE-I-06 | 응답 문구 `"{이름}" 팩을 보관함으로 가져왔어요!` / `"{이름}" 폴더와 팩들을 보관함으로 가져왔어요!` |

---

## 4. API-LINK 짧은 URL · 커스텀 URL

| ID | 라우트 | 규칙 |
|---|---|---|
| API-LINK-01 | `POST /api/shorten-url` | http(s) · 2048자 이하만("올바른 URL이 아니에요"). **우리 도메인**의 `/s/…` · `/c/…`면 400 "이미 축약된 링크예요"(`lib/shortLinkGuard.ts` `ownShortLinkHosts`: 요청 도메인 · `NEXT_PUBLIC_SHORT_URL_BASE_URL` · `SHORT_URL_BASE_URL` · short.seeuson.com · `NEXT_PUBLIC_APP_URL` · packinbag.seeuson.com, 10/16 — 다른 사이트는 통과. 서버는 뒤에 `?` · `#`이 붙어도 막음). 게스트 403. 하루 한도 예약 → 영숫자 7자 코드(crypto, 5번까지 다시) → `shortLinks/{code}` = `{ longUrl, label(60자 · 없으면 null), createdBy, createdAt }`. 실패하면 한도를 되돌림 |
| API-LINK-02 | `POST /api/custom-shorten-url` | 코드 한글 · 영문 · 숫자 · `-` · `_` 2~20자, 예약어(s · c · api · admin · privacy · support · favicon.ico · manifest) 금지, 우리 도메인 축약 주소면 거절(LINK-01과 같은 검사). 게스트 403, **프리미엄만**(403 `premiumRequired`, 10/9). 이미 있으면 409 "이미 사용 중인 URL이에요" → 한도 예약 → `create`(동시 생성 시 409) |
| API-LINK-03 | 한도 | 짧은 · 커스텀 합쳐 계정마다 KST 하루 10개 → 429 "악용 방지를 위해 하루에 최대 10개까지만…". 카운터 조회가 실패하면 **막는다** |
| API-LINK-04 | 주소 | `SHORT_URL_BASE_URL`(Vercel 환경변수)이 있으면 그 도메인, 없으면 요청 도메인 + `/s/{code}` · `/c/{code}`(한글 코드는 인코딩하지 않음) |
| API-LINK-05 | `PATCH /api/update-short-link` | `kind`(s · c) · `code`(40자 · `/` 금지). label(60자, 비우면 null) · longUrl(http(s) · 2048자 · 우리 도메인 축약 주소 금지) 중 보낸 것만. **`createdBy == 나`만**(403 "본인이 만든 링크만 수정할 수 있어요"). 코드 자체는 못 바꿈 |
| API-LINK-06 | `POST /api/delete-short-link` | 같은 검사, 본인만. 이미 없으면 `{ ok: true }` |
| API-LINK-07 | `GET /api/my-short-links` | 두 컬렉션에서 `createdBy == 나`만, 만든 시각 최신순(정렬은 서버 코드에서 — 복합 색인 없이) |
| API-LINK-08 | `GET /api/link-meta?kind&code` | **로그인 없이** 표시 이름 · 원본 주소. 토큰이 있으면 `canEdit = createdBy == 나`. http(s)가 아닌 저장 값은 404 |
| API-LINK-09 | `GET /s/{code}` · `/c/{code}` | 코드 40자 · `/` 검사 → 없거나 http(s)가 아니면 `/?shortlink=notfound`(캐시 안 함) → 원본으로 리다이렉트, CDN 캐시 5분(10/12) |
| API-LINK-10 | 화면 `parseShortLinkUrl` | `lib/shortLinkService.ts` → `parseOwnShortLink`(`lib/shortLinkGuard.ts`). **지금 접속한 도메인 · `NEXT_PUBLIC_SHORT_URL_BASE_URL`(없으면 short.seeuson.com) · `NEXT_PUBLIC_APP_URL` · packinbag.seeuson.com**의 `/s/{code}` · `/c/{code}`(끝 `/` 허용, 호스트 대소문자 무시)만 우리 링크. `?` · `#`이 붙으면 아님. 퍼센트 인코딩된 한글 코드는 풀어서 돌려줌. 우리 링크일 때만 `link-meta`를 부르고(표시 이름 · 수정 메뉴) "짧은 URL로 변경"을 숨김(`isAlreadyShortLink`). 다른 사이트 `…/s/abc`는 일반 링크(10/16) |

> 10/13 남은작업 "update · delete · my-short-links가 본인 링크만 다루는지" → **세 곳 모두 `createdBy` 확인 중**(API-LINK-05~07).

---

## 5. API-AI AI 기능 (Gemini)

| 라우트 | 하는 일 | 무료(FREE_LAUNCH 끈 뒤) | 입력 상한 |
|---|---|---|---|
| `POST /api/import-note` | 메모 · PDF → 가방 이름 + 팩 · 아이템(체크 표시 읽음) | 하루 3회 | 글 6,000자 · PDF 3MB(`application/pdf`만) |
| `POST /api/organize-bag` | 아이템 번호를 팩으로 다시 묶기(문구는 안 바꿈) | **프리미엄 전용** | 아이템 200개 · 60자, 기존 팩 이름 10개 · 30자 |
| `POST /api/clipboard-organize` | 붙여넣은 글에서 가방에 없는 것만 | **프리미엄 전용** | 글 6,000자, 기존 아이템 2,000개 · 60자(프롬프트에는 200개) |
| `POST /api/ai-audit-bag` | 빠진 것 2~6개 + 한 줄 조언 | 하루 3회 | 팩 30개 · 팩마다 아이템 100개 · 60자, 날씨 300자 |
| `POST /api/ai-weather-recommend` | 날씨로 아이템 4개 + 이모지 | 하루 3회 | 가방 이름 60자, 날씨 40자, 기온 -60~60 |

| ID | 규칙 |
|---|---|
| API-AI-01 | 로그인 필수, **게스트는 401** "AI 기능은 로그인하면 쓸 수 있어요. 설정에서 계정을 만들어 주세요"(10/9, 게스트를 새로 만들면 횟수가 초기화되던 문제) |
| API-AI-02 | 판정(`verifyAndCheckAiQuota`): 마스터 무제한 → 프리미엄(구매 · 내 이용권) 하루 50회 → 무료 하루 3회. **FREE_LAUNCH를 보지 않는다** → 지금 모든 일반 사용자가 하루 3회 |
| API-AI-03 | 라우트를 `withAiQuotaSettlement`로 감싸 시작할 때 트랜잭션으로 1회를 **먼저 예약**(동시 요청으로 한도 넘기 차단, 10/6). Gemini가 성공해 `consumeAiQuota`를 부르면 확정, 아니면 응답이 끝날 때 되돌림(-1) → 실패 · 잘못된 요청은 횟수가 안 줄어든다 |
| API-AI-04 | 판정 중 오류는 **막는다**(fail-closed) |
| API-AI-05 | 프리미엄 50회 초과 → 429 "AI 기능은 하루 50회까지 쓸 수 있어요. 내일 다시 시도해주세요" |
| API-AI-06 | 무료 3회 초과 → 403 `limitReached`(다섯 곳 모두, weather도 10/16부터). import-note · audit · weather "오늘 무료 AI 사용 한도(3회)를 다 썼어요. 내일 다시 시도하거나, 프리미엄으로 더 많이 쓸 수 있어요" / organize · clipboard "…내일 다시 시도해주세요" |
| API-AI-07 | organize · clipboard는 FREE_LAUNCH가 아니고 무료면 403 `premiumRequired` "AI로 정리하기는 / AI 클립보드는 프리미엄 전용 기능이에요" |
| API-AI-08 | Gemini 503 · 429는 0.9초 · 1.8초 쉬고 2번 다시(import · organize · clipboard), weather는 0.5초 간격 2번, audit는 다시 안 함. 끝내 실패 → 502 "지금 AI 요청이 많이 몰려서…" / "AI 사용량이 순간적으로 몰렸어요…" / "AI 분석 중 문제가 발생했어요" |
| API-AI-09 | 응답 JSON을 못 읽으면 502 "AI 응답을 해석하지 못했어요. 다시 시도해주세요" |
| API-AI-10 | 결과 다듬기: 팩 최대 8개 · 이름 20자, 아이템 60자 · 팩마다 60개(import · clipboard), 빈 팩 제거. organize는 AI가 빠뜨린 번호를 "미분류" 팩에 모음, 중복 번호는 처음 팩에만. clipboard는 공백 · 대소문자를 무시하고 기존 아이템과 같은 것을 서버가 한 번 더 뺌(`skippedDuplicateCount`) |
| API-AI-11 | weather는 결과가 비면 횟수를 쓰지 않고 기본 아이템 4개("{가방 이름} 아이템" 등)를 돌려줌 |
| API-AI-12 | 응답에 `quota: { unlimited, usedCount, limit }`(weather 제외) |
| API-AI-13 | 키 `GEMINI_API_KEY`(결제 안 건 GCP 프로젝트), 주소는 모두 `getGeminiEndpoint()`(`lib/geminiConfig.ts`). 모델 `GEMINI_MODEL`(기본 gemini-3.7-flash), weather만 `GEMINI_LITE_MODEL`(기본 gemini-2.5-flash-lite, 10/16 전에는 주소를 직접 적음). 키는 헤더(`x-goog-api-key`)로 |
| API-AI-14 | Admin SDK 키가 없으면(로컬) 로그인 없이 무제한 통과(`dev-user`) |

---

## 6. API-PAY 이용권 · 결제

상세 규칙은 premium.md(PREM-CODE · PREM-PAY). 여기서는 라우트만.

| ID | 라우트 | 규칙 |
|---|---|---|
| API-PAY-01 | `POST /api/redeem-unlock-code` | 형식(대문자 · 숫자 `UNLOCK_CODE_LENGTH`자) → 로그인 → 틀린 횟수 10 이상이면 429 → 트랜잭션(없음 404 · 무효화 400 · 남이 씀 409 · 내 코드 다시 맞춤 · 처음 claim) → 감사 로그 `unlock_code_redeem`. 맞는 코드는 횟수에 안 들어감 |
| API-PAY-02 | `POST /api/sync-purchase` | 로그인 → RevenueCat REST(`REVENUECAT_SECRET_API_KEY`)로 entitlement 확인 → 활성이면 `premiumPurchase` 부여(platform ios). **해제는 안 함**. 키가 없거나 조회 실패면 `{ premium: false, synced: false }` |
| API-PAY-03 | `POST /api/revenuecat-webhook` | Authorization이 `REVENUECAT_WEBHOOK_AUTH_HEADER`와 같아야(시간 차 없는 비교, 아니면 401). TRANSFER는 받는 쪽 부여 · 내준 쪽 해제(`update` → 없는 문서는 안 만듦). 그 밖에는 프리미엄 entitlement가 있는 이벤트만: 부여 INITIAL_PURCHASE · NON_RENEWING_PURCHASE · RENEWAL · PRODUCT_CHANGE / 회수 CANCELLATION |

---

## 7. API-AUTH 메일 · 계정

| ID | 라우트 | 규칙 |
|---|---|---|
| API-AUTH-01 | `POST /api/send-verification-email` | 로그인 + 이메일 있음 → 60초 안 다시면 429 `COOLDOWN`(`retryAfterSec`, 앱은 Firebase로 대신 보내지 않음) / 하루 5통 넘으면 200 `DAILY_LIMIT`(앱이 Firebase 기본 발송) → Firebase 인증 링크 + Resend 발송. **어떤 실패든 200 `{ sent: false }`** → 앱이 Firebase 기본 발송으로(`lib/emailVerification.ts`). 카운터 DB 오류는 막지 않음 |
| API-AUTH-02 | `POST /api/send-password-reset` | **로그인 없음**. 이메일 형식 · 254자 → 이메일 해시마다 60초 429 `COOLDOWN` · 하루 5통 넘으면 `DAILY_LIMIT`(앱이 Firebase로) → 재설정 링크 + Resend. **가입 안 한 이메일도 `{ sent: true }`**(가입 여부를 알리지 않음, 실제로는 안 보냄). 그 밖의 실패는 `{ sent: false }` |
| API-AUTH-03 | 발신 | `lib/resendEmail.ts` `팩인백 <noreply-packinbag@seeuson.com>`, 링크 돌아갈 주소 `NEXT_PUBLIC_APP_URL` |
| API-AUTH-04 | `GET /api/auth/master-status` | `{ isMaster }`. 마스터면 백그라운드로 `masters/{uid}` · `users.role` · Custom Claims를 맞추고 내 가방 잠김을 다시 계산 |
| API-AUTH-05 | `POST /api/delete-account-data` | 탈퇴 · 게스트 끝내기의 마지막 단계(가방 · 팩 · 첨부 · 그룹장 넘기기는 앱이 먼저). Admin SDK로 `shortLinks` · `customShortLinks`(createdBy) · `sharedPacks`(ownerUid) · 알림함 · `deviceTokens` · `inquiries`(uid · 옛 userId) · `unlockRedeemUsage` · `emailVerifyUsage/{uid}` · `users/{uid}` 삭제(400개씩, 하나 실패해도 계속) → Auth 계정 삭제. 10/16부터 `aiUsage` · `shortLinkUsage` · `joinFailUsage` · `sharePackUsage` · `geocodeUsage`(uid) · `passwordResetUsage`(Auth 이메일 해시)도. 계정 삭제 실패면 500(앱이 `deleteUser`로 한 번 더) |

---

## 8. API-NAT 네이티브(iOS 위젯 · 단축어 · 실시간 현황)

- 인증은 Firebase 토큰이 아니라 **기기 토큰** `Authorization: Device <토큰>`(발급만 Firebase 토큰). 화면 · 위젯 동작은 native-ios.md

| ID | 라우트 | 규칙 |
|---|---|---|
| API-NAT-01 | 기기 토큰 | 32바이트 base64url, Firestore에는 sha256만(`deviceTokens/{hash}` = uid · platform · day · count · lastUsedAt). 계정마다 10개 넘으면 오래 안 쓴 것부터 지움. 확인할 때마다 하루 횟수 +1(KST, 800 넘으면 429 "오늘은 너무 많이 요청했어요…"), 없거나 길이가 틀리면 401 "다시 로그인해 주세요" |
| API-NAT-02 | `POST · DELETE /api/native/device-token` | POST(Firebase 토큰) 새 토큰 발급 / DELETE(기기 토큰) 그 토큰 삭제(로그아웃 · 계정 전환) |
| API-NAT-03 | `GET /api/native/summary` | 내가 멤버인 가방 전체 + 내 users 문서 → `buildNativeSummary`(보관함 가방 빼고 고정 먼저, PIN이 있을 때만 개인 잠금한 가방 · 팩 · 보관함 뺌). 캐시 안 함 |
| API-NAT-04 | `POST /api/native/toggle-item` | `{ bagId, packId, itemId, checked }`. 트랜잭션: 멤버만 · 잠긴 가방의 그룹장 막음 · **내가 휴지통에 넣은 가방이면 403 "휴지통에 있는 가방이에요"**(10/16, 다른 멤버는 그대로) · 메모 팩이면 404 · 이미 그 상태면 그대로 → `packs` · `lastCheckedAt` · `updatedAt` · `editedBy: 나`, notesV 2면 `packsRev + 1`. 체크로 다 챙기면 `lastPackedAt` · `lastPackedBy` |
| API-NAT-05 | `POST /api/native/add-item` | `{ bagId, packId?, text }` 줄마다 하나(최대 20줄 · 200자). packId 없으면 "미분류" 팩 끝(없으면 맨 앞에 새로 — 팩 10개면 400 "가방 하나에는 팩을 최대 10개까지…"). 같은 권한 검사(휴지통 포함) · packsRev |
| API-NAT-06 | `POST /api/native/quick-add` | `{ text, type? }` 줄마다(최대 20 · 200자) 빠른팩 끝에. `users/{uid}`가 없으면(탈퇴) 401. 빠른팩 문서가 없으면 만듦(한도 무관) |
| API-NAT-07 | `POST · DELETE /api/native/push-token` | APNs 토큰(hex 64~200) · env(sandbox · production) · alerts를 내 기기 토큰 문서 `apns`에. 같은 APNs 토큰이 다른 문서에 있으면 거기서 뗌 |
| API-NAT-08 | `POST · DELETE /api/native/live-token` | 잠금화면 실시간 현황 토큰 · bagId · packId · env를 `apnsLive`에. **그 가방 멤버만**(403 "이 가방을 볼 수 없어요") |

---

## 9. API-ADM 관리자

화면은 admin.md. 모두 `requireMasterUser`(로그인 401 · 마스터 아님 403 "관리자 권한이 없어요") + 백그라운드 마스터 상태 맞추기.

| ID | 라우트 | 규칙 |
|---|---|---|
| API-ADM-01 | `GET /api/admin/stats` | 대시보드 숫자 + 어제 · 일주일 전 스냅샷과의 차이. 함수 메모리 5분 + `adminDashboardCache/latest` 1시간, `force=1`이면 다시 계산 |
| API-ADM-02 | `GET /api/admin/stats/snapshot` | **Vercel Cron 전용**(`vercel.json` 매일 UTC 15:05 = KST 00:05). `Authorization: Bearer {CRON_SECRET}`. `adminStatsSnapshots/{어제 KST 날짜}`에 통계 + kpis |
| API-ADM-03 | `GET /api/admin/user-lookup?email` | 이메일 → uid(없으면 404) → 프로필 · 만든 가방 · 참여 가방 · 보관함 · 이용권 요약 |
| API-ADM-04 | `GET /api/admin/users-list?newOnly&cursor` | 가입 최신순 20명씩(`newOnly=1`은 7일 안), cursor = 마지막 createdAt |
| API-ADM-05 | `GET /api/admin/audit-logs?uid&limit` | 감사 로그 최신순(기본 50 · 최대 200), uid로 거르기 |

---

## 10. API-MISC 그 밖

| ID | 라우트 | 규칙 |
|---|---|---|
| API-MISC-01 | `GET /api/geocode?query` | 로그인 필수(유료 Google 비용). 40자로 자름, 숫자만 · 영문 4자 미만 · 한글 등 2자 미만은 `null` → `geocodeCache` 30일 → **캐시에 없으면 계정마다 하루 100번**(10/16, `geocodeUsage`, 넘으면 `{ result: null, limited: true }` — 화면은 못 찾음과 같음, 지명 서비스가 둘 다 답 없으면 횟수 되돌림) → Google(행정구역 · 자연지형 타입만, partial_match 제외) → Nominatim(place · boundary · natural, importance 0.42 이상). 못 찾음은 지명 서비스가 제대로 답했을 때만 캐시 |
| API-MISC-02 | `GET /api/build-info` | `{ buildId: VERCEL_GIT_COMMIT_SHA }`, 캐시 안 함. 새 버전 알림(`lib/useNewVersionAvailable.ts`) |
| API-MISC-03 | `GET /.well-known/apple-app-site-association` | 유니버설 링크: `/?invite=*`(초대) · `/v/*`(게스트 보기)만, 짧은 URL은 뺌. `webcredentials` 포함, 1시간 캐시. 앱 ID `2ZHYLWBV2H.com.appfle.packinbag` |

---

## 확인 필요

| # | 내용 | 위치 |
|---|---|---|
| ~~1~~ ✅ 10/16 틀린 코드 하루 20번(API-BAG-J-10) + 규칙 get 막음(RULE-INV-01) | ~~초대 코드 대입 제한이 없다. join-bag은 틀린 코드를 세지 않고, 규칙도 inviteCodes get을 로그인한 누구에게나 연다~~ | `join-bag` · `inviteCodes` 규칙 |
| ~~2~~ ✅ 10/16 원본이 있을 때만 + 하루 50개(API-SHARE-S-06 · 07) | ~~공유 스냅샷은 원본이 없어도 · 횟수 제한 없이 만들어진다~~ | `share-pack` |
| ~~3~~ ✅ 10/16 함께 지움(API-AUTH-05) | ~~delete-account-data가 aiUsage · shortLinkUsage · passwordResetUsage를 지우지 않는다~~ | `delete-account-data` |
| ~~4~~ ✅ 10/16 403 · 같은 문구(API-AI-06). 화면(`useBagWeather`)은 상태 코드와 상관없이 서버 문구를 보여 줌 | ~~weather만 한도 초과가 429~~ | `ai-weather-recommend` |
| ~~5~~ ✅ 10/16 `GEMINI_LITE_MODEL`(API-AI-13) | ~~weather만 모델 주소를 직접 적음~~ | `ai-weather-recommend` · `lib/geminiConfig.ts` |
| ~~6~~ ✅ 10/16 우리 도메인일 때만(API-LINK-01 · 02 · 05) | ~~다른 사이트 `…/s/abc`도 "이미 축약된 링크"로 막음~~ | `lib/shortLinkGuard.ts` |
| ~~7~~ ✅ 10/16 내가 휴지통에 넣은 가방은 막음(API-NAT-04 · 05) | ~~위젯 · 단축어가 휴지통 가방을 고침~~ | `api/native/*` |
| ~~8~~ ✅ 10/16 `bag_pack_trash`(API-BAG-P-04, 관리자 화면 이름은 그대로) | ~~팩 휴지통 감사 로그가 `bag_trash`~~ | `trash-bag-pack` · `lib/auditLog.ts` |
| ~~9~~ ✅ 10/16 `locked` · `trashedByOwnerAt` · `editedBy` 버림 + id 검사(API-BAG-C-01) | ~~create-bag이 draft의 서버 전용 필드를 거르지 않음~~ | `create-bag` |
| ~~10~~ ✅ 10/16 캐시에 없는 단어만 하루 100번(API-MISC-01) | ~~geocode 하루 횟수 없음~~ | `geocode` |
| ~~11~~ ✅ 10/16 그대로 둠(비용 작음) | ~~master-status가 앱을 열 때마다 마스터 상태를 다시 씀~~ | `master-status` |
| ~~12~~ ✅ 10/16 주석 고침 | ~~restore-library-pack 주석 "v68 이후 팩 개수 제한 폐지"~~ | `restore-library-pack` |
| ~~13~~ ✅ 10/16 우리 도메인만(API-LINK-10). `SHORT_URL_BASE_URL` = https://short.seeuson.com(내가 만든 URL 목록으로 확인) → 코드 기본값, `NEXT_PUBLIC_SHORT_URL_BASE_URL`이 있으면 그 값 | ~~화면 쪽 `parseShortLinkUrl`이 도메인을 보지 않아 다른 사이트 `…/s/abc`를 우리 짧은 URL로 봄~~ | `lib/shortLinkService.ts` · `lib/shortLinkGuard.ts` |

## 테스트 후보 (단위, Firebase 없이)

| 대상 | ID |
|---|---|
| 초대 코드 생성(글자 집합 · 길이) — 함수가 create-bag · regenerate에 두 벌 → 하나로 빼면 테스트 쉬움 | API-BAG-C-04 · R-02 |
| join-bag 검사 순서를 순수 함수로(멤버 수 · 그룹장 프리미엄 · 내 참여 수 → 결과 코드) | API-BAG-J-03~07 |
| `stripServerOnlyPackFields` · `isSafeDocId` | API-COM-06 · 07 |
| URL 검사(`isHttpUrl` · 2048자 · 커스텀 코드 정규식 · 예약어) — 라우트마다 복사본 → `lib`로 하나 | API-LINK-01 · 02 · 05 |
| `isOwnShortLink` · `parseOwnShortLink`(우리 도메인 `/s/` · `/c/`만 참, 다른 사이트 `/s/abc` 거짓, 경로 끝 `/` 허용, 호스트 대소문자, parse는 `?` · `#` 거짓 · 한글 코드 풀기) — `lib/shortLinkGuard.ts`는 호스트 목록을 인자로 받아 바로 테스트 가능 | API-LINK-01 · 10 |
| 하루 카운터(`lib/dailyCounter.ts` 예약 · 되돌리기 · 한도 경계) — Firestore를 가짜로 넣으면 | API-BAG-J-10 · API-SHARE-S-07 · API-MISC-01 |
| AI 결과 다듬기 `sanitizeResult`(import · organize · clipboard · audit) · `dedupeAgainstExisting` · `extractJsonItems` | API-AI-10 · 11 |
| AI 예약 · 되돌리기(`withAiQuotaSettlement`) — Firestore를 가짜로 넣으면 | API-AI-03 |
| 웹훅 TRANSFER id 거르기 | API-PAY-03 |
| `parseDevicePush` · `parseDeviceLive`(형식) | API-NAT-07 · 08 |
| toggle-item 다 챙김 판정(체크 아이템 전부) — 앱 `useBagDocument`와 같은 결과인지 | API-NAT-04 |
| geocode 쿼리 거르기(숫자만 · 영문 4자 · 2자) | API-MISC-01 |
