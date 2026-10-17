# Firestore · Storage 보안 규칙 — security-rules.md

기준 코드: v1.6.1 (2026-10-16). `firestore.rules` · `storage.rules`.
라우트(Admin SDK)는 규칙을 거치지 않는다 → "서버만"이라고 적은 것은 `api.md`의 그 라우트로만 바뀐다. 화면 쪽 동작은 각 화면 명세에.

- 배포: `npx firebase-tools deploy --only firestore:rules,storage`(맥에 firebase CLI 없음). Vercel 배포와 따로다. 규칙과 앱을 함께 바꿀 때는 보통 **규칙 먼저**
- 규칙에 없는 컬렉션은 기본 거부(클라이언트 읽기 · 쓰기 불가)
- 같은 경로의 `allow`가 여럿이면 **OR**로 합쳐진다 → 하나만 맞아도 통과. 조건은 한 `allow` 안에 모은다

---

## 0. RULE-COM 공통

| ID | 규칙 |
|---|---|
| RULE-COM-01 | `isMaster()`: Custom Claims `role == 'master'` 또는 `masters/{uid}` 문서 있음 또는 `users/{uid}.role == 'master'`. Claims · masters · role은 서버만 씀(`syncMasterStateBackground`) → 이메일 판정(MASTER_EMAILS)은 규칙에 없고, 서버가 한 번 맞춰 준 뒤부터 규칙에서도 마스터 |
| RULE-COM-02 | 가방 규칙은 `resource.data`만 보고 추가 `get()`이 없다. 하위 문서(presence · notes)만 부모 가방을 `get()`(읽기 1회 비용) |

## 1. RULE-USER `users/{uid}`

| ID | 규칙 |
|---|---|
| RULE-USER-01 | 읽기 · 삭제: 본인만 |
| RULE-USER-02 | 만들기: 본인 + `premiumPurchase` · `role` · `unlockCode` · `unlockCodeExpiresAt`이 없을 것 |
| RULE-USER-03 | 고치기: 본인 + 위 4개 필드를 바꾸지 않을 것(이용권 필드는 10/7부터 서버만). 그 밖의 필드(프로필 · 설정 · `privateLock` · `archivedBagIds` 등)는 자유 |

### RULE-NOTI `users/{uid}/notifications/{id}`
| ID | 규칙 |
|---|---|
| RULE-NOTI-01 | 읽기: 본인 / 고치기: 본인이 `read`만 / 만들기: 마스터(문의 답변) · 서버(Cloud Functions) / 지우기: 안 됨(탈퇴 때 서버가 지움) |
| RULE-NOTI-02 | 멤버끼리 멘션 알림을 만들던 규칙은 댓글 기능과 함께 삭제(10/8) |

### RULE-LIB `users/{uid}/libraryPacks/{packId}` 팩 보관함
| ID | 규칙 |
|---|---|
| RULE-LIB-01 | 읽기 · 지우기: 본인. **만들기: 안 됨**(서버 `create-library-pack` · `trash-bag-pack` · `import-shared-pack` · `quick-add`만) |
| RULE-LIB-02 | 일반 고치기: 본인 + 지금 `locked`가 true가 아님 + 고친 뒤 `locked`가 false(없음 포함) + `trashedAt` · `isQuickPack`을 바꾸지 않음(10/7 · 10/9) |
| RULE-LIB-03 | 휴지통 보내기: `trashedAt`을 null → 값으로, **그 필드 하나만**(잠긴 팩도 됨) |
| RULE-LIB-04 | 되살리기(값 → null): 클라이언트 불가, 서버 `restore-library-pack`만 |

## 2. RULE-BAG `bags/{bagId}`

| ID | 규칙 |
|---|---|
| RULE-BAG-01 | 읽기: `memberIds`에 있는 사람(마스터도 예외 없음 → 관리자는 서버로 조회) |
| RULE-BAG-02 | **만들기: 안 됨**(서버 `create-bag`만). 참여도 서버 `join-bag`만 |
| RULE-BAG-03 | 일반 고치기 — 모두 맞아야: ① 멤버 ② 내가 그룹장인데 가방이 `locked`면 거부(다른 멤버는 됨) ③ `trashedByOwnerAt` · `ownerId`를 바꾸지 않음 ④ `locked` 값이 그대로(false ↔ 없음은 같음) ⑤ `memberIds`를 바꾸면 RULE-BAG-04 ⑥ `memberProfiles`를 바꾸면 RULE-BAG-09 ⑦ `inviteCode`는 그대로, `publicShareToken`은 비어 있을 때 채우기만(RULE-BAG-10) ⑧ RULE-BAG-05 ⑨ `editedBy`를 바꾸면 내 uid로만(10/11) |
| RULE-BAG-04 | `memberIds`: **넣기 불가**(참여는 서버만), 빼기는 그룹장이면 누구든 · 일반 멤버는 자기 자신만(나가기)(10/7) |
| RULE-BAG-05 | 메모 본문 분리: `notesV`는 낮출 수 없음. `notesV == 2` 가방에서 `packs`를 바꾸면 `packsRev`가 정확히 +1이어야(옛 탭 · 옛 포터블이 본문 없는 메모를 다시 써넣는 것 차단, 10/8) |
| RULE-BAG-06 | 휴지통 보내기: **그룹장만**, `trashedByOwnerAt` null → 값, 그 필드 하나만. 되살리기는 서버 `restore-bag`만 |
| RULE-BAG-07 | 완전 삭제: 그룹장, 또는 멤버가 나 혼자일 때(그룹장이 나간 가방 · 탈퇴 정리). 잠긴 가방도 됨(10/7) |
| RULE-BAG-08 | 그룹장 넘기기는 서버 `transfer-bag-ownership`만(RULE-BAG-03 ③) |
| RULE-BAG-09 | `memberProfiles`(닉네임 · 캐릭터 스냅샷): 바뀜 키가 **내 uid 또는 이번에 `memberIds`에서 빠지는 사람**뿐이어야(10/16). 내 프로필 갱신 · 나가기 · 그룹장의 내보내기는 되고, 남의 닉네임 바꾸기는 거부. 자동저장 · 병합 저장은 서버 값을 그대로 쓴다(`BAG_MANAGED_KEYS` · `BAG_SERVER_KEYS`) |
| RULE-BAG-10 | `inviteCode`: 클라이언트가 바꿀 수 없음(재발급은 서버). `publicShareToken`: 있는 값은 바꿀 수 없고, 비어 있을 때만 채울 수 있음(옛 가방 대비, 10/16) |

### RULE-PRES `bags/{bagId}/presence/{uid}` 접속 표시
| ID | 규칙 |
|---|---|
| RULE-PRES-01 | 읽기: 가방 멤버 / 쓰기: 본인 문서 + 가방 멤버 |

### RULE-NOTE `bags/{bagId}/notes/{packId}` 메모 본문
| ID | 규칙 |
|---|---|
| RULE-NOTE-01 | 읽기 · 지우기: 가방 멤버(지우기는 잠김과 무관 — 완전 삭제 전 정리) |
| RULE-NOTE-02 | 만들기 · 고치기: 멤버 + 잠긴 가방의 그룹장 아님 + `doc`이 문자열이고 1,000,000자 미만 |

### RULE-OLD 지운 기능의 남은 데이터
| ID | 규칙 |
|---|---|
| RULE-OLD-01 | `bags/*/comments` · `bags/*/reactions`: 규칙 삭제(10/8) → 데이터는 남고 클라이언트는 못 읽고 못 씀 |

## 3. 그 밖의 컬렉션

| ID | 컬렉션 | 읽기 | 쓰기 |
|---|---|---|---|
| RULE-INV-01 | `inviteCodes/{code}` | **불가**(10/16, 예전에는 로그인한 누구나 get) | 전부 불가(서버 create-bag · regenerate · cleanup · join-bag만) |
| RULE-CODE-01 | `unlockCodes/{code}` | **내가 쓴 코드만 get**(`claimedBy.uid == 나`, 10/16) · 마스터는 get · list | 만들기: 마스터 / 고치기: 마스터가 `status` · `invalidatedAt`만, status를 `invalidated`로만 / 지우기: 불가 / 사용 처리(claim)는 서버만 |
| RULE-INQ-01 | `inquiries/{id}` | 쓴 사람(`uid`) · 마스터 | 만들기: 필드는 `id` · `uid` · `authorNickname` · `category` · `title` · `content` · `createdAt` · `status`만(10/16) + 본인 uid · `status: pending` · category(bag · pack · ai · other) · 제목 1~60자 · 내용 1~2000자 / 고치기: 마스터가 `status` · `answer` · `answeredAt` · `answerEditedAt`(10/16, 보낸 답변 고치기)만, `answered`로 / 지우기: 불가 |
| RULE-ANN-01 | `announcements/{id}` | 로그인한 누구나 | 마스터 |
| RULE-SHARE-01 | `sharedPacks/{token}` | **누구나 get(로그인 없이)**, list 금지(10/8) | 불가(서버 share-pack · unshare-pack만) |
| RULE-DEL-01 | `deletedAccounts/{uid}` | 로그인한 누구나 get, list 금지 | 만들기: 본인 uid로 한 번 / 고치기 · 지우기: 불가. 앱에서 읽는 곳은 없고 탈퇴 기록(uid · 시각)으로만 남김(10/16 확인) |
| RULE-MAS-01 | `masters/{uid}` | 본인 | 불가 |
| RULE-AUD-01 | `auditLogs` | 마스터(관리자 화면은 서버 라우트로 읽음) | 불가 |
| RULE-SRV-01 | `shortLinks` · `customShortLinks` · `shortLinkUsage` · `deviceTokens` · `pushQueue` · `pushSilent` · `joinFailUsage` · `sharePackUsage` · `geocodeUsage`(끝의 셋은 10/16) | 불가 | 불가 — 서버 · Cloud Functions만(명시) |
| RULE-SRV-02 | `aiUsage` · `unlockRedeemUsage` · `emailVerifyUsage` · `passwordResetUsage` · `geocodeCache` · `adminDashboardCache` · `adminStatsSnapshots` · `templateInspectLogs` | 불가 | 불가 — 규칙에 없음(기본 거부) |
| RULE-SRV-03 | `templateInspectLogs` | 삭제(10/16) — 규칙을 지워 RULE-SRV-02로 | |

---

## 4. STOR Storage

### STOR-COM 공통 함수
| ID | 규칙 |
|---|---|
| STOR-COM-01 | `isMemberOf(bagId)`: Firestore `bags/{bagId}.memberIds`에 내 uid. `isOwnerLockedOf`: 내가 그룹장이고 가방 `locked` |
| STOR-COM-02 | `isPremium()`: `freeLaunch()`(지금 **true**, `lib/freeLaunch.ts`와 같이 바꿈 — 규칙은 그 값을 못 읽음) · 마스터 · `premiumPurchase.purchased` · 내 이용권(`claimed` · `claimedBy.uid == 나` · 만료 전). 서버 `isPremiumServer`와 같은 기준 |
| STOR-COM-03 | 이미지 = `contentType`이 `image/*`. 그 밖은 모두 "파일"(PDF 포함, 형식 제한 없음) |

### 경로별
| ID | 경로 | 읽기 | 올리기(create · update) | 지우기 |
|---|---|---|---|---|
| STOR-BAG-01 | `bags/{bagId}/{file}` 가방 사진 · 파일 | 멤버 + (이미지 또는 프리미엄) | 멤버 + 잠긴 그룹장 아님 + (이미지 5MB 미만 또는 프리미엄 파일 10MB 미만) | 멤버(잠김 · 프리미엄 무관, 10/7) |
| STOR-BPACK-01 | `bags/{bagId}/packs/{packId}/{file}` 가방 속 메모 첨부 | 같음 | 같음(10/14부터 무료도 사진, 개수는 앱이 막음) | 멤버 |
| STOR-USER-01 | `users/{uid}/packs/{packId}/{file}` 보관함 메모 첨부 · 가져온 팩 사본 | 본인 · 마스터 + (이미지 또는 프리미엄) | **본인만**(10/16, 예전에는 마스터도) + 같은 크기 조건 | 본인만(프리미엄이 끝나도) |

| ID | 규칙 |
|---|---|
| STOR-NOTE-01 | 앱은 올린 뒤 **다운로드 URL**(토큰 포함, `lib/storageService.ts`)을 문서에 저장하고 그 URL로 보여 준다. 다운로드 URL은 **읽기 규칙을 거치지 않는다** → 읽기 규칙은 SDK로 직접 읽을 때만 적용(확인 필요 7) |
| STOR-NOTE-02 | 파일 이름은 `{시각}-{영숫자로 바꾼 이름}`, `cacheControl: private, max-age=31536000, immutable`(10/7) |
| STOR-NOTE-03 | 이미지는 1MB를 넘으면 올리기 전에 앱이 압축(`compressImageFile`). 규칙 상한은 5MB |

---

## 확인 필요

| # | 내용 | 위치 |
|---|---|---|
| ~~1~~ ✅ 10/16 내가 쓴 코드 · 마스터만(RULE-CODE-01) | ~~이용권 코드를 규칙으로 하나씩 맞혀 볼 수 있다~~ | `unlockCodes` |
| ~~2~~ ✅ 10/16 클라이언트 읽기 막음(RULE-INV-01) + join-bag 틀린 코드 하루 20번 | ~~inviteCodes get도 로그인한 누구나~~ | `inviteCodes` |
| ~~3~~ ✅ 10/16 (B)(RULE-BAG-09 · 10) | ~~멤버가 inviteCode · publicShareToken · 남의 memberProfiles를 바꿀 수 있다~~ | `bags` update |
| ~~4~~ ✅ 10/16 규칙 삭제(RULE-SRV-03) | ~~templateInspectLogs 규칙이 남아 있다~~ | `firestore.rules` |
| ~~5~~ ✅ 10/16 읽는 곳 없음 → 탈퇴 기록으로만 둠, 주석 정리(RULE-DEL-01) | ~~deletedAccounts를 지금도 읽는 곳이 있는지~~ | `deletedAccounts` |
| ~~6~~ ✅ 10/16 `keys().hasOnly`(RULE-INQ-01) | ~~inquiries 만들기에서 answer를 미리 넣을 수 있다~~ | `inquiries` create |
| 7 | → 현재 (A) 유지(10/16 결정). 결제를 켜기 전에 다시 본다 — 다운로드 URL은 규칙을 안 거쳐서(STOR-NOTE-01) **무료 멤버도 프리미엄 멤버가 올린 PDF를 연다**. (A) 올리기만 프리미엄 (B) 앱에서 무료면 파일을 열지 않게 | `storage.rules` · 메모 첨부 |
| ~~8~~ ✅ 10/16 본인만(STOR-USER-01) | ~~users/{uid}/packs 올리기를 마스터도 할 수 있다~~ | `storage.rules` |
| 9 | → 그대로 둠(10/16). 보관함 팩 첨부는 그 팩이 `locked`여도 올라간다(Firestore 문서 수정이 막혀 연결은 안 됨 → 쓰이지 않는 파일만 남음) | `storage.rules` |
| ~~10~~ ✅ 10/16 관리자 화면이 Auth 이메일 · 가입 시각을 씀(admin.md 확인 필요 1). 규칙은 그대로 | ~~`users/{uid}`의 `email` · `nickname` · `createdAt`을 본인이 아무 값으로 바꿀 수 있다 → 관리자 사용자 목록(users-list)에 그 값이 보임. 관리자 화면은 Auth 이메일을 쓰게 할지~~ | `users` update · `admin/users-list` |
| ~~11~~ ✅ 10/16 주석 고침 | ~~libraryPacks 주석 "v68부터 팩 개수 제한 폐지"~~ | `firestore.rules` |

## 테스트 후보 (규칙 — Firestore 에뮬레이터 + `@firebase/rules-unit-testing`)

지금 저장소에는 테스트 도구가 없다(package.json에 test 스크립트 없음). 규칙 테스트는 에뮬레이터가 필요해 단위 테스트와 따로 둔다.

| 대상 | ID |
|---|---|
| users: 이용권 · 구매 · role 필드 만들기 · 고치기 거부, 다른 필드는 통과 | RULE-USER-02 · 03 |
| libraryPacks: 만들기 거부 · 잠긴 팩 수정 거부 · locked 풀기 거부 · isQuickPack 바꾸기 거부 · 휴지통 보내기만 통과 · 되살리기 거부 | RULE-LIB-01~04 |
| bags: 멤버 아닌 사람 읽기 거부 · 멤버 넣기 거부 · 일반 멤버가 남 빼기 거부 · 자기 나가기 통과 · 그룹장 내보내기 통과 · ownerId 바꾸기 거부 · 잠긴 그룹장 수정 거부(다른 멤버 통과) · locked 바꾸기 거부 · notesV 2에서 packsRev +1 없이 packs 거부 · editedBy 남의 uid 거부 · 휴지통은 그룹장만 · 삭제는 그룹장 또는 혼자 · 남의 memberProfiles 바꾸기 거부(내보내기 때 빠지는 사람 항목 삭제는 통과) · inviteCode 바꾸기 거부 · publicShareToken 바꾸기 거부(빈 값 채우기 통과) | RULE-BAG-01~10 |
| notes: 멤버만 · 잠긴 그룹장 쓰기 거부 · 1MB 이상 거부 | RULE-NOTE-01 · 02 |
| inviteCodes · unlockCodes · sharedPacks list 거부, unlockCodes 무효화 외 수정 거부 | RULE-INV-01 · RULE-CODE-01 · RULE-SHARE-01 |
| inquiries 만들기 형식 · 마스터만 답변 | RULE-INQ-01 |
| Storage: 멤버 아닌 사람 올리기 거부 · 잠긴 그룹장 올리기 거부 · 무료 파일 거부 · 5MB · 10MB 경계 · 지우기는 멤버 | STOR-BAG-01 · STOR-BPACK-01 · STOR-USER-01 |
| Storage 위젯 사진: 남의 경로 거부 · 무료 올리기 거부 · JPEG 아님 거부 · 3MB 경계 · 본인 지우기 · 목록 | RULE-STO-WID-01 |

## RULE-STO-WID 북마크 위젯 사진 (10/18 · 1.7)

| ID | 규칙 |
|---|---|
| RULE-STO-WID-01 | `users/{userId}/widgetPhotos/{fileName}`: 읽기(목록 포함) · 지우기는 본인. 올리기는 본인 + `isPremium()` + `image/jpeg` + 3MB 미만. 위젯(기기)은 내려받기 주소(토큰)로 받아 규칙을 거치지 않는다(STOR-NOTE-01과 같은 성질, 본인 계정 문서에만 주소가 있음). 프리미엄이 끝나도 이미 올린 사진은 남고, 앱이 기본 바탕으로 그린다(SET-WID-03) |
