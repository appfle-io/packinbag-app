# 팩인백 남은 작업 정리 (2026-10-13 기준)

기준: 웹 v1.0.34(배포 준비) · iOS 1.5 (Build 5) **10/12 출시** · iOS 1.6 (Build 6) **코드 완료, 기기 확인 · 제출 전**
함께 볼 문서: `packinbag_리디자인_작업계획.md`, `packinbag_UIUX_리디자인_방향.md`, 저장소 `docs/packinbag_ios_native_plan.md`(10절 1.6) · `docs/packinbag_iap_release_guide.md`(출시 진행판 A-5) · `docs/qa_checklist.md`(X- 절)
이 문서는 `packinbag_남은작업_2026-10-08.md` · `packinbag_남은작업_2026-10-11.md`를 대신한다(둘 다 삭제)

---

## 0. 지금 할 일: 1.6 배포 · 제출

1. **웹 배포**(맥 터미널)
   ```
   cd ~/Desktop/packinbag.nosync
   npm version 1.0.34 --no-git-tag-version
   rm -rf .next && npx tsc --noEmit && npx eslint components/v2 lib app/admin components/admin contexts components/AppShell.tsx && npm run build
   git add -A && git commit -m "feat(1.6): Face ID 개인 잠금, 잠금화면 글자색, 위젯 열 수, Siri·Spotlight 검색, 위젯·잠금화면 되돌리기·완료 숨기기 / v1.0.34" && git push origin main
   ```
   - 확인: https://packinbag.seeuson.com/.well-known/apple-app-site-association 이 JSON으로 열리는지, 설정 > 버전 정보 1.0.34
   - 포터블은 새 기능이 없음. 업데이트 노트만 맞추려면 `git tag v1.0.34-offline-portable && git push origin v1.0.34-offline-portable`
2. **Xcode**: `npx cap sync ios` → `open ios/App/App.xcworkspace` → App · PackInBagWidgetExtension 두 타깃 Version 1.6 / Build 6 → Signing & Capabilities에 Associated Domains(`applinks:packinbag.seeuson.com`) 확인 → 실기기 실행
   - 빌드 오류는 원문 그대로 Claude에게(iOS 18 검색 API `indexAppEntities` · `OpenIntent`는 빌드로 확인 못 한 부분)
3. **기기 확인**: 저장소 `docs/qa_checklist.md` **X-01 ~ X-17**(X-13~17은 10/13 추가: 잠금화면 체크 반응 · 완료 숨기기 · 되돌리기 · 색 샘플 한 줄)
4. **Archive → 업로드 → 심사**: 출시가이드 A-5(새로운 기능 문구 · 심사 메모 · 수동 출시)

---

## 1. 실기기 QA (사용자, 틈틈이)

- 1.6: `docs/qa_checklist.md` X- 절(Face ID · 글자색 · 열 수 · 검색 · 유니버설 링크 · 개인 잠금 · 공유 링크 브리지)
- 1.5에서 남은 것: W-01~W-08, 잠금화면 "전체"로 띄워 체크가 원래 팩에 들어가는지, 다 체크 → 해제, 다른 기기 체크 반영, 배경 "직접" 불투명도가 실제로 비치는지(**안 비치면 슬라이더만 빼기**), 단축어 "잠금화면 다시 띄우기" + 자동화(0 · 8 · 16시), 새 멤버 · "다 쌌어요" 알림, 조용한 푸시로 위젯 갱신, 로그아웃 · 계정 전환 때 위젯
- 예전 항목(아직이면): 메모 본문 분리 · 첨부 정리(작업계획 회귀 점검표)

---

## 2. 스토어 자료 다듬기 (선택, 1.6 제출 때 같이 가능)

- 잠금화면 스크린샷을 충전기 뺀 상태로 다시(지금은 날짜 대신 "100% 충전됨")
- 홈 위젯 스크린샷의 빈 "할일" 위젯을 아이템 있는 팩으로(1.6이면 중간 2열이 보기 좋음)
- 다시 찍은 원본을 Claude에게 → 같은 모양으로 만듦(6.3″ 1206×2622 · 6.9″ 1320×2868)
- 심사 중에는 스크린샷을 바꿀 수 없음 → 제출 전에

---

## 3. 보안 — 남은 확인

10/9 보안 점검 2차(저장소 `docs/packinbag_settings_spec_v1.md` "10/9 보안 점검 2차")로 10/11 문서의 표 대부분이 끝났다.
- 끝: link-meta(외부 주소를 열지 않아 SSRF 아님) · 이용권 틀린 코드 하루 10회 · AI 하루 횟수(`consumeAiQuota`)와 입력 상한 · 짧은 URL 하루 10개 · 2048자 · 커스텀 URL 서버 확인 · create-library-pack · trash-bag-pack · import-shared-pack 서버 전용 필드 제거 · 보관함 복구 잠금 재계산 · admin/* 전부 `requireMasterUser` · geocode · restore-bag · RevenueCat 웹훅 헤더 비교 · 게스트 AI · URL 금지 · 마스터는 인증한 이메일만
- 남은 확인(10/9 기록에 명시 안 됨): `update-short-link` · `delete-short-link` · `my-short-links`가 본인 링크만 다루는지
- 새로 생긴 `/api/native/*`(기기 토큰 · 하루 800회 · 멤버 확인)와 Cloud Functions는 만들 때 점검함

---

## 4. 남은 버그 · 개선

- [ ] 세로 스크롤이 어느 순간 막힘(데스크톱 PWA 좁은 창, 모바일 의심) — 막힌 상태로 `document.elementFromPoint(innerWidth/2, innerHeight/2)` 조상 체인 확인
- [ ] Firestore 멈춤: 자동 복구로 덮어 둠. 자주 나오면 `persistentLocalCache` 재검토
- [ ] 화면 켜두기가 iOS 앱에서 안 되면 `@capacitor-community/keep-awake`
- [ ] (선택) 중간 위젯에서 둘째 줄(가방 이름 · D-Day)을 제목 줄로 합치면 한 줄 더 보임 - 1.6 기기에서 보고 결정
- 알려진 한계: 가방 메모 검색 앞 2,000자, 위젯 · 단축어 목록은 최근 가방 30개(고정 먼저), 검색 색인의 보관함 팩은 앱을 연 뒤 최신(최근 100개), Spotlight는 iOS 18 이상, 잠금화면 실시간 현황은 다 챙긴 뒤 5분이 지나도 앱이 깨어날 때 내려감

---

## 5. 외부 설정 (사용자)

- [ ] **Resend**: 가입 + seeuson.com SPF/DKIM/DMARC → API 키를 `.env.local` · Vercel에 → 스팸함 · 폴백 QA(`claude_packinbag_이메일인증_resend_구현.md`)
- [ ] 키 4개 · `.env.local`을 비밀번호 관리자에도(`_secrets/README.md` 표)
- [ ] Vercel 환경변수 `NEXT_PUBLIC_UI_V2`가 남아 있으면 삭제
- [x] iCloud 동기화 제외(`~/Desktop/packinbag.nosync`, 10/11) · 비밀 파일 `_secrets/`(10/11)

---

## 6. 정리 (급하지 않음)

- [ ] `.pib-v2-legacy` 제거(메모 편집기 · 관리자를 v2 토큰으로)
- [ ] `help_slide_generator.py` Claude 프로젝트 파일에서 내리기(구 UI용, 더 안 씀)
- [ ] Resend 메일 템플릿 색 주황 #FF6E2D → 딥그린 #2E5E4E(Resend 켤 때)
- [ ] knip 다시: `npx --yes knip --include exports,types --reporter compact 2>&1 | tee knip.txt`
- [ ] `firebase-functions` v6 업그레이드 경고
- [ ] `backups/` 오래된 백업(20261008-201824) 지우기
- [x] docs 폴더 정리(10/13): 끝난 · 옛 문서 삭제, 남은 문서 최신화

---

## 7. 이후 로드맵

iOS 1.6 출시 → 캘린더 · 미리알림 → 결제 도입(사업자 가능해지면: 출시가이드 B, Capacitor 8 + purchases-capacitor 13.x 먼저) → Android

---

## 8. 결정 기록 (10/9~10/13)

| 결정 | 내용 |
|---|---|
| 결제 | 사업자등록 불가 → **전원 무료 출시**(FREE_LAUNCH, AI만 하루 3회). 결제 코드는 남김 |
| 1.5 하나로 제출 | 1.4 없이 푸시 · 위젯 · 실시간 현황 · 단축어를 1.5에 모두. 10/12 출시 |
| 서버 푸시 | APNs 직접(FCM 안 씀), 활동은 10분 묶음, 기본 켜짐, 광고성 없음 |
| 위젯 단위 | 팩 하나 또는 가방 전체, 편집은 가방 → 팩 2단계, 보관함 가방 제외 |
| 위젯 시각 | "N분 전" 대신 "14시 05분에 새로고침", 자동 새로고침은 30분 안전망 |
| 위젯 열 수(10/12) | 중간 · 크게 1/2열(기본 2열), 작게 1열. "외 N개" 줄 없앰 |
| 잠금화면 배경 · 글자색(10/12) | 배경 "직접" 불투명도 0%까지, 글자색 자동 · 흰색 · 검정 · 직접 |
| 실시간 현황 8시간 | 단축어 "잠금화면 다시 띄우기" + 사용자 자동화(0 · 8 · 16시) |
| 개인 잠금(10/12) | PIN 4/6자리 + Face ID 옵션, 나만 잠김(멤버 영향 없음), 앱을 떠나면 다시 잠김, 화면 가림이지 암호화 아님 |
| 공유 링크(10/12) | 카톡 등 앱 안 브라우저 → 아이폰은 앱, 안드로이드는 기본 브라우저. 유니버설 링크는 초대 · `/v/*`만(짧은 URL 제외) |
| Siri · Spotlight(10/12) | 가방 · 가방 속 팩 · 보관함 팩 색인. 보관함 팩은 A안(앱이 열려 있을 때 웹이 넘김, 서버 비용 없음). App Schema는 안 씀 |
| 프로젝트 위치 | `~/Desktop/packinbag.nosync`, 비밀 파일 `_secrets/` |
| 문서(10/13) | 원본은 저장소 `docs/`. Claude 프로젝트 파일은 사본 → 고치면 다시 올림 |

**앞으로 코드를 고칠 때 지킬 규칙(추가)**
- 네이티브(위젯 · 단축어 · 실시간 현황 · 검색)가 읽는 요약 모양은 `lib/nativeSummary.ts` ↔ `ios/App/Shared/PIBShared.swift` ↔ `functions/src/live.ts`(content-state)가 같아야 한다. 보관함 `library`는 웹만 넣는다
- 웹에 올린 코드는 스토어의 예전 iOS 앱에도 뜬다 → 네이티브 기능은 `isNativeBridgeAvailable` · `isServerPushAvailable` · `isLocalNotificationsAvailable`일 때만
- `packinbag://` · 유니버설 링크 처리는 `lib/v2/bagReminders.onBagNotificationTap` 한 곳
- 개인 잠금 설정은 `users/{uid}.privateLock`에만. 잠근 것은 네이티브 요약에서 뺀다
- `UserProfile` 새 필드는 AuthProvider 구독 매핑에도
- Xcode는 App · 위젯 두 타깃의 Version · Build를 같이 올린다
- 잠금화면 실시간 현황 카드는 160pt 안
