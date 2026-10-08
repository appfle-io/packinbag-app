"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import type { Item } from "@/lib/types";
import { fetchWeatherForCity, forecastDateFor, resolveCityInfo, type WeatherInfo } from "@/lib/weatherService";
import type { BagDocument } from "./useBagDocument";
import { newId } from "./ids";
import { MAX_PACKS_PER_BAG } from "./useBagItems";

// 날씨로 준비물 추천 (리디자인 v2). 방향 문서: AI 추천 중 "날씨 기반 준비물 추천"만 남긴다(명소·맛집·특산물 제거).
// 구 화면과 같은 규칙: 프리미엄 전용, 결과는 가방 문서(aiRecommendCache)에 캐시해 같은 가방을 보는 사람 모두 재사용.
// 비용 원칙:
// - 자동 호출 없음. 시트를 열 때만 확인하고, 6시간 안에 같은 가방 이름·같은 예보일로 받은 결과가 있으면 다시 부르지 않는다.
// - 장소 찾기(/api/geocode)만 서버 비용이 있고(로그인 필요 · 서버가 단어별로 30일 캐시), 날씨(Open-Meteo)와 기본 추천은 무료다.
// - "AI로 더 추천받기"는 사용자가 누를 때만 부르고, 그때만 AI 하루 횟수를 쓴다(결과는 캐시하지 않음).
// 담은 아이템은 "날씨 추천" 팩(aiRecommendSource)으로 모인다 - 무료 멤버 화면에서는 숨겨지는 기존 규칙(getViewablePacks)을 따른다.

const CACHE_MS = 6 * 60 * 60 * 1000;
const WEATHER_PACK_NAME = "날씨 추천";

export type WeatherStatus = "idle" | "loading" | "ready" | "no-place" | "failed";

export function useBagWeather({
  doc,
  user,
  premium,
  offline,
  onPremiumRequired,
}: {
  doc: BagDocument;
  user: User | null;
  premium: boolean;
  offline: boolean;
  onPremiumRequired: (message: string) => void;
}) {
  const { bag, update, guard } = doc;
  const [status, setStatus] = useState<WeatherStatus>("idle");
  const [info, setInfo] = useState<WeatherInfo | null>(null);
  const [aiItems, setAiItems] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const available = !offline;
  const forecastDate = forecastDateFor(bag.travelDate);

  // 시트를 열 때 부른다. force면 캐시를 무시하고 새로 받는다(새로고침).
  const load = async (force = false) => {
    if (!premium) {
      onPremiumRequired("날씨로 준비물 추천은 프리미엄 기능이에요. 이용권을 등록하면 바로 쓸 수 있어요.");
      return false;
    }
    setAiItems([]);
    setAiError(null);
    const cache = bag.aiRecommendCache;
    const cacheFresh =
      !!cache?.weatherInfo &&
      cache.bagName === bag.name &&
      (cache.weatherInfo.forDate ?? undefined) === forecastDate &&
      Date.now() - new Date(cache.cachedAt).getTime() < CACHE_MS;
    if (!force && cacheFresh && cache) {
      setInfo(cache.weatherInfo);
      setStatus("ready");
      return true;
    }
    setStatus("loading");
    const idToken = user ? await user.getIdToken().catch(() => undefined) : undefined;
    const place = await resolveCityInfo(bag.name, idToken);
    if (!place) {
      setStatus("no-place");
      return true;
    }
    const next = await fetchWeatherForCity(place.lat, place.lon, place.name, forecastDate);
    if (!next) {
      // 실패해도 예전 캐시는 지우지 않는다(구 화면 규칙)
      setStatus("failed");
      return true;
    }
    setInfo(next);
    setStatus("ready");
    if (!guard()) {
      update((prev) => ({
        ...prev,
        aiRecommendCache: {
          city: next.city,
          weatherInfo: next,
          places: prev.aiRecommendCache?.places ?? [],
          cachedAt: new Date().toISOString(),
          bagName: prev.name,
        },
      }));
    }
    return true;
  };

  // AI로 더 추천받기(하루 무료 횟수 사용). 서버가 횟수를 검사·차감한다.
  const askAi = async () => {
    if (!user || !info || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/ai-weather-recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ bagName: bag.name, weatherText: info.weatherText, tempMin: info.tempMin, tempMax: info.tempMax }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiError((data?.error as string | undefined) ?? "AI 추천을 받지 못했어요");
        return;
      }
      const texts = ((data?.items ?? []) as { text?: string }[])
        .map((i) => (i.text ?? "").trim())
        .filter(Boolean);
      setAiItems(texts);
    } catch {
      setAiError("AI 추천을 받지 못했어요");
    } finally {
      setAiLoading(false);
    }
  };

  // 고른 추천을 "날씨 추천" 팩에 담는다(없으면 만든다). 이미 가방에 있는 이름은 건너뛴다.
  const addItems = (texts: string[]): number => {
    if (guard() || texts.length === 0) return 0;
    const existingTexts = new Set(bag.packs.flatMap((p) => p.items.map((i) => i.text.trim())));
    const fresh = Array.from(new Set(texts.map((t) => t.trim()))).filter((t) => t && !existingTexts.has(t));
    if (fresh.length === 0) return 0;
    const target = bag.packs.find((p) => p.aiRecommendSource && p.kind !== "editor");
    if (!target && bag.packs.length >= MAX_PACKS_PER_BAG) return -1;
    const newItems: Item[] = fresh.map((text) => ({ id: newId(), type: "check", text, checked: false }));
    update((prev) => {
      const existing = prev.packs.find((p) => p.aiRecommendSource && p.kind !== "editor");
      if (existing) {
        return {
          ...prev,
          packs: prev.packs.map((p) => (p.id === existing.id ? { ...p, items: [...p.items, ...newItems] } : p)),
        };
      }
      return {
        ...prev,
        packs: [...prev.packs, { id: newId(), name: WEATHER_PACK_NAME, items: newItems, aiRecommendSource: true }],
      };
    });
    return fresh.length;
  };

  return { available, status, info, forecastDate, load, aiItems, aiLoading, aiError, askAi, addItems };
}
