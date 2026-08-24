// 서버(API 라우트)에서만 import해야 하는 파일. Resend(https://resend.com) REST API를
// fetch로 직접 호출한다 - 별도 SDK(resend npm 패키지) 설치 없이 API 키만 있으면 되도록
// 최소 의존성으로 구현했다.
//
// 이 함수는 "성공 아니면 예외"만 지키면 된다. 실패 시 폴백(Firebase 기본 발송)은
// 호출부(app/api/send-verification-email, lib/emailVerification.ts)의 책임이라
// 여기서는 별도 재시도/폴백 로직을 갖지 않는다.
const RESEND_API_URL = "https://api.resend.com/emails";

// 이메일 인증 개선 계획 문서에서 정한 발신 주소. seeuson.com 도메인에 SPF/DKIM/DMARC가
// Resend 대시보드 기준으로 등록되어 있어야 스팸함으로 안 가는 효과를 볼 수 있다.
const VERIFICATION_FROM = "팩인백 <noreply-packinbag@seeuson.com>";

export async function sendVerificationEmailViaResend(to: string, verifyLink: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // 로컬 개발 등 API 키가 아예 없는 환경 - 예외를 던져서 호출부가 Firebase 기본
    // 발송으로 폴백하게 한다.
    throw new Error("RESEND_API_KEY 환경변수가 설정되어 있지 않아요");
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: VERIFICATION_FROM,
      to,
      subject: "[팩인백] 이메일 주소를 인증해주세요",
      html: buildVerificationEmailHtml(verifyLink),
    }),
  });

  if (!res.ok) {
    // 429(쿼터 초과), 401(키 문제), 403(도메인 미인증) 등 - 원인 문자열을 그대로
    // 로그에 남겨서 호출부 콘솔에서 바로 원인을 알 수 있게 한다.
    const bodyText = await res.text().catch(() => "");
    throw new Error(`Resend API 오류 (HTTP ${res.status}): ${bodyText}`);
  }
}

// 브랜드 색상(lib/brandColor.ts의 BRAND_ICON_BG)과 맞춘 심플한 트랜잭션 메일 템플릿.
// 이메일 클라이언트(특히 Outlook) 호환을 위해 CSS는 전부 인라인으로 작성하고,
// 레이아웃은 <table> 기반으로 구성한다. 외부 이미지 없이 타이포그래피/색상만으로
// 만들어서 이미지 차단 설정에도 항상 온전하게 보인다.
function buildVerificationEmailHtml(verifyLink: string): string {
  const brand = "#FF6E2D";
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>팩인백 이메일 인증</title>
  </head>
  <body style="margin:0; padding:0; background-color:#F4F1EC; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <!-- 프리헤더: 받은편지함 미리보기에만 노출, 본문에는 안 보임 -->
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
      팩인백 이메일 인증을 완료하고 짐 싸기를 시작해보세요.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F1EC; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#FFFFFF; border-radius:16px; overflow:hidden;">
            <tr>
              <td style="background-color:${brand}; padding:28px 32px;">
                <span style="font-size:20px; font-weight:700; color:#FFFFFF; letter-spacing:-0.02em;">팩인백</span>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 8px;">
                <h1 style="margin:0 0 12px; font-size:20px; line-height:1.4; color:#1F1B16;">
                  이메일 주소를 인증해주세요
                </h1>
                <p style="margin:0 0 24px; font-size:15px; line-height:1.7; color:#5C554C;">
                  안녕하세요! 팩인백 가입을 완료하려면 아래 버튼을 눌러 이메일 인증을 마쳐주세요.
                  인증이 끝나면 바로 로그인해서 짐 싸기를 시작할 수 있어요.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;" align="center">
                <a href="${verifyLink}"
                  style="display:inline-block; width:100%; box-sizing:border-box; background-color:${brand}; color:#FFFFFF; font-size:16px; font-weight:700; text-decoration:none; text-align:center; padding:14px 0; border-radius:12px;">
                  이메일 인증하기
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;">
                <p style="margin:0 0 8px; font-size:13px; line-height:1.6; color:#948C80;">
                  버튼이 눌리지 않는다면 아래 링크를 브라우저 주소창에 붙여넣어주세요.
                </p>
                <p style="margin:0; font-size:13px; line-height:1.6; word-break:break-all;">
                  <a href="${verifyLink}" style="color:${brand};">${verifyLink}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px; background-color:#FAF8F4; border-top:1px solid #EFEAE1;">
                <p style="margin:0; font-size:12px; line-height:1.6; color:#A39A8C;">
                  본인이 요청하지 않았다면 이 메일은 무시하셔도 괜찮아요. 계정에는 아무 변화도 생기지 않습니다.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
