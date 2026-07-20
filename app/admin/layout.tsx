import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/Toast";
import { AuthProvider } from "@/contexts/AuthProvider";
import AdminGate from "@/components/admin/AdminGate";

// 모바일 앱(Capacitor WebView)에는 이 경로가 노출되지 않는다 - AppShell의 화면 목록에
// 전혀 포함되지 않고, 데스크탑 브라우저에서 packinbag.vercel.app/admin으로 직접 접속할
// 때만 쓰인다. 같은 Next.js 프로젝트/배포를 그대로 쓰되 완전히 별도의 라우트로 분리해서,
// CS 조회처럼 표 형태 데이터를 다루는 작업을 데스크탑 화면에 맞게 보여준다.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <AdminGate>{children}</AdminGate>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
