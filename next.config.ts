import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // firebase-admin이 물고 있는 jwks-rsa -> jose 패키지 체인이 ESM/CJS 혼용이라,
  // Next가 서버 코드를 번들링(트레이싱)할 때 ERR_REQUIRE_ESM 오류가 난다.
  // firebase-admin은 번들링 대상에서 빼고 Node가 node_modules에서 직접 require하게 한다.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
