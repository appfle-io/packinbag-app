# 팩인백 남은 작업 정리 (2026-10-08 기준)

기준 버전: v1.0.28 (메모 본문 분리 배포 완료, 기존 메모 이전 완료)
함께 볼 문서: `packinbag_리디자인_작업계획.md`, `packinbag_UIUX_리디자인_방향.md`, 저장소 `docs/packinbag_settings_spec_v1.md`(10/7~10/8 변경 기록)

---

## 0. 지금 바로 할 일

1. **규칙 배포** — 10/8 마지막에 고친 규칙 두 가지(공유 팩 목록 차단, 댓글·리액션·멘션 규칙 삭제)
   ```
   npx firebase-tools deploy --only firestore:rules
   ```
2. **커밋** — 규칙과 문서 변경
   ```
   git add -A && git commit -m "fix: 공유 팩 목록 차단, 안 쓰는 댓글·리액션 규칙 삭제 / docs" && git push origin main
   ```
   - 앱 코드는 바뀌지 않아서 버전·포터블 태그는 필요 없음
3. **배포 후 확인**
   - 공유 팩 링크(`/p/...`)가 그대로 열리는지
   - 메모 공유 시트에서 링크 만들기가 되는지

---

## 1. 보안 점검 — 아직 안 본 곳 (우선순위 순)

| 순위 | 대상 | 확인할 것 | 위험 |
|---|---|---|---|
| 1 | `app/api/revenuecat-webhook` | 결제 알림이 진짜 RevenueCat에서 왔는지 검증(인증 헤더·서명)하는지 | 검증이 없으면 누구나 "구매 완료"를 보내 프리미엄이 될 수 있음 |
| 2 | `app/api/link-meta` | 사용자가 준 주소를 서버가 열 때 내부 주소(127.0.0.1, 169.254.x.x, 사설망)를 막는지, 시간·크기 제한이 있는지 | 서버 내부를 찔러 보는 공격(SSRF) |
| 3 | `app/api/redeem-unlock-code` | 코드 무한 대입을 막는지(횟수 제한) | 남의 코드 찾기 |
| 4 | AI 라우트 6개 (`organize-bag`, `ai-audit-bag`, `clipboard-organize`, `import-note`, `ai-weather-recommend`, `ai-travel-places`) | 모두 `consumeAiQuota`(하루 횟수)를 거치는지, 입력 길이 제한이 있는지 | AI 비용 폭주 |
| 5 | 짧은 URL (`shorten-url`, `custom-shorten-url`, `update-short-link`, `delete-short-link`, `my-short-links`) | 본인 링크만 수정·삭제하는지, 하루 한도, 주소 형식 검사 | 남의 링크 변조, 피싱 링크 |
| 6 | `restore-bag`, `restore-library-pack`, `create-library-pack` | 본인 소유 확인, 무료 개수 검사 | 개수 제한 우회 |
| 7 | `app/api/admin/*` | 모두 `requireMasterUser`를 거치는지 | 관리자 기능 노출 |
| 8 | `geocode`, `import-shared-pack`, `trash-bag-pack` | 로그인 확인, 입력 검증 | 낮음 |

**이미 끝난 보안 점검(10/7~10/8)**
- 초대코드 위조, create-bag 덮어쓰기, share-pack 토큰 바꿔치기, `/v` 초대코드 노출
- 이용권 판정(`claimedBy` 본인 코드만) + users의 unlockCode 쓰기 차단
- 멤버 내보내기·가방 삭제 권한, 잠긴 팩·`locked` 필드 보호
- Storage 삭제 권한, 구매자 프리미엄 인정
- 공유 팩 목록 차단, 댓글·리액션·멘션 규칙 삭제

---

## 2. 최근 작업 QA (아직 안 했으면)

**메모 본문 분리 (v1.0.28)**
- [ ] 메모를 새로 만들고 고친 뒤, 나갔다 다시 열어도 그대로
- [ ] 함께 쓰는 가방에서 두 계정이 같은 메모를 고치면 둘 다 반영
- [ ] 메모 휴지통 보내기 → 되살리기, 다른 가방으로 메모 옮기기
- [ ] 보관함 메모 불러오기·보관함에 저장·자동 동기화
- [ ] 홈 검색으로 메모 속 글자 찾기
- [ ] 공유 보기 링크(`/v/...`)에서 메모가 보이는지
- [ ] 메모가 비어 보이는 가방이 있으면 → 백업 `backups/firestore-20261008-203752.json`에서 그 가방만 복구

**메모 첨부 정리 (v1.0.27)**
- [ ] 혼자 쓰는 가방 메모에서 사진을 지우고 나가면 Storage에서 그 파일만 지워짐
- [ ] 보관함에서 불러온 메모의 사진을 지워도 보관함 원본은 그대로
- [ ] 공유 가방 메모에서 사진을 지워도 Storage 파일은 그대로

**보안·제한 (v1.0.26)**
- [ ] devtools로 남의 이용권 코드를 써넣어도 프리미엄이 안 됨
- [ ] 구매자 계정으로 메모에 PDF 첨부 가능
- [ ] 무료 계정 팩 11개 이상 → 오래된 팩 읽기 전용, 휴지통 보내기는 가능
- [ ] 무료 계정 가방 4개 중 하나를 휴지통에 넣으면 잠긴 가방이 몇 초 뒤 풀림
- [ ] 초대코드 참여, 재발급한 옛 코드로는 실패
- [ ] 일반 멤버 나가기 가능, 다른 멤버 내보내기는 그룹장만
- [ ] 3분 가만히 있으면 다른 기기에서 접속 표시가 사라짐

---

## 3. 출시 마무리 (작업계획 문서에서 이어짐)

- [ ] App Store Connect에 스크린샷 업로드(아이폰 6.9″ 8장 · 아이패드 13″ 8장)
- [ ] Xcode 새 빌드(새 아이콘·스플래시) → 심사
  - `npx cap sync ios` 후 빌드
  - 햅틱: `npm i @capacitor/haptics && npx cap sync ios`
  - 화면 켜두기가 iOS 앱에서 안 되면 `@capacitor-community/keep-awake`
  - 아이패드 지원 여부 확인(지원하면 13″ 스크린샷 필수)
- [ ] 마케팅·앱스토어 설명 "최대 10명 실시간 공유" 2곳 → "무료 2명 · 프리미엄 10명"
- [ ] IAP TestFlight 샌드박스 구매 테스트, Agreements·Tax·Banking 상태

---

## 4. 남은 버그·개선

- [ ] **세로 스크롤이 어느 순간 막힘**(데스크톱 PWA 좁은 창, 모바일도 의심)
  - 막힌 상태 그대로 콘솔에서 `document.elementFromPoint(innerWidth/2, innerHeight/2)`의 조상 체인과 body 직속 fixed 요소 확인
- [ ] **메모 본문 검색 한계**: 가방 메모는 앞 2,000자까지만 검색됨(10/8 결정, 의도된 동작)
- [ ] **Firestore 멈춤**: 자동 복구로 덮어 둠. 자주 나오면 `persistentLocalCache` 설정 재검토

---

## 5. 외부 설정 (사용자가 직접)

- [ ] **Resend**: 가입 + seeuson.com SPF/DKIM/DMARC 등록 → API 키를 `.env.local`과 Vercel에 → 실제 가입 메일이 스팸함에 안 가는지, 키를 틀리게 했을 때 Firebase 기본 메일로 대신 가는지 QA
- [ ] **iCloud 동기화 제외**(" 2" 사본 재발 방지): 데스크톱에서
  ```
  mv packinbag packinbag.nosync && ln -s packinbag.nosync packinbag
  ```
- [ ] Vercel 환경변수 `NEXT_PUBLIC_UI_V2`가 남아 있으면 삭제(코드에서 안 읽음)

---

## 6. 정리 (급하지 않음)

- [ ] `.pib-v2-legacy`(메모 편집기·관리자)를 v2 토큰 직접 사용으로 바꾸면 제거 가능
- [ ] `help_slide_generator.py`(주황·주아체, 구 UI 기준) 프로젝트 파일에서 내리기 — 더 안 씀
- [ ] `docs/qa_checklist.md`에 위 2번 QA 항목 반영
- [ ] knip 다시 돌려 보기(코드 정리 후 새로 생긴 안 쓰는 코드)
  ```
  npx --yes knip --include exports,types --reporter compact 2>&1 | tee knip.txt
  ```

---

## 7. 이후 로드맵 (확정 순서)

v2 출시(스토어 자료·새 빌드) → 푸시 알림(그룹원 활동 + D-Day 임박) → 위젯(WidgetKit) → Spotlight/Siri(App Intents)·캘린더·미리알림 → Android

**iOS 설계 원칙**
- 그룹원 활동 푸시는 자동저장마다 보내지 않게 설계
- D-Day 알림은 기기 로컬 알림
- 위젯은 App Group에 저장한 요약을 읽는 방식
- 메모 본문은 가방 문서에 없음(notes 하위 문서) → 위젯·푸시는 미리보기(`editorPreviewText`)만 쓸 것

---

## 8. 결정 기록 (10/7~10/8)

| 결정 | 내용 |
|---|---|
| 로컬 개발용 Firebase 분리 | **하지 않음.** 로컬 테스트 = 운영 데이터. 큰 데이터 변경 전에는 `node scripts/backup-firestore.mjs`로 백업 |
| 메모 본문 분리 범위 | 가방 안 메모만. 보관함 메모는 그대로(개인 공간이라 비용 작음) |
| 메모 검색 | 가방 문서에 검색용 텍스트 앞 2,000자를 남김(A안) |
| 무료 팩 10개 초과분 | 서버 규칙으로 실제 잠금(읽기 전용, 휴지통·삭제는 가능) |
| 호환 코드 | 남겨 둠. 새 메모·보관함 불러오기에서 정상 흐름으로 쓰이고, 이전 스크립트도 재실행 가능하게 보관 |

**앞으로 코드를 고칠 때 지킬 규칙**
- 가방 문서의 `packs`를 직접 쓰는 코드는 반드시 메모 본문을 떼어 내고(`splitBagForSave`/`splitPacksPlain`) `packsRev`를 1 올린다. 안 그러면 규칙에 막힌다.
- 메모 본문이 도착하기 전(`notesReady` false)에는 메모를 열거나 휴지통·보관함으로 보내지 않는다.
- 가방을 완전히 지울 때는 `notes`를 먼저 지운다(`deleteAllBagNotes`).
- `UserProfile`에 새 필드를 만들면 `AuthProvider`의 users 구독 매핑에도 추가한다.
- users 문서 쓰기는 `writeUser`로만.
- 인터넷 연결 판단은 `lib/v2/connectivity`만.
