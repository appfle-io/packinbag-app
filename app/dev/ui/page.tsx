import { notFound } from "next/navigation";
import UiGallery from "@/components/v2/dev/UiGallery";

// 리디자인 v2 컴포넌트 확인용 페이지 (개발 서버에서만: /dev/ui)
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiGallery />;
}
