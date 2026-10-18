import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: process.env.NEXT_STANDALONE === "true" ? "standalone" : undefined,
  turbopack: {
    root: __dirname,
  },
  // firebase-admin이 물고 있는 jwks-rsa -> jose 패키지 체인이 ESM/CJS 혼용이라,
  // Next가 서버 코드를 번들링(트레이싱)할 때 ERR_REQUIRE_ESM 오류가 난다.
  // firebase-admin은 번들링 대상에서 빼고 Node가 node_modules에서 직접 require하게 한다.
  serverExternalPackages: ["firebase-admin"],
  async headers() {
    return [
      {
        // 팩인백 화면은 같은 주소(예: /about의 체험 화면)에서만 다른 페이지 안에 띄울 수 있다.
        // 다른 사이트가 가져다 띄워 누르기를 속이는 것(클릭재킹)을 막는다(2026-10-18, offline.md OFF-DEMO-08)
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
