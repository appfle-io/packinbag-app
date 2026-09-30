import { cx } from "./cx";

export function SectionHeader({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex min-h-8 items-center justify-between", className)}>
      <h2 className="m-0 text-caption font-semibold text-sub">{children}</h2>
      {action}
    </div>
  );
}
