"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import InquiryAdminScreen from "@/components/screens/InquiryAdminScreen";

function AdminInquiriesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialUnansweredOnly = searchParams.get("status") === "pending";
  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      <InquiryAdminScreen onBack={() => router.push("/admin")} initialUnansweredOnly={initialUnansweredOnly} />
    </div>
  );
}

export default function AdminInquiriesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[13px] text-text-muted">불러오는 중...</div>}>
      <AdminInquiriesInner />
    </Suspense>
  );
}
