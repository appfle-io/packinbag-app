import type { Metadata } from "next";
import { getPublicEvent } from "@/lib/eventsServer";
import { eventLinks, eventPagePath, eventPeriodLabel, eventStatus, kstDateKey } from "@/lib/events";
import EventLinksButton from "../EventLinksButton";
import styles from "../events.module.css";

// 이벤트 공개 페이지(2026-10-20, events.md EVT-WEB). 앱 없이 링크로 보는 이벤트 화면.
// 앱의 이벤트 보기(EVT-VIEW)와 같은 짜임: 위 줄 + 본문(스크립트를 막은 iframe) + 아래 버튼
// 게시한 이벤트만. 1분 캐시(관리자에서 고친 내용은 1분 안에 반영)
export const revalidate = 60;

const SITE = (process.env.NEXT_PUBLIC_APP_URL || "https://packinbag.seeuson.com").replace(/\/$/, "");

type Props = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const ev = await getPublicEvent(key);
  if (!ev) return { title: "팩인백 이벤트", robots: { index: false } };
  const title = `${ev.title} · 팩인백 이벤트`;
  const description = ev.summary || "팩인백 이벤트";
  const images = ev.coverUrl ? [{ url: ev.coverUrl, width: 800, height: 800 }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: `${SITE}${eventPagePath(ev)}` },
    // 카톡 · 문자 미리보기 카드(EVT-WEB-02)
    openGraph: { title: ev.title, description, images, type: "website", siteName: "팩인백", url: `${SITE}${eventPagePath(ev)}` },
    twitter: { card: "summary", title: ev.title, description, images: ev.coverUrl ? [ev.coverUrl] : undefined },
  };
}

function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.headerRow}>
        <a href="/about" className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/backpack-logo.png" alt="" width={28} height={28} />
          팩인백 <span className={styles.brandSub}>이벤트</span>
        </a>
        <a href="/about" className={styles.tryLink}>
          팩인백 써 보기
        </a>
      </div>
    </header>
  );
}

export default async function EventPublicPage({ params }: Props) {
  const { key } = await params;
  const ev = await getPublicEvent(key);

  if (!ev) {
    return (
      <div className={styles.page}>
        <Header />
        <div className={styles.empty}>
          <h1>없거나 내려간 이벤트예요</h1>
          <p>주소를 다시 확인해 주세요.</p>
          <a href="/about" className={styles.tryLink}>
            팩인백 둘러보기
          </a>
        </div>
      </div>
    );
  }

  const today = kstDateKey();
  const status = eventStatus(ev, today);
  const links = eventLinks(ev);
  const showButton = status === "active" && !!ev.buttonLabel && links.length > 0;

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.body}>
        {status === "upcoming" ? (
          <div className={styles.empty}>
            <h1>곧 열리는 이벤트예요</h1>
            <p>{eventPeriodLabel(ev, today)}</p>
          </div>
        ) : ev.bodyType === "html" && ev.bodyUrl ? (
          <iframe src={ev.bodyUrl} title={ev.title} sandbox="" referrerPolicy="no-referrer" className={styles.frame} />
        ) : ev.bodyType === "image" && ev.bodyUrl ? (
          <div className={styles.imageScroll}>
            <div className={styles.imageWrap}>
              {/* eslint-disable-next-line @next/next/no-img-element -- Storage 내려받기 주소 */}
              <img src={ev.bodyUrl} alt={ev.title} />
            </div>
          </div>
        ) : (
          <div className={styles.empty}>
            <p>내용을 불러오지 못했어요</p>
          </div>
        )}
      </main>
      {(showButton || status === "ended") && (
        <div className={styles.bar}>
          <div className={styles.barInner}>
            {status === "ended" ? (
              <p className={styles.ended}>끝난 이벤트예요 · {eventPeriodLabel(ev, today)}</p>
            ) : (
              <EventLinksButton label={ev.buttonLabel ?? ""} links={links} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
