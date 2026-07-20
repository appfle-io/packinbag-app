// app/admin/* 화면에서 app/api/admin/* 라우트를 호출할 때 쓰는 공용 fetch 헬퍼.
// Firebase Auth의 현재 로그인 유저 idToken을 Authorization 헤더에 자동으로 붙여준다.

import { auth } from "@/lib/firebase";

export class AdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function adminApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const user = auth.currentUser;
  if (!user) {
    throw new AdminApiError("로그인이 필요해요", 401);
  }
  const idToken = await user.getIdToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${idToken}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new AdminApiError((data as { error?: string })?.error ?? "요청에 실패했어요", res.status);
  }
  return data as T;
}
