export interface WeatherInfo {
  city: string;
  weatherText: string;
  tempMin: number;
  tempMax: number;
  hasRain: boolean;
  isCold: boolean;
  isHot: boolean;
  recommendations: { text: string; icon: string }[];
}

/**
 * 100% 하드코딩 0개 지오코딩 서비스
 * 서버 전용 /api/geocode (Google Geocoding & Nominatim)를 호출하여
 * 사용자가 입력한 전 세계 어떤 한글/영문 지명이든 100% 자동 인식해 위도/경도를 찾아냅니다.
 * 사전 맵이나 하드코딩 배열이 단 1개도 존재하지 않습니다.
 */
export async function resolveCityInfo(text: string): Promise<{ lat: number; lon: number; name: string } | null> {
  if (!text) return null;
  const clean = text.trim();
  if (clean.length < 2) return null;

  // 띄어쓰기 및 특수문자 기준 단어 추출 (2글자 이상)
  const words = clean
    .split(/[\s,./_~!?()-]+/)
    .filter((w) => w.length >= 2)
    .sort((a, b) => b.length - a.length);

  for (const word of words) {
    try {
      const res = await fetch(`/api/geocode?query=${encodeURIComponent(word)}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.result) {
        return {
          lat: data.result.lat,
          lon: data.result.lon,
          name: word,
        };
      }
    } catch (err) {
      console.warn("[팩인백] 지오코딩 연동 예외:", err);
    }
  }

  return null;
}

export async function fetchWeatherForCity(lat: number, lon: number, cityName: string): Promise<WeatherInfo | null> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const daily = data?.daily;
    if (!daily || !daily.weathercode) return null;

    const weatherCode = daily.weathercode[0] ?? 0;
    const tempMax = Math.round(daily.temperature_2m_max[0] ?? 20);
    const tempMin = Math.round(daily.temperature_2m_min[0] ?? 10);

    const hasRain = (weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82);
    const hasSnow = (weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 85 && weatherCode <= 86);
    const isCold = tempMin <= 8;
    const isHot = tempMax >= 28;

    let weatherText = "맑음 ☀️";
    if (hasRain) weatherText = "비 소식 ☔";
    else if (hasSnow) weatherText = "눈 소식 ❄️";
    else if (weatherCode >= 1 && weatherCode <= 3) weatherText = "구름 약간 ⛅";
    else if (weatherCode >= 45) weatherText = "안개/흐림 🌫️";

    const recommendations: { text: string; icon: string }[] = [];
    if (hasRain) {
      recommendations.push({ text: "우산 / 방수팩", icon: "🌂" });
    }
    if (hasSnow || isCold) {
      recommendations.push({ text: "경량패딩 / 핫팩", icon: "🧥" });
      recommendations.push({ text: "따뜻한 보온병", icon: "☕" });
    }
    if (isHot) {
      recommendations.push({ text: "선글라스 / 모자", icon: "🕶️" });
      recommendations.push({ text: "자외선 차단제 (선크림)", icon: "🧴" });
      recommendations.push({ text: "손풍기 / 부채", icon: "🌬️" });
    }
    if (recommendations.length === 0) {
      recommendations.push({ text: "편안한 산책화", icon: "👟" });
      recommendations.push({ text: "보조배터리", icon: "🔋" });
    }

    return {
      city: cityName,
      weatherText,
      tempMin,
      tempMax,
      hasRain,
      isCold,
      isHot,
      recommendations,
    };
  } catch (err) {
    console.error("[팩인백] 날씨 조회 실패:", err);
    return null;
  }
}

export type TravelRecommendationCategory = "attraction" | "food" | "specialty";

export interface TravelRecommendation {
  category: TravelRecommendationCategory;
  text: string;
  desc: string;
  icon: string;
}

// 도시명 기준으로만 추천을 받는다(가방 제목 전체가 아니라) - 서버(app/api/ai-travel-places)가
// 도시명으로 캐시하기 때문에, 같은 도시면 가방 제목이 바뀌어도 같은 결과를 재사용할 수 있다.
export async function fetchAiTravelPlaces(
  cityName: string,
  idToken: string
): Promise<TravelRecommendation[]> {
  try {
    const res = await fetch("/api/ai-travel-places", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        cityName,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.places || [];
  } catch (err) {
    console.error("[팩인백] AI 추천 여행지 API 연동 실패:", err);
    return [];
  }
}
