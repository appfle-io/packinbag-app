"use client";

import { useEffect, useState } from "react";
import { IconBackpack, IconX } from "@tabler/icons-react";
import { APP_STORE_URL, detectBridgeEnv, externalBrowserUrl, isSafeAppPath, tryOpenIosApp, type BridgeEnv } from "@/lib/v2/appBridge";

// 공유 링크 브리지 화면(2026-10-12, lib/v2/appBridge). 게스트 보기(/v)에서 초대 링크로 들어왔을 때:
// - 아이폰 앱 안 브라우저(카톡 등): 바로 팩인백 앱을 열어 그 가방 참여로(앱이 없으면 앱스토어)
// - 아이폰 사파리: 아래 카드로 "앱에서 열기"(사파리는 앱이 없으면 오류 창이 떠서 자동으로 시도하지 않는다)
// - 안드로이드 앱 안 브라우저: 기본 브라우저에서 바로 참여 화면으로
// 같은 주소에서 자동 시도는 한 번만(뒤로 가기 · 새로고침으로 되풀이하지 않게)
export default function AppBridge({ path, auto }: { path: string; auto: boolean }) {
  const [env, setEnv] = useState<BridgeEnv | null>(null);
  const [card, setCard] = useState<"opening" | "safari" | null>(null);

  useEffect(() => {
    const e = detectBridgeEnv();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 기기 · 브라우저는 처음 한 번만 본다
    setEnv(e);
    if (!auto || e.nativeApp || !isSafeAppPath(path)) return;
    const key = `pib_bridge_tried:${window.location.pathname}${window.location.search}`;
    let tried = false;
    try {
      tried = sessionStorage.getItem(key) === "1";
      sessionStorage.setItem(key, "1");
    } catch {}
    if (e.ios) {
      if (e.inApp && !tried) {
        setCard("opening");
        return tryOpenIosApp(path, { fallbackToStore: true });
      }
      setCard("safari");
      return;
    }
    if (e.inApp && !tried) {
      const ext = externalBrowserUrl(new URL(path, window.location.origin).toString(), e);
      if (ext) window.location.href = ext;
    }
  }, [auto, path]);

  if (!env || !card) return null;

  return (
    <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2E5E4E] text-white">
            <IconBackpack size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-slate-900 dark:text-white">
              {card === "opening" ? "팩인백 앱에서 여는 중이에요" : "팩인백 앱에서 바로 참여해요"}
            </p>
            <p className="mt-0.5 text-[13px] text-slate-500">
              {card === "opening" ? "앱이 없으면 앱스토어로 이동해요" : "앱이 있으면 로그인 없이 그 가방으로 들어가요"}
            </p>
          </div>
          <button type="button" aria-label="닫기" onClick={() => setCard(null)} className="-mr-1 -mt-1 p-2 text-slate-400">
            <IconX size={18} />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => tryOpenIosApp(path, { fallbackToStore: true })}
            className="flex-1 rounded-xl bg-[#2E5E4E] py-2.5 text-[14px] font-bold text-white active:opacity-80"
          >
            앱에서 열기
          </button>
          <a
            href={APP_STORE_URL}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-center text-[14px] font-bold text-slate-700 active:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
          >
            앱 받기
          </a>
        </div>
      </div>
    </div>
  );
}
