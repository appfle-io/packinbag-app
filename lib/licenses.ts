// 팩인백이 사용하는 주요 오픈소스 라이브러리 목록.
// package.json 의존성이 바뀔 때마다 함께 갱신해야 한다 (배포 직전 한 번 더 대조 권장).
export interface LicenseEntry {
  name: string;
  license: string;
  url: string;
}

export const OSS_LICENSES: LicenseEntry[] = [
  { name: "Next.js", license: "MIT", url: "https://github.com/vercel/next.js/blob/canary/license.md" },
  { name: "React", license: "MIT", url: "https://github.com/facebook/react/blob/main/LICENSE" },
  { name: "React DOM", license: "MIT", url: "https://github.com/facebook/react/blob/main/LICENSE" },
  { name: "Tailwind CSS", license: "MIT", url: "https://github.com/tailwindlabs/tailwindcss/blob/main/LICENSE" },
  { name: "Firebase JS SDK", license: "Apache License 2.0", url: "https://github.com/firebase/firebase-js-sdk/blob/main/LICENSE" },
  { name: "Capacitor", license: "MIT", url: "https://github.com/ionic-team/capacitor/blob/main/license" },
  { name: "Pretendard", license: "SIL Open Font License 1.1", url: "https://github.com/orioncactus/pretendard/blob/main/LICENSE" },
  { name: "D2Coding", license: "SIL Open Font License 1.1", url: "https://github.com/naver/d2codingfont/wiki/Open-Font-License" },
  { name: "Gaegu (개구)", license: "SIL Open Font License 1.1", url: "https://github.com/google/fonts/blob/main/ofl/gaegu/OFL.txt" },
  // 오픈소스는 아니지만 같은 화면에서 출처를 밝힌다(무료 상업 사용·앱 포함 허용, 글꼴 단독 재판매 금지)
  { name: "지마켓 산스 (Gmarket Sans)", license: "지마켓 무료 폰트 라이선스", url: "https://corp.gmarket.com/fonts/" },
  { name: "@tabler/icons-react", license: "MIT", url: "https://github.com/tabler/tabler-icons/blob/master/LICENSE" },
];
