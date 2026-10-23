// 날씨 · 명소 추천(가방 더보기 > 날씨 · 명소 추천)에 쓰는 날씨 조회와 기본 추천. 서버 비용 없음(Open-Meteo는 무료 · 키 없음).
// 2026-10-20: 하루치(날씨 코드 · 기온)만 보던 것을 "조회한 날부터 3일"(오늘 · 내일 · 모레)로 바꾸고,
// 강수 확률 · 자외선 · 바람 · 체감 기온까지 받아 기본 추천을 이유와 함께 만든다. AI 추천은 app/api/ai-weather-recommend.

export interface WeatherDay {
  date: string; // YYYY-MM-DD(그 장소 시간대)
  label: string; // 오늘 · 내일 · 모레
  weatherText: string;
  tempMin: number;
  tempMax: number;
  feelsMin: number;
  feelsMax: number;
  // 0~100. 모르면 null
  rainProb: number | null;
  uvMax: number | null;
  // m/s
  windMax: number | null;
  hasRain: boolean;
  hasSnow: boolean;
}

export interface WeatherRecommendation {
  text: string;
  icon: string;
  // 왜 챙기면 좋은지 한 줄(2026-10-20, 예전 캐시에는 없음)
  reason?: string;
}

export interface WeatherInfo {
  city: string;
  // 아래 넷은 첫날(오늘) 기준. 빠진 것 확인 등 예전 코드가 그대로 읽는다
  weatherText: string;
  tempMin: number;
  tempMax: number;
  hasRain: boolean;
  isCold: boolean;
  isHot: boolean;
  recommendations: WeatherRecommendation[];
  // 받은 날짜(첫날, YYYY-MM-DD). 예전 캐시는 출발일 예보일이거나 없음
  forDate?: string;
  // 3일 예보(2026-10-20). 예전 캐시에는 없다
  days?: WeatherDay[];
}

// AI 추천 결과(app/api/ai-weather-recommend). 가방 캐시(aiRecommendCache.ai)에 그대로 둔다
export interface WeatherAiItem {
  text: string;
  reason: string;
}
export interface WeatherAiPlace {
  name: string;
  desc: string;
}
export interface WeatherAiResult {
  summary: string;
  items: WeatherAiItem[];
  places: WeatherAiPlace[];
  at: string; // ISO
}

// 라틴 알파벳만으로 이루어진 단어인지 확인. app/api/geocode/route.ts와 동일한 기준 -
// 실제 짧은 영문 지명(Nice, Bath 등)은 대부분 4글자 이상이라, 그보다 짧은 영문 단어는
// 이니셜/약어/상태라벨(DO, ING, AI, DB 등)일 확률이 훨씬 높다. 한글 등 다른 스크립트는
// "부산", "제주"처럼 2글자 지명이 흔해서 기존 기준(2글자)을 그대로 유지한다.
const isPureAsciiWord = (s: string) => /^[A-Za-z]+$/.test(s);

// 순수 숫자(또는 숫자+구두점만)로 된 토큰인지 확인. "2026", "07" 같은 날짜/버전 조각이
// Google 지오코딩에서 우편번호/지역코드 등으로 우연히 매칭돼 엉뚱한 나라(예: 프랑스)가
// 추천되는 오탐을 막기 위해, 지명 후보에서 아예 제외한다(2026-07 버그 수정).
const isNumericOnly = (s: string) => /^[0-9]+$/.test(s);

/**
 * 지오코딩 서비스 - 서버 전용 /api/geocode(Google Geocoding & Nominatim)를 호출하여
 * 사용자가 입력한 전 세계 어떤 한글/영문 지명이든 자동으로 위도/경도를 찾아낸다.
 * 사전 맵이나 하드코딩된 지명 목록은 존재하지 않는다.
 * whole: 직접 입력한 장소처럼 글 전체를 먼저 한 번 찾아본다(2026-10-20, "서귀포 중문" 같은 두 단어).
 *        서버에도 manual=1로 알려 기준을 낮추고 시 · 군 · 구를 붙여 다시 찾게 한다(2026-10-23)
 */
export async function resolveCityInfo(
  text: string,
  // /api/geocode는 로그인한 사람만 부를 수 있다(유료 API 보호, 2026-10-06). 없으면 서버가 401로 돌려보낸다
  idToken?: string,
  whole = false,
): Promise<{ lat: number; lon: number; name: string } | null> {
  if (!text) return null;
  const clean = text.trim();
  if (clean.length < 2) return null;

  // 띄어쓰기 및 특수문자 기준 단어 추출. 영문 단어는 4글자 이상, 그 외(한글 등)는
  // 2글자 이상만 지오코딩 후보로 인정한다(2026-07: "DO" 같은 칸반 상태라벨이 실제
  // 지명과 우연히 매칭되는 오탐 방지).
  // MAX_CANDIDATE_WORDS: 가방 이름이 아주 길어서 후보 단어가 많아져도(예: 문장형 이름),
  // 이름이 바뀔 때마다 순차 지오코딩 API 호출이 무한정 늘지 않도록 가장 긴 단어부터
  // 최대 4개까지만 시도한다(2026-07 비용 점검에서 추가).
  const MAX_CANDIDATE_WORDS = 4;
  const words = clean
    .split(/[\s,./_~!?()-]+/)
    .filter((w) => !isNumericOnly(w))
    .filter((w) => (isPureAsciiWord(w) ? w.length >= 4 : w.length >= 2))
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_CANDIDATE_WORDS);
  const candidates = whole && words.length > 1 ? [clean.slice(0, 40), ...words.slice(0, 3)] : words;

  for (const word of candidates) {
    try {
      const res = await fetch(`/api/geocode?query=${encodeURIComponent(word)}${whole ? "&manual=1" : ""}`, {
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
      });
      if (res.status === 401) return null;
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

const DAY_LABELS = ["오늘", "내일", "모레"];

function weatherTextOf(code: number): string {
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "비 소식";
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "눈 소식";
  if (code >= 95) return "뇌우";
  if (code === 45 || code === 48) return "안개";
  if (code === 3) return "흐림";
  if (code >= 1 && code <= 2) return "구름 조금";
  return "맑음";
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** 3일 예보로 기본 추천(이유 한 줄과 함께). 순수 함수 */
export function baseRecommendations(days: WeatherDay[]): WeatherRecommendation[] {
  const out: WeatherRecommendation[] = [];
  const add = (text: string, reason: string) => {
    if (!out.some((r) => r.text === text)) out.push({ text, icon: "", reason });
  };
  const rainDay = days.find((d) => d.hasRain || (d.rainProb ?? 0) >= 60);
  const maybeRain = days.find((d) => (d.rainProb ?? 0) >= 30);
  const windiest = days.reduce<WeatherDay | null>((m, d) => ((d.windMax ?? 0) > (m?.windMax ?? 0) ? d : m), null);
  const strongWind = windiest && (windiest.windMax ?? 0) >= 9 ? windiest : null;
  const coldest = days.reduce<WeatherDay | null>((m, d) => (d.feelsMin < (m?.feelsMin ?? 99) ? d : m), null);
  const hottest = days.reduce<WeatherDay | null>((m, d) => (d.tempMax > (m?.tempMax ?? -99) ? d : m), null);
  const uvDay = days.reduce<WeatherDay | null>((m, d) => ((d.uvMax ?? 0) > (m?.uvMax ?? 0) ? d : m), null);
  const gapDay = days.find((d) => d.tempMax - d.tempMin >= 10);

  if (rainDay) {
    const p = rainDay.rainProb != null ? ` · 강수 확률 ${rainDay.rainProb}%` : "";
    if (strongWind) add("우비", `${rainDay.label} 비${p}, 바람도 강해 우산보다 편해요`);
    add("접이식 우산", `${rainDay.label} 비 소식${p}`);
    add("여벌 양말", "신발이 젖으면 갈아 신어요");
  } else if (maybeRain) {
    add("작은 우산", `${maybeRain.label} 강수 확률 ${maybeRain.rainProb}% — 혹시 몰라요`);
  }
  if (days.some((d) => d.hasSnow)) add("미끄럼 방지 신발", "눈 소식이 있어요");
  if (strongWind) add("바람막이", `${strongWind.label} 바람이 초속 ${Math.round(strongWind.windMax ?? 0)}m까지 불어요`);
  if (coldest && coldest.feelsMin <= 3) {
    add("두꺼운 겉옷", `${coldest.label} 체감 ${coldest.feelsMin}°까지 내려가요`);
    add("핫팩", "손과 주머니를 따뜻하게");
  } else if (coldest && coldest.feelsMin <= 12) {
    add("가벼운 겉옷", `${coldest.label} 아침저녁 체감 ${coldest.feelsMin}°`);
  }
  if (gapDay) add("걸칠 옷", `${gapDay.label} 일교차가 ${gapDay.tempMax - gapDay.tempMin}°예요`);
  if (hottest && hottest.tempMax >= 28) {
    add("물병", `${hottest.label} 최고 ${hottest.tempMax}°로 더워요`);
    add("손풍기", "더운 낮에 쓰기 좋아요");
  }
  if (uvDay && (uvDay.uvMax ?? 0) >= 6) {
    add("선크림", `${uvDay.label} 자외선 지수 ${Math.round(uvDay.uvMax ?? 0)}(높음)`);
    add("모자 · 선글라스", "햇빛이 강해요");
  } else if (uvDay && (uvDay.uvMax ?? 0) >= 3) {
    add("선크림", `${uvDay.label} 자외선 지수 ${Math.round(uvDay.uvMax ?? 0)}(보통)`);
  }
  if (out.length === 0) {
    add("편한 신발", "날씨가 좋아 많이 걷기 좋아요");
    add("보조배터리", "사진을 많이 찍게 돼요");
  }
  return out;
}

// 조회한 날부터 3일(오늘 · 내일 · 모레)을 받는다. Open-Meteo는 무료 · 키 없음.
// date(YYYY-MM-DD)를 주면 예전처럼 그 하루만(다른 코드 호환)
export async function fetchWeatherForCity(lat: number, lon: number, cityName: string, date?: string): Promise<WeatherInfo | null> {
  try {
    const range = date ? `&start_date=${date}&end_date=${date}` : "&forecast_days=3";
    const daily = [
      "weathercode",
      "temperature_2m_max",
      "temperature_2m_min",
      "apparent_temperature_max",
      "apparent_temperature_min",
      "precipitation_probability_max",
      "uv_index_max",
      "wind_speed_10m_max",
    ].join(",");
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=${daily}&wind_speed_unit=ms&timezone=auto${range}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const d = data?.daily;
    if (!d || !Array.isArray(d.weathercode) || d.weathercode.length === 0) return null;

    const days: WeatherDay[] = (d.time as string[]).slice(0, 3).map((day, i) => {
      const code = num(d.weathercode[i]) ?? 0;
      const tempMax = Math.round(num(d.temperature_2m_max?.[i]) ?? 20);
      const tempMin = Math.round(num(d.temperature_2m_min?.[i]) ?? 10);
      const prob = num(d.precipitation_probability_max?.[i]);
      const uv = num(d.uv_index_max?.[i]);
      const wind = num(d.wind_speed_10m_max?.[i]);
      return {
        date: day,
        label: date ? "그날" : DAY_LABELS[i] ?? day,
        weatherText: weatherTextOf(code),
        tempMin,
        tempMax,
        feelsMin: Math.round(num(d.apparent_temperature_min?.[i]) ?? tempMin),
        feelsMax: Math.round(num(d.apparent_temperature_max?.[i]) ?? tempMax),
        rainProb: prob == null ? null : Math.round(prob),
        uvMax: uv == null ? null : Math.round(uv * 10) / 10,
        windMax: wind == null ? null : Math.round(wind * 10) / 10,
        hasRain: (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95,
        hasSnow: (code >= 71 && code <= 77) || (code >= 85 && code <= 86),
      };
    });
    const first = days[0];

    return {
      city: cityName,
      weatherText: first.weatherText,
      tempMin: first.tempMin,
      tempMax: first.tempMax,
      hasRain: first.hasRain,
      isCold: first.tempMin <= 8,
      isHot: first.tempMax >= 28,
      recommendations: baseRecommendations(days),
      forDate: first.date,
      days,
    };
  } catch (err) {
    console.error("[팩인백] 날씨 조회 실패:", err);
    return null;
  }
}

// 출발일이 오늘~15일 뒤면 그날(예보 가능), 아니면 undefined. 날씨 · 명소 추천은 10/20부터 출발일과 상관없이 오늘부터 3일을 본다
export function forecastDateFor(travelDate: string | undefined): string | undefined {
  if (!travelDate || !/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) return undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${travelDate}T00:00:00`);
  const days = Math.round((target.getTime() - today.getTime()) / 86400000);
  return days >= 0 && days <= 15 ? travelDate : undefined;
}

// 명소·맛집 추천(app/api/ai-travel-places)을 부르던 fetchAiTravelPlaces는 v2에서 쓰는 곳이 없어 라우트와 함께 지웠다(2026-10-06).
// 아래 타입은 예전 가방 문서의 aiRecommendCache.places 때문에 남겨 둔다. 10/20 명소 추천은 aiRecommendCache.ai.places
type TravelRecommendationCategory = "attraction" | "food" | "specialty";

export interface TravelRecommendation {
  category: TravelRecommendationCategory;
  text: string;
  desc: string;
  icon: string;
}
