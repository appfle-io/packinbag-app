"use client";

import { useRouter } from "next/navigation";
import UnlockCodeAdminScreen from "@/components/screens/UnlockCodeAdminScreen";

export default function AdminUnlockCodesPage() {
  const router = useRouter();
  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      <UnlockCodeAdminScreen onBack={() => router.push("/admin")} />
    </div>
  );
}
