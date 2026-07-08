// 회원가입/설정에서 고를 수 있는 간단한 샘플 아바타 목록.
// 사용자가 직접 이미지를 업로드하는 게 아니라, 여기 정의된 것 중에서만 고른다.
// 실제 캐릭터 그림 대신 이모지 + 배경색 조합으로 가볍고 산뜻한 "일러스트" 느낌을 낸다.

export interface AvatarOption {
  id: string;
  emoji: string;
  bg: string; // 배경 그라디언트 시작색
  bg2: string; // 배경 그라디언트 끝색
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: "hero", emoji: "🦸", bg: "#ff6b6b", bg2: "#ffa06b" },
  { id: "villain", emoji: "🦹", bg: "#6b6bff", bg2: "#8f6bff" },
  { id: "wizard", emoji: "🧙", bg: "#5b8def", bg2: "#7fd0e8" },
  { id: "elf", emoji: "🧝", bg: "#4caf7d", bg2: "#8bd98b" },
  { id: "robot", emoji: "🤖", bg: "#8a8f98", bg2: "#b9c0cc" },
  { id: "alien", emoji: "👽", bg: "#43c96a", bg2: "#9be89b" },
  { id: "ghost", emoji: "👻", bg: "#9aa0ff", bg2: "#c9cdff" },
  { id: "ninja", emoji: "🥷", bg: "#3a3f47", bg2: "#636b78" },
  { id: "dragon", emoji: "🐉", bg: "#3fae5c", bg2: "#a3e6b0" },
  { id: "unicorn", emoji: "🦄", bg: "#ff9de2", bg2: "#c6a8ff" },
  { id: "lion", emoji: "🦁", bg: "#f6a835", bg2: "#ffd580" },
  { id: "fox", emoji: "🦊", bg: "#ff8a4c", bg2: "#ffc38a" },
  { id: "panda", emoji: "🐼", bg: "#4a4a4a", bg2: "#9a9a9a" },
  { id: "owl", emoji: "🦉", bg: "#8b6b4a", bg2: "#cba876" },
  { id: "penguin", emoji: "🐧", bg: "#37474f", bg2: "#78909c" },
  { id: "cat", emoji: "🐱", bg: "#f2994a", bg2: "#f2c94c" },
  { id: "dog", emoji: "🐶", bg: "#c48a5a", bg2: "#e8c39a" },
  { id: "koala", emoji: "🐨", bg: "#7d8b96", bg2: "#c1cdd6" },
];

export function getAvatar(avatarId: string | null | undefined): AvatarOption {
  return (
    AVATAR_OPTIONS.find((a) => a.id === avatarId) ?? AVATAR_OPTIONS[0]
  );
}

export function randomAvatarId(): string {
  return AVATAR_OPTIONS[Math.floor(Math.random() * AVATAR_OPTIONS.length)].id;
}
