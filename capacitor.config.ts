import type { CapacitorConfig } from "@capacitor/cli";

// ⚠️ 아래 두 값은 반드시 실제 값으로 바꿔야 합니다. (APP_STORE_GUIDE.md 참고)
//
// appId       : 앱의 고유 식별자 (Bundle Identifier). 전 세계에서 유일해야 하며
//               한번 등록하면 절대 바꿀 수 없습니다. 보통 "com.회사명.앱이름" 형식.
//               예: "com.appfle.packinbag"
//
// server.url  : Vercel에 배포된 실제 서비스 주소.
//               이 값이 있으면 앱은 이 주소를 그대로 불러와서 보여줍니다.
//               즉, 웹사이트를 업데이트하면 앱스토어 재심사 없이 앱 내용도 함께 업데이트됩니다.
const config: CapacitorConfig = {
  appId: "com.appfle.packinbag",
  appName: "팩인백",
  webDir: "public", // server.url을 쓰는 동안은 실제로 사용되지 않는 더미 폴더입니다.
  server: {
    url: "https://packinbag.seeuson.com",
    cleartext: false,
  },
  ios: {
    contentInset: "never",
    // Firebase Auth 팝업(구글 로그인 등)이 새 창으로 뜨는 걸 앱 안에서 자연스럽게 처리하기 위한 설정
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#ffffff",
      androidSpinnerStyle: "large",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
    },
  },
};

export default config;
