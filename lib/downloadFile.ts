// Firebase Storage 다운로드 URL은 Content-Disposition: attachment를 안 보내주기 때문에,
// <a href> 하나로 그냥 링크만 걸면 새 탭에서 "보여지기"만 하고 다운로드는 안 된다(특히 이미지/PDF).
// 그래서 파일을 blob으로 직접 받아온 뒤 임시 object URL을 만들어 강제로 다운로드시킨다.
// (CORS 등으로 fetch가 실패하면 최소한 새 탭에서라도 열어서 볼 수 있게 폴백한다.)
export async function downloadFileFromUrl(url: string, fallbackName: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`다운로드 실패: ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = guessFilename(url) ?? fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    return true;
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
    return false;
  }
}

// Firebase Storage 다운로드 URL은 보통
// ".../o/bags%2F{bagId}%2F{uuid}_원본이름.jpg?alt=media&token=..." 형태라, o/ 뒤를
// 디코딩하면 실제 파일명을 뽑아낼 수 있다.
function guessFilename(url: string): string | null {
  try {
    const u = new URL(url);
    const oIndex = u.pathname.indexOf("/o/");
    const raw = oIndex >= 0 ? u.pathname.slice(oIndex + 3) : u.pathname;
    const decoded = decodeURIComponent(raw);
    const last = decoded.split("/").pop();
    return last || null;
  } catch {
    return null;
  }
}
