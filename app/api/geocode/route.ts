import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * 100% 하드코딩 0개 지오코딩 API
 * 사용자가 입력한 한글/외국어 지명(하와이, 처인구, 니스, 발리, 한강 등)을
 * 구글 지오코딩 또는 OpenStreetMap Nominatim 전 세계 지명 DB로 조회하여 위도/경도를 반환합니다.
 *
 * 중요: Google/Nominatim은 주소뿐 아니라 상호명/상점/랜드마크 등 "장소" 전반을 매칭하기 때문에,
 * "가방"처럼 흔한 일반명사가 어딘가의 가게 이름 등과 우연히 매칭되어 엉뚱한 위치가 뜨는 오탐이
 * 있었다. 그래서 결과 타입을 실제 행정구역/지명(도시·국가·지역 등)으로만 한정해서 받아들인다.
 */

// Google Geocoding 결과의 types 배열 중, "진짜 지명"으로 인정할 카테고리만 화이트리스트로 둔다.
// establishment/point_of_interest/store 등 상호명·시설 매칭은 여기 없으므로 자동으로 걸러진다.
const GOOGLE_PLACE_TYPES = new Set([
  "country",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "administrative_area_level_3",
  "administrative_area_level_4",
  "administrative_area_level_5",
  "locality",
  "sublocality",
  "sublocality_level_1",
  "postal_town",
  "colloquial_area",
  "natural_feature",
  "continent",
]);

// Nominatim 결과의 class/type 조합 중 실제 지명(행정구역/자연지형)으로 인정할 것만 허용한다.
// shop/amenity/office/leisure 등 상점·시설 매칭은 제외된다.
const NOMINATIM_PLACE_CLASSES = new Set(["place", "boundary", "natural"]);
// Nominatim importance는 검색 결과의 "유명도" 점수(0~1) - 너무 낮으면 사실상 무관한 매칭일
// 가능성이 높아 걸러낸다.
const NOMINATIM_MIN_IMPORTANCE = 0.25;

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
          const placeResult = gData.results.find(
            (r: any) => Array.isArray(r.types) && r.types.some((t: string) => GOOGLE_PLACE_TYPES.has(t))
          );
          if (placeResult) {
            const loc = placeResult.geometry.location;
            return NextResponse.json({
              result: {
                lat: loc.lat,
                lon: loc.lng,
                name: query,
              },
            });
          }
          // 결과는 있었지만 전부 상호명/시설 매칭이라 지명으로 인정하지 않음 -> Nominatim으로 폴백.
        }
      }
    } catch (err) {
      console.warn("[팩인백] Google Geocoding API 조회 실패:", err);
    }
  }

  // 2. OpenStreetMap Nominatim Geocoding API (글로벌 한글 지명 100% 지원, 무료, 하드코딩 0개)
  try {
    const nRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&accept-language=ko&limit=5`,
      {
        headers: {
          "User-Agent": "PackInBagApp/1.0",
        },
      }
    );
    if (nRes.ok) {
      const nData = await nRes.json();
      if (Array.isArray(nData) && nData.length > 0) {
        const placeItem = nData.find(
          (item: any) =>
            NOMINATIM_PLACE_CLASSES.has(item.class) &&
            parseFloat(item.importance ?? "0") >= NOMINATIM_MIN_IMPORTANCE
        );
        if (placeItem) {
          return NextResponse.json({
            result: {
              lat: parseFloat(placeItem.lat),
              lon: parseFloat(placeItem.lon),
              name: query,
            },
          });
        }
      }
    }
  } catch (err) {
    console.warn("[팩인백] Nominatim Geocoding API 조회 실패:", err);
  }

  return NextResponse.json({ result: null });
}
