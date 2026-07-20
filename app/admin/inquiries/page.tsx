"use client";

import { useRouter } from "next/navigation";
import InquiryAdminScreen from "@/components/screens/InquiryAdminScreen";

export default function AdminInquiriesPage() {
  const router = useRouter();
  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      <InquiryAdminScreen onBack={() => router.push("/admin")} />
    </div>
  );
}
