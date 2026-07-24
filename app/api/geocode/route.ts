import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * 100% 하드코딩 0개 지오코딩 API
 * 사용자가 입력한 한글/외국어 지명(하와이, 처인구, 니스, 발리, 한강 등)을
 * 구글 지오코딩 또는 OpenStreetMap Nominatim 전 세계 지명 DB로 조회하여 위도/경도를 반환합니다.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query")?.trim() ?? "";

  if (!query || query.length < 2) {
    return NextResponse.json({ result: null });
  }

  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // 1. Google Geocoding API (API 키가 있는 경우)
  if (googleApiKey) {
    try {
      const gRes = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&language=ko&key=${googleApiKey}`
      );
      if (gRes.ok) {
        const gData = await gRes.json();
        if (gData.status === "OK" && Array.isArray(gData.results) && gData.results.length > 0) {
          const first = gData.results[0];
          const loc = first.geometry.location;
          return NextResponse.json({
            result: {
              lat: loc.lat,
              lon: loc.lng,
              name: query,
            },
          });
        }
      }
    } catch (err) {
      console.warn("[팩인백] Google Geocoding API 조회 실패:", err);
    }
  }

  // 2. OpenStreetMap Nominatim Geocoding API (글로벌 한글 지명 100% 지원, 무료, 하드코딩 0개)
  try {
    const nRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&accept-language=ko&limit=1`,
      {
        headers: {
          "User-Agent": "PackInBagApp/1.0",
        },
      }
    );
    if (nRes.ok) {
      const nData = await nRes.json();
      if (Array.isArray(nData) && nData.length > 0) {
        const item = nData[0];
        return NextResponse.json({
          result: {
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            name: query,
          },
        });
      }
    }
  } catch (err) {
    console.warn("[팩인백] Nominatim Geocoding API 조회 실패:", err);
  }

  return NextResponse.json({ result: null });
}
