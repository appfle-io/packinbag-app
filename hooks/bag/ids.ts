// 가방 안에서 새로 만드는 팩/아이템 id. 구 BagEditorScreen의 uid()와 같은 형식이다.
export const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;