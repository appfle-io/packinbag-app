# 소개 페이지 /about — about.md

기준 코드: v1.7.1 (2026-10-18). 체험 모드 자체(저장 · 막힘 · 안내 줄)는 `offline.md` OFF-DEMO, 다른 사이트 안 띄우기는 OFF-DEMO-08.

- 코드: `app/about/page.tsx`(본문) · `app/about/AboutTry.tsx`(써 보기) · `app/about/about.module.css`
- 영상: `public/about/packinbag-intro.mp4`(1280×720, 약 54초, 22MB)
- 목업: https://claude.ai/artifact/FezZTjcKsDRsoee1n7vQNW · 영상 원본: https://claude.ai/artifact/GQA9Wq8vn8jYdBbSdVJq1k

| ID | 규칙 |
|---|---|
| ABOUT-01 | 앱 테마와 상관없이 늘 밝은 화면. 앱이 body 스크롤을 막아 두어 페이지가 자기 스크롤 칸(100dvh)을 갖는다 |
| ABOUT-02 | 위 줄(따라 내려옴): 로고 · 써 보기 · 영상 · 쓰는 법 · 기능 · 요금(페이지 안 이동) · "앱 열기". 760px 이하는 [로고 · 앱 열기] 한 줄 + 그 아래 메뉴 한 줄(넘치면 가로로 밀기, 10/19). 본문 좌우 여백은 위 줄과 같다(`.wrap`) |
| ABOUT-03 | 앱으로 가는 링크(앱 열기 · 웹에서 시작하기)는 모두 `/?demo=0` — iframe과 페이지가 같은 탭 sessionStorage를 써서, 그냥 `/`로 가면 체험이 이어지기 때문 |
| ABOUT-04 | 써 보기(760px 넘을 때): 왼쪽 6단계(체크해 보기 · 팩 불러오기 · 빠른팩에 적기 · 가족이랑 같이 챙기기 · 메모도 같이 적기 · 다녀와서는 다시 싸기). 누르면 그 단계가 강조되고 무엇을 눌러 보면 되는지 안내가 펼쳐진다. **앱을 대신 조작하지 않는다** |
| ABOUT-05 | 오른쪽: 진짜 앱 iframe `/?demo=1`. "PC 화면"(폭 100% · 높이 720) / "휴대폰 화면"(390×780 테두리). "처음부터 다시" = iframe의 sessionStorage `pib_demo*`를 지우고 다시 열기 + 1단계로 |
| ABOUT-06 | 760px 이하: iframe을 띄우지 않고 "바로 써 보기"(같은 탭에서 `/?demo=1`) |
| ABOUT-07 | 영상(가운데, `AboutVideo`): 누를 때만 받는다(`preload="metadata"`, 자동 재생 없음, 소리 있음). 브라우저 기본 컨트롤 대신 직접 만든 컨트롤(멈춰 있으면 가운데 재생 버튼, 영상 누르면 멈춤, 아래 진행 막대 눌러 이동, 오른쪽 위 전체 화면) — Safari 기본 컨트롤이 재생 중 영상을 회색으로 덮어서(10/18) |
| ABOUT-08 | 그 밖의 섹션: 쓰는 법 3단계 · 기능 6개 + 그 밖의 기능 칩 · 아이폰 · 웹 · PC · 요금(FREE_LAUNCH 동안 "지금은 모든 기능이 무료예요", AI 하루 3번) · 마지막 안내 · 고객지원 · 개인정보 링크 |
| ABOUT-09 | (10/20) 맨 위 이벤트 줄: 오늘(한국 날짜) 진행 중 이벤트가 있으면 위 줄 위에 연두 띠 → 이벤트 공개 페이지(events.md EVT-WEB-05). 여러 개면 한 줄에 하나씩 최대 3줄, 줄마다 그 이벤트로(10/20 1.7.4). 그래서 /about은 5분 캐시(`revalidate 300`) — 예전엔 완전 정적 |

## 확인 필요

| # | 내용 |
|---|---|
| 1 | 요금표는 `FREE_LAUNCH`를 읽지 않고 글로 적어 두었다. 결제를 붙일 때 이 페이지 요금 섹션도 같이 고쳐야 한다 |
| 2 | 영상 22MB. 데이터가 아까우면 ffmpeg로 줄이기(`ffmpeg -i in.mp4 -c:v libx264 -crf 28 -preset slow -c:a aac -b:a 96k out.mp4`) |
