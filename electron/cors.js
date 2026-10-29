// 포터블 화면(http://127.0.0.1:포트)이 운영 API · Storage를 부를 수 있게 그 응답에만 CORS 헤더를 붙인다(2026-10-22).
// 예전에는 webSecurity: false로 동일 출처 정책을 통째로 껐다(9/21 254ad96) → 필요한 두 곳만 열고 webSecurity는 켠다
// (_secrets/docs/packinbag_security_review.md SEC-APP-03)
const CORS_HOST_PATTERNS = ["https://packinbag.seeuson.com/*", "https://firebasestorage.googleapis.com/*"];
let corsInstalled = false;

function allowRemoteCors(ses, appOrigin) {
  if (corsInstalled) return;
  corsInstalled = true;
  ses.webRequest.onHeadersReceived({ urls: CORS_HOST_PATTERNS }, (details, callback) => {
    // 서버가 준 CORS 헤더(Expose-Headers 등, Storage 업로드가 읽음)는 두고, 출처만 이 앱으로 · 없는 것만 채운다
    const headers = {};
    const has = {};
    for (const [key, value] of Object.entries(details.responseHeaders || {})) {
      const lower = key.toLowerCase();
      if (lower === "access-control-allow-origin") continue;
      headers[key] = value;
      has[lower] = true;
    }
    headers["Access-Control-Allow-Origin"] = [appOrigin];
    if (!has["access-control-allow-methods"]) headers["Access-Control-Allow-Methods"] = ["GET, POST, PUT, PATCH, DELETE, OPTIONS"];
    // *는 Authorization을 포함하지 않아 따로 적는다(쿠키를 안 보내는 요청이라 * 허용)
    if (!has["access-control-allow-headers"]) headers["Access-Control-Allow-Headers"] = ["*, Authorization"];
    // 사전 요청(OPTIONS)은 서버 응답 코드와 상관없이 통과시킨다(본 요청에서 서버가 다시 인증을 본다)
    if (details.method === "OPTIONS") {
      callback({ responseHeaders: headers, statusLine: "HTTP/1.1 204 No Content" });
      return;
    }
    callback({ responseHeaders: headers });
  });
}

module.exports = { allowRemoteCors, CORS_HOST_PATTERNS };
