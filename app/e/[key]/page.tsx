import { redirect } from "next/navigation";

// 이벤트 짧은 주소(2026-10-20, events.md EVT-WEB-04): /e/{주소} → /about/events/{주소}
// 카톡 · 문자에 붙이기 좋게 짧게. 미리보기 카드는 옮겨 간 페이지의 메타 태그를 읽는다
export default async function EventShortLink({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  redirect(`/about/events/${encodeURIComponent(key)}`);
}
