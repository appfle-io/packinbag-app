// 지금 이 클라이언트(브라우저/웹뷰)가 로딩하고 있는 배포의 식별자.
// 빌드 시점에 값이 고정되어 번들에 박힌다(런타임에 다시 안 바뀜) - 그래서 나중에
// 서버가 알려주는 "지금 배포된" 값과 비교하면 "내가 로딩한 이후 새 배포가 있었는지"를
// 알 수 있다.
//
// NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA는 Vercel이 배포마다 자동으로 주입해주는 커밋 SHA다
// (Vercel 프로젝트 설정 > Environment Variables 맨 아래 "Automatically expose System
// Environment Variables" 토글이 켜져 있어야 클라이언트에도 노출된다 - 서버 전용
// VERCEL_GIT_COMMIT_SHA와는 별개로 켜야 함). 로컬 개발 환경에는 이 값이 없어서
// "dev"로 대체되고, app/api/build-info도 로컬에서는 항상 "dev"를 반환하므로 로컬에서는
// 항상 서로 같아 "새 버전" 알림이 뜨지 않는다.
export const BUILD_ID = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "dev";
