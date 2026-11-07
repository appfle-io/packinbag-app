// 메모 읽기 모드 키(UserProfile.noteReadMode). 가방 안 메모는 가방마다 다르게 기억한다
export function noteReadModeKey(packId: string, bagId?: string): string {
  return bagId ? `${bagId}_${packId}` : packId;
}
