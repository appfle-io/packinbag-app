"use client";

// 앱 곳곳(스플래시, 로그인 화면 등)에 쓰는 백팩 로고 마크.
// 앱 아이콘(app/icon.png)과 완전히 같은 이미지를 그대로 쓴다 - 벡터로 다시 그리면
// 미세하게 달라지는 문제가 있어서, 로고는 강조색 개인화 대상에서 빼고 고정 이미지로 통일했다.
// (나머지 UI의 버튼/링크 등은 계속 사용자가 고른 강조색을 따른다)
export default function BackpackLogo({
  size = 76,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const radius = Math.round(size * 0.29);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/backpack-logo.png"
      alt="팩인백"
      width={size}
      height={size}
      className={`shrink-0 object-cover ${className ?? ""}`}
      style={{ width: size, height: size, borderRadius: radius }}
    />
  );
}
