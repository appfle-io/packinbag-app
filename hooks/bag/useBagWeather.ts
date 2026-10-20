"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import type { Bag, Item, Pack } from "@/lib/types";
import { fetchWeatherForCity, resolveCityInfo, type WeatherAiResult, type WeatherInfo } from "@/lib/weatherService";
import type { BagDocument } from "./useBagDocument";
import { newId } from "./ids";
import type { PackLimit } from "./useBagItems";

// 날씨 · 명소 추천 (2026-10-20, 예전 "날씨로 준비물 추천"). docs/spec/bag.md § BAG-WX
// - 프리미엄 전용. 날씨는 조회한 날부터 3일(오늘 · 내일 · 모레, 출발일과 상관없음)
// - 장소: 직접 입력한 장소(Bag.weatherPlace)가 있으면 그것, 없으면 가방 이름에서 찾는다
// - 결과는 가방 문서(aiRecommendCache)에 6시간 · 같은 날 · 같은 장소 동안 저장해 같은 가방을 보는 사람 모두 재사용
// 비용 원칙:
// - 자동 호출 없음. 시트를 열 때만 확인하고, 저장된 결과가 쓸 만하면 다시 부르지 않는다
// - 장소 찾기(/api/geocode)만 서버 비용이 있고(로그인 필요 · 서버가 단어별로 30일 캐시), 날씨(Open-Meteo)와 기본 추천은 무료다
// - "AI로 추천받기"는 사용자가 누를 때만 부르고, 그때만 AI 하루 횟수를 쓴다. 결과는 위 캐시에 같이 둔다
// 담은 준비물은 "날씨 추천" 팩, 가볼 곳은 "가볼 곳" 팩(aiRecommendSource, 가볼 곳은 aiRecommendKind "places")으로 모인다.
// 두 팩은 이름을 바꿀 수 없고, 무료 멤버 화면에서는 숨겨진다(getViewablePacks)

const CACHE_MS = 6 * 60 * 60 * 1000;
export const WEATHER_PACK_NAME = "날씨 추천";
export const PLACES_PACK_NAME = "가볼 곳";
const MAX_EXISTING_SENT = 150;

export type WeatherStatus = "idle" | "loading" | "ready" | "no-place" | "failed";

const localDateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const isWeatherPack = (p: Pack) => !!p.aiRecommendSource && p.kind !== "editor" && p.aiRecommendKind !== "places";
const isPlacesPack = (p: Pack) => !!p.aiRecommendSource && p.kind !== "editor" && p.aiRecommendKind === "places";

export function useBagWeather({
  doc,
  user,
  premium,
  offline,
  onPremiumRequired,
  packLimit,
}: {
  doc: BagDocument;
  user: User | null;
  premium: boolean;
  offline: boolean;
  onPremiumRequired: (message: string) => void;
  packLimit: PackLimit;
}) {
  const { bag, update, guard } = doc;
  const [status, setStatus] = useState<WeatherStatus>("idle");
  const [info, setInfo] = useState<WeatherInfo | null>(null);
  const [ai, setAi] = useState<WeatherAiResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const available = !offline;
  const manualPlace = bag.weatherPlace?.trim() || "";

  const saveCache = (next: WeatherInfo, placeQuery: string, aiResult: WeatherAiResult | null) => {
    if (guard()) return;
    update((prev) => ({
      ...prev,
      aiRecommendCache: {
        city: next.city,
        weatherInfo: next,
        places: prev.aiRecommendCache?.places ?? [],
        cachedAt: new Date().toISOString(),
        bagName: prev.name,
        placeQuery,
        ...(aiResult ? { ai: aiResult } : {}),
      },
    }));
  };

  // 시트를 열 때 부른다. force면 저장된 날씨를 무시하고 새로 받는다(새로고침).
  // placeOverride: 장소를 막 바꿨을 때(bag.weatherPlace가 아직 이 화면에 반영되기 전) 쓴다. ""면 가방 이름으로
  const load = async (force = false, placeOverride?: string) => {
    if (!premium) {
      onPremiumRequired("날씨 · 명소 추천은 프리미엄 기능이에요. 이용권을 등록하면 바로 쓸 수 있어요.");
      return false;
    }
    setAiError(null);
    const manual = placeOverride !== undefined ? placeOverride.trim() : manualPlace;
    const placeQuery = manual || bag.name;
    const cache: Bag["aiRecommendCache"] = bag.aiRecommendCache;
    const sameTarget =
      !!cache?.weatherInfo?.days && (cache.placeQuery ?? cache.bagName) === placeQuery && localDateKey(new Date(cache.cachedAt)) === localDateKey();
    const cacheFresh = sameTarget && Date.now() - new Date(cache!.cachedAt).getTime() < CACHE_MS;
    if (!force && cacheFresh && cache) {
      setInfo(cache.weatherInfo);
      setAi(cache.ai ?? null);
      setStatus("ready");
      return true;
    }
    setStatus("loading");
    const idToken = user ? await user.getIdToken().catch(() => undefined) : undefined;
    const place = await resolveCityInfo(placeQuery, idToken, !!manual);
    if (!place) {
      setInfo(null);
      setAi(null);
      setStatus("no-place");
      return true;
    }
    const next = await fetchWeatherForCity(place.lat, place.lon, manual || place.name);
    if (!next) {
      // 실패해도 예전 캐시는 지우지 않는다(구 화면 규칙)
      setStatus("failed");
      return true;
    }
    // 같은 날 · 같은 장소면 받아 둔 AI 추천은 남긴다(날씨만 새로 받은 것)
    const keptAi = sameTarget ? cache?.ai ?? null : null;
    setInfo(next);
    setAi(keptAi);
    setStatus("ready");
    saveCache(next, placeQuery, keptAi);
    return true;
  };

  // 장소 직접 입력(빈 값이면 가방 이름으로 돌아감). 바꾸면 바로 다시 찾는다
  const setPlace = async (text: string) => {
    if (guard()) return;
    const t = text.trim().slice(0, 40);
    update((prev) => ({ ...prev, weatherPlace: t || undefined }));
    await load(true, t);
  };

  // AI로 추천받기(하루 횟수 사용). 서버가 횟수를 검사 · 차감한다
  const askAi = async () => {
    if (!user || !info || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const idToken = await user.getIdToken();
      const existingItems = Array.from(
        new Set(bag.packs.filter((p) => p.kind !== "editor").flatMap((p) => p.items.map((i) => i.text.trim()).filter(Boolean))),
      ).slice(0, MAX_EXISTING_SENT);
      const res = await fetch("/api/ai-weather-recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          bagName: bag.name,
          place: info.city,
          days: info.days ?? [],
          existingItems,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<WeatherAiResult> & { error?: string };
      if (!res.ok) {
        setAiError(data?.error ?? "AI 추천을 받지 못했어요");
        return;
      }
      const result: WeatherAiResult = {
        summary: typeof data.summary === "string" ? data.summary : "",
        items: Array.isArray(data.items) ? data.items.filter((i) => i && typeof i.text === "string") : [],
        places: Array.isArray(data.places) ? data.places.filter((p) => p && typeof p.name === "string") : [],
        at: typeof data.at === "string" ? data.at : new Date().toISOString(),
      };
      setAi(result);
      saveCache(info, manualPlace || bag.name, result);
    } catch {
      setAiError("AI 추천을 받지 못했어요");
    } finally {
      setAiLoading(false);
    }
  };

  // 고른 준비물은 "날씨 추천" 팩, 가볼 곳은 "가볼 곳" 팩 끝에(없으면 맨 아래에 만든다). 이미 가방에 있는 이름은 건너뛴다.
  // 새 팩을 만들 자리가 모자라면 아무것도 담지 않고 "full"
  const addItems = (itemTexts: string[], placeNames: string[]): { items: number; places: number } | "full" => {
    if (guard()) return { items: 0, places: 0 };
    const existingTexts = new Set(bag.packs.flatMap((p) => p.items.map((i) => i.text.trim())));
    const fresh = (list: string[]) => Array.from(new Set(list.map((t) => t.trim()))).filter((t) => t && !existingTexts.has(t));
    const items = fresh(itemTexts);
    const places = fresh(placeNames).filter((t) => !items.includes(t));
    if (items.length === 0 && places.length === 0) return { items: 0, places: 0 };
    const needed =
      (items.length > 0 && !bag.packs.some(isWeatherPack) ? 1 : 0) + (places.length > 0 && !bag.packs.some(isPlacesPack) ? 1 : 0);
    if (needed > 0 && bag.packs.length + needed > packLimit.max) return "full";
    const toItems = (list: string[]): Item[] => list.map((text) => ({ id: newId(), type: "check", text, checked: false }));
    const newItems = toItems(items);
    const newPlaces = toItems(places);
    update((prev) => {
      let packs = [...prev.packs];
      const put = (list: Item[], match: (p: Pack) => boolean, make: () => Pack) => {
        if (list.length === 0) return;
        const target = packs.find(match);
        if (target) packs = packs.map((p) => (p.id === target.id ? { ...p, items: [...p.items, ...list] } : p));
        else packs = [...packs, { ...make(), items: list }];
      };
      put(newItems, isWeatherPack, () => ({ id: newId(), name: WEATHER_PACK_NAME, items: [], aiRecommendSource: true }));
      put(newPlaces, isPlacesPack, () => ({
        id: newId(),
        name: PLACES_PACK_NAME,
        items: [],
        aiRecommendSource: true,
        aiRecommendKind: "places",
      }));
      return { ...prev, packs };
    });
    return { items: items.length, places: places.length };
  };

  return { available, status, info, manualPlace, load, setPlace, ai, aiLoading, aiError, askAi, addItems };
}
