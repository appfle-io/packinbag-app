"use client";

import { cx } from "@/components/v2/ui";

// 관리자 화면 공통 틀(v2 토큰). 대시보드와 같은 폭·여백·제목 크기.
export function AdminPage({
  title,
  description,
  actions,
  children,
  wide = false,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="pib-v2 min-h-full bg-canvas">
      <div className={cx("mx-auto flex flex-col gap-6 px-5 py-8 sm:px-8", wide ? "max-w-6xl" : "max-w-4xl")}>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="m-0 text-title font-bold text-ink">{title}</h1>
            {description && <p className="m-0 text-caption text-sub">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
        {children}
      </div>
    </div>
  );
}

export function AdminCard({ children, className, title, hint }: { children: React.ReactNode; className?: string; title?: React.ReactNode; hint?: string }) {
  return (
    <section className={cx("rounded-card border border-line bg-card p-5", className)}>
      {title && (
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="m-0 text-body font-bold text-ink">{title}</h2>
          {hint && <p className="m-0 text-caption text-sub">{hint}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

export const ADMIN_FIELD =
  "h-11 w-full rounded-field border border-line bg-card px-4 text-body text-ink outline-none placeholder:text-faint focus:border-ink";
export const ADMIN_TEXTAREA =
  "w-full resize-y rounded-field border border-line bg-card px-4 py-3 text-body text-ink outline-none placeholder:text-faint focus:border-ink";

export function AdminEmpty({ children }: { children: React.ReactNode }) {
  return <p className="m-0 py-16 text-center text-body text-sub">{children}</p>;
}

export function AdminError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="m-0 text-body text-alert">
      {children}
    </p>
  );
}

export function AdminLoading() {
  return <p className="m-0 py-16 text-center text-body text-sub">불러오고 있어요</p>;
}
