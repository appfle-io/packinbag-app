"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import UnlockCodeAdminScreen from "@/components/screens/UnlockCodeAdminScreen";

type StatusFilter = "all" | "unused" | "active" | "expired" | "invalidated";
const VALID_FILTERS: StatusFilter[] = ["all", "unused", "active", "expired", "invalidated"];

function AdminUnlockCodesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const initialStatusFilter: StatusFilter =
    statusParam && VALID_FILTERS.includes(statusParam as StatusFilter) ? (statusParam as StatusFilter) : "all";

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      <UnlockCodeAdminScreen onBack={() => router.push("/admin")} initialStatusFilter={initialStatusFilter} />
    </div>
  );
}

export default function AdminUnlockCodesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[13px] text-text-muted">불러오는 중...</div>}>
      <AdminUnlockCodesInner />
    </Suspense>
  );
}
