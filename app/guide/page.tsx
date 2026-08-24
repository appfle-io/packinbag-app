"use client";

import { useRouter } from "next/navigation";
import GuideScreen from "@/components/screens/GuideScreen";

export default function GuidePage() {
  const router = useRouter();

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      <GuideScreen onBack={() => router.push("/")} />
    </div>
  );
}
