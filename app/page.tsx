import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import { InviteLinkBridge } from "@/components/AppBridge";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/Toast";
import { AuthProvider } from "@/contexts/AuthProvider";
import { APP_STORE_ID } from "@/lib/v2/appBridge";

// 아이폰 사파리 위쪽 앱 배너(스마트 앱 배너, 2026-10-12): 앱이 있으면 "열기", 없으면 "받기". 앱 · 홈 화면 PWA에서는 iOS가 띄우지 않는다
export const metadata: Metadata = {
  itunes: { appId: APP_STORE_ID },
};

export default function Home() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <AppShell />
          {/* 초대 링크(/?invite=)를 카톡 · 사파리에서 열면 팩인백 앱으로(lib/v2/appBridge) */}
          <InviteLinkBridge />
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
