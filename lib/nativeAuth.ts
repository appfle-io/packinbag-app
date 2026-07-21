// 구글/애플 로그인의 "네이티브 앱이냐 웹이냐" 분기를 이 파일 하나에 모아둔다.
// 이유: WKWebView(Capacitor iOS 앱) 안에서는 구글이 정책적으로 signInWithPopup을
// 막기 때문에(APP_STORE_GUIDE.md 0.5번 참고), 네이티브에서는 @capgo/capacitor-social-login
// 플러그인으로 OS 네이티브 로그인 창을 띄우고 idToken만 받아서 Firebase에 넘겨야 한다.
//
// ⚠️ Google 쪽 2개(webClientId, iOSClientId)는 채워졌고, Apple 쪽 clientId만 Apple Developer
// Program 승인 후 채워야 한다. 이 상태에서도 웹에서는 100% 정상 동작하고
// (isNativePlatform()이 false라 이 파일의 네이티브 분기를 안 타므로) 네이티브 앱에서만
// Apple 로그인 시 에러가 난다. Apple clientId를 채운 뒤 네이티브 빌드에서 테스트해야 한다.
//
// ⚠️ SocialLogin.initialize/login의 정확한 옵션 타입은 패키지를 실제로 설치해서
// Xcode 연동 테스트를 해봐야 확실히 맞출 수 있어서, 지금은 `as never` 캐스팅으로
// 타입 체크를 느슨하게 열어뒀다 (런타임 동작 자체는 공식 문서 예제 그대로다).
// 맥에서 실제 연동할 때 SocialLogin.initialize/login에 자동완성(IntelliSense)으로
// 뜨는 정확한 필드명과 대조해서 필요하면 고쳐야 한다.
"use client";

import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

let initialized = false;

// 앱 전체에서 한 번만 초기화하면 되므로, 첫 로그인 시도 시점에 lazy하게 한 번만 호출한다.
async function ensureInitialized() {
  if (initialized) return;
  await SocialLogin.initialize({
    google: {
      // TODO(맥 작업 시): Google Cloud Console에서 만든 "웹 클라이언트 ID"를 넣는다.
      // (Firebase 콘솔 > Authentication > Sign-in method > Google > 웹 SDK 구성에서
      //  이미 만들어진 웹 클라이언트 ID를 그대로 재사용하면 됨 - 새로 만들 필요 없음)
      webClientId: "510272302140-imuo8to374dntglgdu61e1a7e2bap55g.apps.googleusercontent.com",
      // TODO(맥 작업 시): Xcode에서 GoogleService-Info.plist를 추가하면 거기 있는
      // REVERSED_CLIENT_ID의 원래 값(CLIENT_ID)을 넣는다.
      iOSClientId: "510272302140-fng4e9vd6e5h10s7sim87ua7bchhiajr.apps.googleusercontent.com",
      mode: "online",
    },
    apple: {
      // TODO(맥 작업 시): Apple Developer > Identifiers에서 만든 Service ID.
      // iOS 네이티브 로그인은 앱의 Bundle ID(com.appfle.packinbag)를 자동으로 쓰므로
      // 이 clientId는 주로 웹/Android 경로에서 쓰인다. 비워두면 iOS 네이티브 로그인
      // 자체는 동작할 수 있으나, 정확한 값은 실제 Apple Developer 설정 후 채워야 한다.
      clientId: "TODO_APPLE_SERVICE_ID",
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  initialized = true;
}

// 반환값: Firebase의 GoogleAuthProvider.credential(idToken)에 바로 넘길 수 있는 idToken
export async function nativeGoogleIdToken(): Promise<string> {
  await ensureInitialized();
  const res = await SocialLogin.login({
    provider: "google",
    options: { scopes: ["profile", "email"] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  const result = (res as { result?: { idToken?: string } })?.result;
  const idToken = result?.idToken;
  if (!idToken) {
    throw new Error("구글 로그인에서 idToken을 받지 못했어요");
  }
  return idToken;
}

// 반환값: Firebase의 OAuthProvider('apple.com').credential({ idToken })에 넘길 수 있는 idToken
export async function nativeAppleIdToken(): Promise<{ idToken: string; rawNonce?: string }> {
  await ensureInitialized();
  const res = await SocialLogin.login({
    provider: "apple",
    options: { scopes: ["email", "name"] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  const result = (res as { result?: { idToken?: string; nonce?: string } })?.result;
  if (!result?.idToken) {
    throw new Error("애플 로그인에서 idToken을 받지 못했어요");
  }
  return { idToken: result.idToken, rawNonce: result.nonce };
}
