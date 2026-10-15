import { adminDb } from "@/lib/firebaseAdmin";
import { SharedPackSnapshot, Pack } from "@/lib/types";
import { deserializePack } from "@/lib/editorDocSerialize";
import { notFound } from "next/navigation";
import { GuestPackViewV2 } from "@/components/v2/guest/GuestPackViewV2";
import { GuestEnded } from "@/components/v2/guest/GuestShell";

// 예전에는 force-dynamic이라 볼 때마다 함수 실행 + Firestore 읽기가 생겼다. 5분 캐시하고,
// 공유를 갱신 · 끄면 app/api/share-pack · unshare-pack이 revalidatePath로 곧바로 비운다(2026-10-07).
export const revalidate = 300;

interface GuestPackPageProps {
  params: Promise<{ token: string }>;
}

// 2026-10-15: v2 화면(components/v2/guest)으로 바꿨다. 폴더 공유는 하위 폴더까지 들어 있어 이름으로 묶어 보여 준다
export default async function GuestPackPage({ params }: GuestPackPageProps) {
  const { token } = await params;
  if (!token) notFound();

  const docSnap = await adminDb().collection("sharedPacks").doc(token).get();
  if (!docSnap.exists) {
    return <GuestEnded title="공유가 끝났거나 없는 팩이에요" message="링크가 만료됐거나 공유가 꺼졌어요." />;
  }

  const snapshot = docSnap.data() as SharedPackSnapshot;
  const isFolder = snapshot.type === "folder";
  const raw: Pack[] = isFolder ? snapshot.packs ?? [] : snapshot.pack ? [snapshot.pack] : [];
  const entries = raw.map(deserializePack);

  return <GuestPackViewV2 token={token} title={snapshot.title} isFolder={isFolder} entries={entries} />;
}
