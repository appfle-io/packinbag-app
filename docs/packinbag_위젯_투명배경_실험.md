# 홈 화면 위젯 투명 배경 실험 (2026-10-18)

## 결론

- **보류(1.8에 안 넣음).** 사유: Apple WidgetKit 공개 사양에서 위젯 바탕이 지워지고 유리가 깔리는 것은 사용자가 홈 화면을 **투명(Clear) · 색조(Tinted)** 로 바꿨을 때(`.accented`)뿐이다. **기본 홈 화면(`.fullColor`)에서 위젯이 스스로 배경화면을 비치게 하는 공개 API는 없다**(문서 · Apple 포럼 답변 · 실험 19가지 모두 같은 결과). `containerBackground`에 투명을 주면 시스템 바탕(검정)이 보이는 것이 정상 동작
- 우리 위젯은 `containerBackground(for: .widget)`를 쓰므로 홈 화면이 투명 · 색조 모드면 시스템이 알아서 유리로 바꾼다(실기기 확인은 QA때)
- 포토위젯이 기본 모드에서 투명하게 보이는 방법은 확인하지 못했다(아래 "관찰"). 공개 문서에 없는 동작을 따라 하지 않는다(심사 · iOS 업데이트 위험, 결제 기능이 깨질 수 있음)
  - "포토위젯이 위젯만 투명 모드(`.accented`)로 바꾼다"는 의견도 있었지만, 투명 · 색조는 홈 화면 전체 설정이고 위젯 하나가 고를 수 있는 공개 방법은 없다. 같은 화면의 달력 위젯은 흰 바탕, 하트 이모지는 파랑이라 타당하지 않음(흰 글자는 앱에서 고른 글자색으로 보임)
- 다시 하게 되면 프리미엄 전용(10/18 사용자 결정), 북마크 위젯 배경 종류로. Apple이 공개 API를 내거나 실제 동작 코드(공개 방법)를 찾으면 그때. DTS 문의는 하지 않기로 함(맨 아래 문구는 참고용으로 남김)
- 실험 코드 · 설정은 모두 되돌림(커밋 안 함)

## 관찰 — 포토위젯

- 기기: iPhone, iOS 27, 홈 화면 **기본** 모드(같은 화면의 달력 위젯은 흰 바탕, 앱 아이콘 · 이모지는 원래 색 → `.accented` 아님)
- 포토위젯 디데이 위젯: 바탕 없이 배경화면이 보이고 가장자리에 유리 테두리(Liquid Glass 느낌)
- 배경화면을 단색 → 사진으로 바꿔도 위젯 자리에 새 배경화면이 정확히 이어짐 → 배경화면 스크린샷을 잘라 까는 "가짜 투명"이 **아님**
- 앱 편집 화면의 배경색 "없음(⊘)"을 고르면 미리 보기가 체크무늬
- 홈 화면에서 위젯을 길게 눌러 "위젯 편집"을 열고 아무것도 안 바꾼 채 완료하면, **잠깐 흰 바탕 → 투명**으로 바뀜(10/18 사용자 확인). 흰 바탕은 위젯을 다시 그리는 동안 시스템이 깔아 두는 자리로 보이고, 그리기가 끝난 뒤 투명해짐 → 위젯이 그려 내는 내용 쪽에서 바탕을 없애는 무언가가 있음. 문서에 없는 방법(비공개 · 밑줄 API 등)일 가능성이 더 커짐. 다른 앱 바이너리를 뜯어 보는 건 하지 않음
- 참고: OneWidget · WidgetLoft 등 다른 스토어 앱도 iOS 26 이상에서 "투명 · Liquid Glass" 위젯을 내세움(배경 맞추기와 별개 옵션)

## 시도한 방법 (실기기, 기본 모드 홈 화면, 작게 위젯)

| # | 방법 | 결과 |
|---|---|---|
| 1 | `.containerBackground(for: .widget) { Color.clear }` | 검정 |
| 2 | `.containerBackground(.clear, for: .widget)` (스타일 버전) | 검정 |
| 3 | `containerBackground` 안에 `Rectangle().fill(.clear).glassEffect(.clear, in: ContainerRelativeShape())` | 검정 |
| 4 | 3과 같고 `.glassEffect(.regular, …)` | 검정 |
| 5 | `.containerBackground(.ultraThinMaterial, for: .widget)` | 약간 회색(배경화면 안 비침) |
| 6 | `.contentMarginsDisabled()` + 내용에 `.glassEffect(.clear, in: ContainerRelativeShape())`, 바탕 `Color.clear` | 글자까지 안 보이는 완전 검정(그리기 실패) |
| 7 | 6과 같고 `.glassEffect(.regular, …)` | 완전 검정 |
| 8 | 6과 같고 바탕 `.clear` 스타일 | 완전 검정 |
| 9 | `containerBackground`를 부르지 않음 | "Please adopt containerBackground API" 안내 |
| 10 | `{ Color.black.opacity(0.001) }` | 검정 |
| 11 | `{ Color.white.opacity(0.01) }` | 검정 |
| 12 | `{ Image(uiImage: 알파 0인 4×4 UIImage).resizable() }` | 검정 |
| 13 | `{ EmptyView() }` | 검정 |
| 14 | `.containerBackgroundRemovable(false)` + `{ Color.clear }` | 검정 |
| 15 | 위젯 확장 `WidgetBackground` 색(빌드 설정 `ASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME`, 원래 값 비어 있음)을 알파 0으로 + `{ Color.clear }` | 검정 |
| 16 | 15와 같고 바탕을 `{ Color("WidgetBackground") }`(알파 0) | 검정 |
| 17 | 15 · 16 + 위젯 확장 `IPHONEOS_DEPLOYMENT_TARGET` 17.0 → 26.0(Clean Build, 위젯 지웠다 다시 추가) | 검정 |
| 18 | **앱 본체 · 위젯 확장 모두** 배포 타깃 26.0 + WidgetConfiguration에 `.contentMarginsDisabled()` + 글자만 있는 뷰 + `{ Color.clear }`(외부 제안 그대로) | 안 됨 |
| 19 | (10/19) 포토위젯 흐름 그대로: 앱 위젯 꾸미기에 배경 "배경 제거"(미리 보기 체크무늬) 저장 → 위젯 추가 → 위젯 편집에서 그 꾸미기 선택. 바탕은 알파 0 PNG(`pngData`로 만든 이미지) `Image(uiImage:).resizable()` | 안 됨(되돌림) |

- 1~5 · 9~14는 글자가 보였고 렌더링 모드는 `fullColor`(위젯 안에 `@Environment(\.widgetRenderingMode)` 표시)
- 6~8: 위젯에서 내용에 `glassEffect`를 쓰면 렌더링 자체가 안 되는 것으로 보임
- 실험 위젯은 "투명 실험 1~5 · A · B"로 `PackInBagWidget.swift` 끝에 임시로 넣었다가 모두 되돌림. 15~18의 colorset · 배포 타깃도 원래대로(값 없는 universal · 앱 15.6 · 위젯 17.0)
- 프로젝트 설정 참고: App 타깃 배포 타깃 15.6, 위젯 확장 17.0(위젯은 확장 타깃 기준). Xcode 27 SDK로 빌드, 기기 iOS 27

## 조사한 자료

- 검토한 가설(외부 의견, 10/18)
  - "앱 본체 배포 타깃(15.6)이 낮아 레거시 모드로 검정 백플레이트" → 근거 없음. 포토위젯 앱은 App Store에 **iOS 16.0 이상**으로 나와 있는데도 투명. 실험 17(위젯 26.0) · 18(앱 · 위젯 26.0)도 안 됨
  - "`.contentMarginsDisabled()`를 WidgetConfiguration에" → 6~8에서 이미 WidgetConfiguration에 붙였음. 여백은 바탕색과 무관
  - "뷰에 glassEffect 없이 `containerBackground { Color.clear }`" → 실험 1과 같음(검정)
  - "WidgetBackground 색 설정" → 실험 15 · 16(검정)
  - "모두 배경화면 스크린샷 잘라 깔기" → 배경화면을 바꿔도 이어져서 포토위젯은 아님

- `widgetTexture(.glass / .paper)`: visionOS 26 전용(iOS 없음)
- Apple 개발자 포럼: 같은 질문(iOS 27, `Color.clear` · `EmptyView` · `containerBackgroundRemovable(true)` · 유리 조합 모두 기본 모드에서 안 비침, 다른 앱은 되는 것 같다)에 답 없음. 다른 글의 Apple 답변은 "유리는 홈 화면이 투명 모드일 때만, 렌더링 모드에 맞춰 디자인하라"
- WWDC25 "What's new in widgets": 투명 · 색조 모드에서 시스템이 내용을 흰색으로 칠하고 바탕을 지우고 유리 · 색을 깐다

## 남은 선택지

- **A. DTS 문의**(아래 문구) → 공개 API가 있으면 1.8 이후에 "유리" 배경 추가
- **B. 배경화면 맞추기**: 빈 홈 화면 스크린샷 + 위젯 자리 → 그 조각을 사진 배경으로. 기종별 위젯 위치 표 필요, 배경화면 · 위치가 바뀌면 다시 해야 함
- **C. 지금처럼**: 홈 화면을 투명 · 색조 모드로 쓰는 사람에게만 투명(실기기 확인 필요). 위젯 꾸미기에 안내 한 줄 정도

## DTS 문의 문구 (참고용 — 보내지 않기로 함)

접수: https://developer.apple.com/support/technical/ → Request Technical Support

```
Subject: Transparent Home Screen widget background in .fullColor rendering mode (iOS 27)

On iOS 27 with the Home Screen set to the Default appearance, some third-party
widgets on the App Store render with a genuinely transparent container: the actual
wallpaper shows through (verified by changing the wallpaper), with a Liquid Glass
style rim, while the system Calendar widget next to them renders with its normal
opaque background.

In our widget (WidgetKit, AppIntentConfiguration, systemSmall), with the rendering
mode logged as .fullColor, every approach below shows a black background instead:
- containerBackground(for: .widget) { Color.clear } / { EmptyView() } / .clear style
- Color.black.opacity(0.001), Color.white.opacity(0.01), a fully transparent UIImage
- Rectangle().fill(.clear).glassEffect(.clear / .regular, in: ContainerRelativeShape())
  inside containerBackground
- glassEffect on the content with contentMarginsDisabled() (renders nothing)
- .ultraThinMaterial (gray), containerBackgroundRemovable(false) + clear

Question: Is there a supported public API that lets a Home Screen widget show the
wallpaper behind it in the Default (.fullColor) appearance? If transparency is only
supported in the Clear/Tinted (.accented) appearance, please confirm.
```
