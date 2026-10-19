"use client";

// 이벤트 공개 페이지 아래 버튼(2026-10-20, events.md EVT-WEB-03). 앱의 EVT-VIEW-07과 같은 규칙:
// 링크 1개 + 바깥 → "외부로 이동합니다" 확인 / 2개 이상 → 고르기 / 앱 경로 하나 → 바로
import { useEffect, useState } from "react";
import { isAppPath, linkHost, type EventLink } from "@/lib/events";
import { openExternalLink } from "@/lib/openExternalLink";
import styles from "./events.module.css";

function go(url: string) {
  if (isAppPath(url)) window.location.assign(url);
  else openExternalLink(url);
}

export default function EventLinksButton({ label, links }: { label: string; links: EventLink[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (links.length === 0) return null;
  const one = links.length === 1 ? links[0] : null;

  return (
    <>
      <button
        type="button"
        className={styles.cta}
        onClick={() => {
          if (one && isAppPath(one.url)) go(one.url);
          else setOpen(true);
        }}
      >
        {label}
      </button>
      {open && (
        <div className={styles.scrim} onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="외부로 이동합니다" className={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.sheetTitle}>외부로 이동합니다</h2>
            {one ? (
              <>
                <p className={styles.sheetSub}>
                  {one.label}
                  {linkHost(one.url) && linkHost(one.url) !== one.label ? ` · ${linkHost(one.url)}` : ""}
                </p>
                <div className={styles.actions}>
                  <button type="button" className={styles.btnLine} onClick={() => setOpen(false)}>
                    취소
                  </button>
                  <button
                    type="button"
                    className={styles.btnDark}
                    onClick={() => {
                      setOpen(false);
                      go(one.url);
                    }}
                  >
                    이동
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.sheetSub}>어디로 갈까요?</p>
                <ul className={styles.list}>
                  {links.map((l, i) => (
                    <li key={`${l.url}-${i}`}>
                      <button
                        type="button"
                        className={styles.row}
                        onClick={() => {
                          setOpen(false);
                          go(l.url);
                        }}
                      >
                        <span className={styles.rowText}>
                          <span className={styles.rowLabel}>{l.label}</span>
                          {linkHost(l.url) && linkHost(l.url) !== l.label && <span className={styles.rowHost}>{linkHost(l.url)}</span>}
                        </span>
                        <span aria-hidden="true" className={styles.rowArrow}>
                          ›
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" className={styles.btnLine} onClick={() => setOpen(false)}>
                  닫기
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
