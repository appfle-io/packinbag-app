import { Editor } from "@tiptap/react";
import { TableMap, cellAround, CellSelection } from "@tiptap/pm/tables";
import { Node as ProseMirrorNode } from "prosemirror-model";

export type TableDensity = "compact" | "normal" | "spacious";

export interface TableContextInfo {
  tableNode: ProseMirrorNode;
  tablePos: number;
  map: TableMap;
  colIndex: number;
  rowIndex: number;
  cellPos: number;
  cellNode: ProseMirrorNode;
  density: TableDensity;
}

/**
 * 현재 에디터 선택 영역에서 테이블과 현재 셀의 위치 정보를 가져옵니다.
 */
export function getTableContext(editor: Editor | null): TableContextInfo | null {
  if (!editor || !editor.state) return null;
  const { state } = editor;
  const { selection } = state;

  let cellPos: number | null = null;
  if (selection instanceof CellSelection) {
    cellPos = selection.$anchorCell.pos;
  } else {
    const resolved = cellAround(selection.$head);
    if (resolved) {
      cellPos = resolved.pos;
    }
  }

  if (cellPos === null) return null;

  const $cell = state.doc.resolve(cellPos);
  // tableNode는 보통 $cell.node(-1) (row)의 부모인 $cell.node(-2)
  let tableDepth = -1;
  for (let d = $cell.depth; d > 0; d--) {
    if ($cell.node(d).type.name === "table") {
      tableDepth = d;
      break;
    }
  }

  if (tableDepth === -1) return null;

  const tableNode = $cell.node(tableDepth);
  const tablePos = $cell.start(tableDepth) - 1;
  const map = TableMap.get(tableNode);

  const cellRelativePos = cellPos - (tablePos + 1);
  const rect = map.findCell(cellRelativePos);
  const cellNode = $cell.node();
  const density = (tableNode.attrs.density as TableDensity) || "normal";

  return {
    tableNode,
    tablePos,
    map,
    colIndex: rect.left,
    rowIndex: rect.top,
    cellPos,
    cellNode,
    density,
  };
}

/**
 * 현재 열의 너비를 delta(px)만큼 늘리거나 줄입니다.
 */
export function adjustColumnWidth(editor: Editor | null, deltaPx: number): boolean {
  const ctx = getTableContext(editor);
  if (!ctx || !editor) return false;

  const { tableNode, tablePos, map, colIndex } = ctx;
  const { state, view } = editor;
  const tr = state.tr;

  // 현재 열들의 너비 배열 수집 (없으면 기본 100px)
  const colWidths: number[] = [];
  for (let c = 0; c < map.width; c++) {
    let w = 0;
    for (let r = 0; r < map.height; r++) {
      const pos = map.map[r * map.width + c];
      const cell = tableNode.nodeAt(pos);
      if (cell && cell.attrs.colwidth && cell.attrs.colwidth[0]) {
        w = cell.attrs.colwidth[0];
        break;
      }
    }
    colWidths[c] = w > 0 ? w : 100;
  }

  const currentColWidth = colWidths[colIndex] || 100;
  const newColWidth = Math.max(50, currentColWidth + deltaPx);
  colWidths[colIndex] = newColWidth;

  // 모든 셀에 갱신된 colwidth 적용
  for (let r = 0; r < map.height; r++) {
    for (let c = 0; c < map.width; c++) {
      const pos = map.map[r * map.width + c];
      const absCellPos = tablePos + 1 + pos;
      const cell = state.doc.nodeAt(absCellPos);
      if (cell) {
        const colspan = cell.attrs.colspan || 1;
        // colwidth 배열 생성
        const targetWidths = colWidths.slice(c, c + colspan);
        if (JSON.stringify(cell.attrs.colwidth) !== JSON.stringify(targetWidths)) {
          tr.setNodeMarkup(absCellPos, undefined, {
            ...cell.attrs,
            colwidth: targetWidths,
          });
        }
      }
    }
  }

  if (tr.docChanged) {
    view.dispatch(tr);
    return true;
  }
  return false;
}

/**
 * 모든 열의 너비를 균등하게 분할합니다.
 */
export function distributeColumnWidths(editor: Editor | null): boolean {
  const ctx = getTableContext(editor);
  if (!ctx || !editor) return false;

  const { tableNode, tablePos, map } = ctx;
  const { state, view } = editor;
  const tr = state.tr;

  // 기존 열 너비 합계 계산 또는 기본 100px * 컬럼 수
  let totalWidth = 0;
  for (let c = 0; c < map.width; c++) {
    let w = 0;
    for (let r = 0; r < map.height; r++) {
      const pos = map.map[r * map.width + c];
      const cell = tableNode.nodeAt(pos);
      if (cell && cell.attrs.colwidth && cell.attrs.colwidth[0]) {
        w = cell.attrs.colwidth[0];
        break;
      }
    }
    totalWidth += w > 0 ? w : 100;
  }

  const evenWidth = Math.max(60, Math.round(totalWidth / map.width));
  const newColWidths = Array(map.width).fill(evenWidth);

  for (let r = 0; r < map.height; r++) {
    for (let c = 0; c < map.width; c++) {
      const pos = map.map[r * map.width + c];
      const absCellPos = tablePos + 1 + pos;
      const cell = state.doc.nodeAt(absCellPos);
      if (cell) {
        const colspan = cell.attrs.colspan || 1;
        const targetWidths = newColWidths.slice(c, c + colspan);
        tr.setNodeMarkup(absCellPos, undefined, {
          ...cell.attrs,
          colwidth: targetWidths,
        });
      }
    }
  }

  if (tr.docChanged) {
    view.dispatch(tr);
    return true;
  }
  return false;
}

/**
 * 열 너비를 초기화하여 컨테이너/내용물 자동 맞춤(Auto)으로 되돌립니다.
 */
export function resetColumnWidths(editor: Editor | null): boolean {
  const ctx = getTableContext(editor);
  if (!ctx || !editor) return false;

  const { tablePos, map } = ctx;
  const { state, view } = editor;
  const tr = state.tr;

  for (let r = 0; r < map.height; r++) {
    for (let c = 0; c < map.width; c++) {
      const pos = map.map[r * map.width + c];
      const absCellPos = tablePos + 1 + pos;
      const cell = state.doc.nodeAt(absCellPos);
      if (cell && cell.attrs.colwidth) {
        tr.setNodeMarkup(absCellPos, undefined, {
          ...cell.attrs,
          colwidth: null,
        });
      }
    }
  }

  if (tr.docChanged) {
    view.dispatch(tr);
    return true;
  }
  return false;
}

/**
 * 표의 밀도(행 높이/패딩: compact, normal, spacious)를 순환 변경합니다.
 */
export function cycleTableDensity(editor: Editor | null): TableDensity {
  const ctx = getTableContext(editor);
  if (!ctx || !editor) return "normal";

  const nextDensity: TableDensity =
    ctx.density === "normal"
      ? "spacious"
      : ctx.density === "spacious"
      ? "compact"
      : "normal";

  const { state, view } = editor;
  const tr = state.tr;

  tr.setNodeMarkup(ctx.tablePos, undefined, {
    ...ctx.tableNode.attrs,
    density: nextDensity,
  });

  if (tr.docChanged) {
    view.dispatch(tr);
  }
  return nextDensity;
}

/**
 * 현재 선택된 셀(들)의 배경색을 설정합니다.
 */
export function setCellBackgroundColor(editor: Editor | null, color: string | null): boolean {
  if (!editor) return false;
  return editor.chain().focus().setCellAttribute("backgroundColor", color).run();
}

/**
 * 현재 선택된 셀(들)의 텍스트 정렬을 설정합니다.
 */
export function setCellTextAlignment(
  editor: Editor | null,
  alignment: "left" | "center" | "right" | null
): boolean {
  if (!editor) return false;
  return editor.chain().focus().setCellAttribute("alignment", alignment).run();
}
