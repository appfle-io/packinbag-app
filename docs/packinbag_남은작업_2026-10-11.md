# 팩인백 남은 작업 정리 (2026-10-11 기준)

기준: 웹 v1.0.32 · iOS 1.5 (Build 5) **심사 대기 중**(10/11 23:04 제출, 수동 출시, 제출 ID 406ecb16-1b77-4577-83c2-b91ee3ca7500)
함께 볼 문서: `packinbag_리디자인_작업계획.md`, `packinbag_UIUX_리디자인_방향.md`, 저장소 `docs/packinbag_ios_native_plan.md`(iOS 9절) · `docs/packinbag_iap_release_guide.md`(출시 진행판) · `docs/qa_checklist.md`
이 문서는 `packinbag_남은작업_2026-10-08.md`를 대신한다(그 문서의 1~3번은 아래로 옮김, 0번은 끝남)

---

## 0. 지금 할 일

1. **심사 결과 기다리기**(보통 24~48시간)
   - 승인: App Store Connect → 팩인백 → 1.5 페이지 → **이 버전 출시**
   - 거절: 메일 · Resolution Center 원문을 그대로 Claude에게
2. 출시 뒤 1.3 사용자가 업데이트하면 위젯 · 알림을 쓸 수 있음(웹은 이미 배포돼 1.3도 그대로 동작)

---

## 1. 실기기 QA (사용자)

- 저장소 `docs/qa_checklist.md` **W-01~W-08**(새로고침 시각 · 위젯 편집 2단계 · 보관함 제외 · 알림 표시 · 종류별 알림)
- 잠금화면: "전체"로 띄워 체크가 원래 팩에 들어가는지, 다 체크 → 해제, 다른 기기 체크 반영, 배경 "직접" 불투명도가 실제로 비치는지(**안 비치면 슬라이더만 빼기**)
- 단축어 "잠금화면 다시 띄우기" + 자동화(0 · 8 · 16시)
- 새 멤버 알림, "다 쌌어요" 알림, 조용한 푸시로 위젯 갱신, 로그아웃 · 계정 전환 때 위젯
- 예전 항목(아직이면): 메모 본문 분리 · 첨부 정리 · 보안 제한(10/8 문서 2번)

---

## 2. 스토어 자료 다듬기 (선택)

- 잠금화면 스크린샷을 충전기 뺀 상태로 다시(지금은 날짜 대신 "100% 충전됨")
- 홈 위젯 스크린샷의 빈 "할일" 위젯을 아이템 있는 팩으로
- 다시 찍은 원본을 Claude에게 → 같은 모양으로 만듦(6.3″ 1206×2622 · 6.9″ 1320×2868)
- 스크린샷만 바꾸는 건 다음 버전 제출 때 함께(심사 중에는 바꿀 수 없음)

---

## 3. 보안 점검 — 아직 안 본 곳 (우선순위 순)

| 순위 | 대상 | 확인할 것 |
|---|---|---|
| 1 | `app/api/link-meta` | 내부 주소(127.0.0.1, 169.254.x.x, 사설망) 차단, 시간 · 크기 제한(SSRF) |
| 2 | `app/api/redeem-unlock-code` | 코드 무한 대입 막기(횟수 제한) |
| 3 | AI 라우트 6개 | 모두 `consumeAiQuota`, 입력 길이 제한 |
| 4 | 짧은 URL 5개 | 본인 링크만 수정 · 삭제, 하루 한도, 주소 형식 |
| 5 | `restore-bag`, `restore-library-pack`, `create-library-pack` | 본인 소유, 개수 검사(지금은 FREE_LAUNCH라 개수는 무제한) |
| 6 | `app/api/admin/*` | 모두 `requireMasterUser` |
| 7 | `geocode`, `import-shared-pack`, `trash-bag-pack` | 로그인 확인, 입력 검증 |
| 나중 | `app/api/revenuecat-webhook` | 결제 도입 때(인증 헤더 검증) |

새로 생긴 `/api/native/*`(기기 토큰 · 하루 800회 · 멤버 확인)와 Cloud Functions는 만들 때 점검함

---

## 4. 남은 버그 · 개선

- [ ] 세로 스크롤이 어느 순간 막힘(데스크톱 PWA 좁은 창, 모바일 의심) — 막힌 상태로 `document.elementFromPoint(innerWidth/2, innerHeight/2)` 조상 체인 확인
- [ ] Firestore 멈춤: 자동 복구로 덮어 둠. 자주 나오면 `persistentLocalCache` 재검토
- [ ] 화면 켜두기가 iOS 앱에서 안 되면 `@capacitor-community/keep-awake`
- 알려진 한계: 가방 메모 검색 앞 2,000자, 위젯 · 단축어 목록은 최근 가방 30개(고정 먼저), 잠금화면 실시간 현황은 다 챙긴 뒤 5분이 지나도 앱이 깨어날 때 내려감

---

## 5. 외부 설정 (사용자)

- [ ] **Resend**: 가입 + seeuson.com SPF/DKIM/DMARC → API 키를 `.env.local` · Vercel에 → 스팸함 · 폴백 QA
- [ ] ★ 키 4개 · `.env.local`을 비밀번호 관리자에도(`_secrets/README.md` 표)
- [ ] Vercel 환경변수 `NEXT_PUBLIC_UI_V2`가 남아 있으면 삭제
- [x] iCloud 동기화 제외(`~/Desktop/packinbag.nosync`, 10/11)
- [x] 비밀 파일 `_secrets/`로 모으기 · git 점검(10/11)

---

## 6. 정리 (급하지 않음)

- [ ] `.pib-v2-legacy` 제거(메모 편집기 · 관리자를 v2 토큰으로)
- [ ] `help_slide_generator.py` 프로젝트 파일에서 내리기
- [ ] Resend 메일 템플릿 색 주황 #FF6E2D → 딥그린 #2E5E4E(Resend 켤 때)
- [ ] knip 다시: `npx --yes knip --include exports,types --reporter compact 2>&1 | tee knip.txt`
- [ ] `firebase-functions` v6 업그레이드 경고
- [ ] `backups/` 오래된 백업(20261008-201824) 지우기

---

## 7. 이후 로드맵

iOS 1.5 출시 → 캘린더 · 미리알림 · Spotlight → 결제 도입(사업자 가능해지면: 출시가이드 B, Capacitor 8 + purchases-capacitor 13.x 먼저) → Android

---

## 8. 결정 기록 (10/9~10/11)

| 결정 | 내용 |
|---|---|
| 결제 | 사업자등록 불가 → **전원 무료 출시**(FREE_LAUNCH, AI만 하루 3회). 결제 코드는 남김 |
| 1.5 하나로 제출 | 1.4 없이 푸시 · 위젯 · 실시간 현황 · 단축어를 1.5에 모두 |
| 서버 푸시 | APNs 직접(FCM 안 씀), 활동은 10분 묶음, 기본 켜짐, 광고성 없음 |
| 위젯 단위 | 팩 하나 또는 가방 전체, 편집은 가방 → 팩 2단계, 보관함 가방 제외 |
| 위젯 시각 | "N분 전" 대신 "14시 05분에 새로고침", 자동 새로고침은 30분 안전망 |
| 잠금화면 배경 | 투명도를 한 번 뺐다가(10/11 오전) 배경 "직접"(색 + 불투명도)으로 다시 넣음 → 기기에서 비치는지 확인 |
| 실시간 현황 8시간 | 단축어 "잠금화면 다시 띄우기" + 사용자 자동화(0 · 8 · 16시) |
| 프로젝트 위치 | `~/Desktop/packinbag.nosync`, 비밀 파일 `_secrets/` |

**앞으로 코드를 고칠 때 지킬 규칙(추가)**
- 네이티브(위젯 · 단축어 · 실시간 현황)가 읽는 요약 모양은 `lib/nativeSummary.ts` ↔ `ios/App/Shared/PIBShared.swift` ↔ `functions/src/live.ts`(content-state)가 같아야 한다
- 웹에 올린 코드는 스토어 1.3 앱에도 뜬다 → 네이티브 기능은 `isNativeBridgeAvailable` · `isServerPushAvailable` · `isLocalNotificationsAvailable`일 때만
- `UserProfile` 새 필드는 AuthProvider 구독 매핑에도(10/11 `bagPushOff` 추가)
- Xcode는 App · 위젯 두 타깃의 Version · Build를 같이 올린다
- 잠금화면 실시간 현황 카드는 160pt 안
