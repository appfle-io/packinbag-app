// 회원가입 시 보여줄 랜덤 닉네임 생성기.
// "아이언맨", "헐크", "간달프" 같은 캐릭터의 느낌(강철 영웅, 괴력의 거인, 현명한 마법사 등)을
// 그대로 본떠서 만들되, 실제 등록상표/캐릭터명을 그대로 쓰지 않고 우리만의 말맛으로 재구성했다.
// 형용사 + 캐릭터풍 명사를 조합하고, 12자 제한을 넘지 않는 조합만 사용한다.

const ADJECTIVES = [
  "참신한",
  "용감한",
  "씩씩한",
  "든든한",
  "재빠른",
  "지혜로운",
  "반짝이는",
  "유쾌한",
  "다정한",
  "늠름한",
  "자유로운",
  "묵직한",
  "번쩍이는",
  "은은한",
  "쾌활한",
];

// 아이언맨(강철 갑옷 영웅) · 헐크(초록 괴력자) · 간달프(현명한 마법사) 등
// 만화/영화 캐릭터의 원형을 참고해 만든 오리지널 캐릭터풍 명사들
const CHARACTERS = [
  "강철영웅",
  "괴력거인",
  "초록거인",
  "번개전사",
  "마법사",
  "방패용사",
  "그림자닌자",
  "얼음여왕",
  "불꽃기사",
  "숲의요정",
  "은빛궁수",
  "천둥망치",
  "달빛마녀",
  "여행가",
  "모험가",
  "탐험대장",
  "수호자",
  "우주선장",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomNickname(): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = `${pick(ADJECTIVES)}${pick(CHARACTERS)}`;
    if (candidate.length <= 12) return candidate;
  }
  return "참신한여행가";
}
