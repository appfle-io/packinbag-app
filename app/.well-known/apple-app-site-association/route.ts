import { NextResponse } from "next/server";

// 유니버설 링크(2026-10-12): 이 주소를 누르면 사파리 대신 팩인백 앱이 바로 열린다(메시지 · 메모 · 사파리 등).
// 앱 쪽은 1.6 빌드에서 Associated Domains(applinks:packinbag.seeuson.com)를 켜야 동작한다. 그 전에는 이 파일만 있어도 아무 일 없음.
// - 초대 링크(/?invite=코드)와 게스트 보기(/v/…)만. 짧은 URL(/s, /c)은 다른 사이트로 가는 링크도 있어서 넣지 않는다
// - 카톡 안 브라우저는 유니버설 링크를 무시해서 lib/v2/appBridge(packinbag://open)가 따로 맡는다
// - 앱에서 받은 주소 처리: lib/v2/bagReminders.ts onBagNotificationTap(fromUrl)
export const dynamic = "force-static";

const APP_ID = "2ZHYLWBV2H.com.appfle.packinbag";

export function GET() {
  return NextResponse.json(
    {
      applinks: {
        details: [
          {
            appIDs: [APP_ID],
            components: [
              { "/": "/", "?": { invite: "?*" }, comment: "초대 링크" },
              { "/": "/v/*", comment: "게스트 보기 · 초대 포함 링크" },
            ],
          },
        ],
      },
      webcredentials: { apps: [APP_ID] },
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
