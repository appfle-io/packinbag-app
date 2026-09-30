// 리디자인 v2 화면 전환 플래그. 개발 중에는 .env.local에 NEXT_PUBLIC_UI_V2=true 를 넣어 새 화면을 켠다.
// 출시 시점에 구 UI를 지우면서 이 플래그도 함께 제거한다.
export const UI_V2 = process.env.NEXT_PUBLIC_UI_V2 === "true";
