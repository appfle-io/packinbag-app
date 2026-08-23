import { Bag, Pack } from "./types";

/**
 * TipTap 에디터 JSON(pack.editorDoc)을 Firestore 저장용으로 안전하게 직렬화/역직렬화하는 유틸.
 *
 * Firestore는 문서 내 객체/배열의 최대 중첩 깊이를 20단계로 제한합니다.
 * 목록(orderedList) 안에 접기(toggleBlock) 및 텍스트 서식(marks)이 들어가면
 * Bag -> packs -> pack -> editorDoc -> orderedList -> listItem -> toggleBlock -> toggleContent -> paragraph -> text -> marks...
 * 계층이 20단계를 쉽게 초과하여 Firestore 오류가 발생합니다.
 *
 * Firestore에 저장할 때는 editorDoc을 JSON 문자열로 직렬화하여 깊이를 1단계로 줄이고,
 * Firestore에서 읽어올 때는 JSON 객체로 파싱하여 앱 전반에서 객체 형태로 동일하게 다룰 수 있게 합니다.
 * 기존에 이미 Map 객체로 저장되어 있던 과거 데이터도 문제없이 수용합니다.
 */

export function serializePack(pack: Pack): Pack {
  if (!pack) return pack;
  if (pack.kind === "editor" || pack.editorDoc !== undefined) {
    if (pack.editorDoc !== null && typeof pack.editorDoc === "object") {
      try {
        return {
          ...pack,
          // Firestore에는 직렬화된 JSON 문자열로 저장
          editorDoc: JSON.stringify(pack.editorDoc) as unknown as object,
        };
      } catch (err) {
        console.error("[editorDocSerialize] 직렬화 실패:", err);
      }
    }
  }
  return pack;
}

export function deserializePack(pack: Pack): Pack {
  if (!pack) return pack;
  if (typeof pack.editorDoc === "string") {
    try {
      return {
        ...pack,
        editorDoc: JSON.parse(pack.editorDoc),
      };
    } catch (err) {
      console.error("[editorDocSerialize] 역직렬화 실패:", err);
    }
  }
  return pack;
}

export function serializeBag(bag: Bag): Bag {
  if (!bag) return bag;
  return {
    ...bag,
    packs: Array.isArray(bag.packs) ? bag.packs.map(serializePack) : [],
  };
}

export function deserializeBag(bag: Bag): Bag {
  if (!bag) return bag;
  return {
    ...bag,
    packs: Array.isArray(bag.packs) ? bag.packs.map(deserializePack) : [],
  };
}

export function normalizeEditorDoc(doc: unknown): object | undefined {
  if (!doc) return undefined;
  if (typeof doc === "string") {
    try {
      return JSON.parse(doc);
    } catch {
      return undefined;
    }
  }
  if (typeof doc === "object") {
    return doc as object;
  }
  return undefined;
}
