"use client";

import { Capacitor } from "@capacitor/core";
import { dataUrlMime, extFromMime, isDataUrl } from "@/lib/fileUrlUtils";

export { isDataUrl };

// 첨부 파일(가방 사진·파일, 메모팩 첨부) 저장·열기 공용 함수.
//
// 환경별로 되는 방법이 달라서 한 곳에서 나눈다(2026-10-04 점검 후 정리):
// - 웹·포터블(Electron): 파일을 blob으로 받아 <a download>로 저장. Firebase Storage 주소는
//   Content-Disposition을 안 보내서 링크만 걸면 "열기"만 되기 때문
//   · 웹은 Storage 버킷에 CORS 설정이 있어야 fetch가 된다(없으면 새 탭 열기로 물러난다)
//   · Electron은 webSecurity가 꺼져 있어 CORS와 상관없이 된다
// - iOS 앱(Capacitor WKWebView): <a download>가 동작하지 않고 window.open도 앱 안에서는 막힌다.
//   웹 주소는 window.open → Capacitor가 사파리로 넘기고, 사용자가 공유 → 파일에 저장으로 내려받는다.
//   이 기기에만 있는 파일(data URL)은 공유 시트(navigator.share)로 넘긴다
// - 오프라인(포터블) 첨부는 data URL이다. 파일 이름은 주소에 없으니 넘겨받은 이름이나 종류로 만든다

// data URL → Blob(동기). 브라우저는 data URL을 새 탭으로 열 수 없어서(보안 차단) blob 주소로 바꿔 쓴다
export function dataUrlToBlob(url: string): Blob {
  const comma = url.indexOf(",");
  const meta = url.slice(5, comma);
  const body = url.slice(comma + 1);
  const mime = meta.split(";")[0] || "application/octet-stream";
  if (meta.includes(";base64")) {
    const bin = atob(body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(body)], { type: mime });
}

// 저장할 파일 이름. 넘겨받은 이름 > Storage 주소의 원본 이름(앞 타임스탬프 제거) > 종류로 만든 이름
export function fileNameFor(url: string, preferred?: string | null, fallbackBase = "팩인백_파일"): string {
  const clean = (s: string) => s.replace(/[\\/:*?"<>|]/g, "_").trim();
  if (preferred && preferred.trim()) return clean(preferred);
  if (isDataUrl(url)) {
    const ext = extFromMime(dataUrlMime(url));
    return ext ? `${fallbackBase}.${ext}` : fallbackBase;
  }
  try {
    const u = new URL(url);
    const oIndex = u.pathname.indexOf("/o/");
    const raw = oIndex >= 0 ? u.pathname.slice(oIndex + 3) : u.pathname;
    const last = decodeURIComponent(raw).split("/").pop() || "";
    const withoutStamp = last.replace(/^\d{10,}[-_]/, "");
    if (withoutStamp) return clean(withoutStamp);
  } catch {
    // 아래로
  }
  return fallbackBase;
}

function clickDownload(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function shareBlob(blob: Blob, name: string): Promise<boolean> {
  try {
    const file = new File([blob], name, { type: blob.type || "application/octet-stream" });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: name });
      return true;
    }
  } catch {
    // 사용자가 공유를 취소해도 여기로 온다
  }
  return false;
}

export type DownloadResult = "saved" | "opened" | "failed";

// 파일 저장. preferredName이 있으면 그 이름으로(메모 첨부는 원래 파일 이름을 갖고 있다)
export async function downloadFileFromUrl(url: string, preferredName?: string | null): Promise<DownloadResult> {
  const name = fileNameFor(url, preferredName);
  const native = Capacitor.isNativePlatform();

  if (isDataUrl(url)) {
    const blob = dataUrlToBlob(url);
    if (native) return (await shareBlob(blob, name)) ? "saved" : "failed";
    const blobUrl = URL.createObjectURL(blob);
    clickDownload(blobUrl, name);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
    return "saved";
  }

  if (native) {
    // 사파리로 열린다(공유 → "파일에 저장"으로 받기)
    window.open(url, "_blank");
    return "opened";
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`다운로드 실패: ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    clickDownload(blobUrl, name);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
    return "saved";
  } catch {
    // CORS 등으로 못 받으면 새 탭에서라도 연다(브라우저가 미리보기나 다운로드로 처리)
    window.open(url, "_blank", "noopener,noreferrer");
    return "opened";
  }
}

// 파일 열기(미리보기). 웹 주소는 새 탭(앱은 사파리), 이 기기에만 있는 파일(data URL)은 blob 주소로 연다.
// data URL을 열 수 없는 iOS 앱은 공유 시트로 넘긴다
export async function openFileUrl(url: string, preferredName?: string | null): Promise<DownloadResult> {
  if (!isDataUrl(url)) {
    window.open(url, "_blank", "noopener,noreferrer");
    return "opened";
  }
  if (Capacitor.isNativePlatform()) return downloadFileFromUrl(url, preferredName);
  const blobUrl = URL.createObjectURL(dataUrlToBlob(url));
  const w = window.open(blobUrl, "_blank");
  // 팝업이 막히면 저장으로 대신한다
  if (!w) {
    URL.revokeObjectURL(blobUrl);
    return downloadFileFromUrl(url, preferredName);
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  return "opened";
}
