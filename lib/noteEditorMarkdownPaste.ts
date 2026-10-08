import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

// 메모팩 편집기: 마크다운 글을 붙여넣으면 서식으로 바꿔 넣는다(2026-10-03).
// ChatGPT·Claude 답변, .md 파일, 노션/깃허브에서 "마크다운으로" 복사한 글이 대상이다.
//
// 언제 바꾸나
// - 붙여넣는 글(text/plain)이 마크다운처럼 보일 때만(표, # 제목, ``` 코드, - [ ] 체크, **굵게**, [링크](url), 목록 2줄 이상)
// - 클립보드에 이미 서식 있는 HTML(표·제목·목록·굵게 등)이 같이 오면 그쪽이 더 정확하니 손대지 않는다(웹페이지·메모앱 복사)
// - 코드 블록 안, 표 안에서는 바꾸지 않는다(표 안에 표를 넣을 수 없고, 코드는 글자 그대로가 맞다)
//
// 바꾸는 것: 표(정렬 포함) · 제목 # ## ###(#### 이상은 제목3) · 글머리/번호 목록 · 체크 목록 · ``` 코드 블록 ·
//           구분선 · **굵게** __굵게__ *기울임* ~~취소선~~ `코드` [글](링크)
// 인용(>)은 이 편집기에서 토글 블록이 > 를 쓰므로 그냥 문단으로 넣는다.
// 외부 라이브러리 없이 이 파일 안에서 처리한다(서버 호출 없음).

const PH_START = "\uE000";
const PH_END = "\uE001";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inline(md: string): string {
  // 코드 스팬은 안쪽 글자를 서식으로 해석하지 않도록 먼저 빼 둔다
  const codes: string[] = [];
  let s = md.replace(/`([^`]+)`/g, (_m, c: string) => {
    codes.push(c);
    return `${PH_START}${codes.length - 1}${PH_END}`;
  });
  s = escapeHtml(s);
  s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g, (_m, t: string, u: string) => `<a href="${u}">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(new RegExp(`${PH_START}(\\d+)${PH_END}`, "g"), (_m, i: string) => `<code>${escapeHtml(codes[Number(i)] ?? "")}</code>`);
  return s;
}

// | a | b | 한 줄을 칸으로. \| 는 칸 구분이 아닌 글자
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (ch === "|") {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

const SEPARATOR_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const isSeparator = (line: string) => SEPARATOR_RE.test(line) && line.includes("-");

function alignOf(cell: string): string | null {
  const c = cell.trim();
  if (c.startsWith(":") && c.endsWith(":")) return "center";
  if (c.endsWith(":")) return "right";
  return null;
}

const FENCE_RE = /^\s*```\s*([\w+-]*)\s*$/;
const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.*)$/;
const HR_RE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const LIST_RE = /^\s*([-*+]|\d+[.)])\s+(.*)$/;
const TASK_RE = /^\[( |x|X)\]\s+(.*)$/;

const isTableStart = (lines: string[], i: number) => lines[i].includes("|") && i + 1 < lines.length && isSeparator(lines[i + 1]);

function isBlockStart(lines: string[], i: number): boolean {
  const l = lines[i];
  return FENCE_RE.test(l) || HEADING_RE.test(l) || HR_RE.test(l) || LIST_RE.test(l) || isTableStart(lines, i);
}

function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    const fence = line.match(FENCE_RE);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++;
      const lang = fence[1] ? ` class="language-${escapeHtml(fence[1])}"` : "";
      out.push(`<pre><code${lang}>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }

    if (isTableStart(lines, i)) {
      const head = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map(alignOf);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) rows.push(splitRow(lines[i++]));
      const cell = (tag: "th" | "td", text: string, c: number) => {
        const align = aligns[c] ? ` style="text-align: ${aligns[c]}"` : "";
        return `<${tag}${align}><p>${inline(text)}</p></${tag}>`;
      };
      const width = head.length;
      const headHtml = `<tr>${head.map((h, c) => cell("th", h, c)).join("")}</tr>`;
      const bodyHtml = rows.map((r) => `<tr>${Array.from({ length: width }, (_v, c) => cell("td", r[c] ?? "", c)).join("")}</tr>`).join("");
      out.push(`<table><tbody>${headHtml}${bodyHtml}</tbody></table>`);
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = Math.min(3, heading[1].length);
      out.push(`<h${level}>${inline(heading[2].replace(/\s+#+\s*$/, ""))}</h${level}>`);
      i++;
      continue;
    }

    if (HR_RE.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    if (LIST_RE.test(line)) {
      type Entry = { kind: "task" | "ol" | "ul"; checked: boolean; text: string };
      const entries: Entry[] = [];
      while (i < lines.length && LIST_RE.test(lines[i])) {
        const m = lines[i].match(LIST_RE)!;
        const ordered = /\d/.test(m[1]);
        const task = !ordered ? m[2].match(TASK_RE) : null;
        entries.push(
          task
            ? { kind: "task", checked: task[1].toLowerCase() === "x", text: task[2] }
            : { kind: ordered ? "ol" : "ul", checked: false, text: m[2] },
        );
        i++;
      }
      // 같은 종류끼리 묶어서 목록 하나로
      let k = 0;
      while (k < entries.length) {
        const kind = entries[k].kind;
        const group: Entry[] = [];
        while (k < entries.length && entries[k].kind === kind) group.push(entries[k++]);
        if (kind === "task") {
          out.push(
            `<ul data-type="taskList">${group
              .map((e) => `<li data-type="taskItem" data-checked="${e.checked}"><p>${inline(e.text)}</p></li>`)
              .join("")}</ul>`,
          );
        } else {
          out.push(`<${kind}>${group.map((e) => `<li><p>${inline(e.text)}</p></li>`).join("")}</${kind}>`);
        }
      }
      continue;
    }

    // 문단: 빈 줄이나 다른 블록이 나올 때까지. 줄바꿈은 그대로 살린다(메모는 줄 단위로 쓰는 경우가 많다)
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && (para.length === 0 || !isBlockStart(lines, i))) {
      para.push(inline(lines[i].replace(/^\s*>\s?/, "")));
      i++;
    }
    out.push(`<p>${para.join("<br>")}</p>`);
  }

  return out.join("");
}

function looksLikeMarkdown(text: string): boolean {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines.some((_l, i) => isTableStart(lines, i))) return true;
  if (lines.some((l) => FENCE_RE.test(l) || HEADING_RE.test(l))) return true;
  if (/^\s*[-*+]\s+\[[ xX]\]\s+/m.test(text)) return true;
  if (/\*\*[^*\n]+\*\*/.test(text) || /\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)/.test(text)) return true;
  return lines.filter((l) => /^\s*([-*+]|\d+[.)])\s+\S/.test(l)).length >= 2;
}

// 클립보드 HTML에 이미 구조(표·제목·목록·굵게 등)가 있으면 브라우저/TipTap 기본 붙여넣기가 더 정확하다
const RICH_HTML_RE = /<(table|h[1-6]|ul|ol|li|strong|b|em|i|pre|blockquote)[\s>]/i;

export const MarkdownPaste = Extension.create({
  name: "markdownPaste",

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("markdownPaste"),
        props: {
          handlePaste: (view, event) => {
            if (!editor.isEditable) return false;
            const data = event.clipboardData;
            if (!data) return false;
            const text = data.getData("text/plain");
            if (!text || !looksLikeMarkdown(text)) return false;
            const html = data.getData("text/html");
            if (html && RICH_HTML_RE.test(html)) return false;

            const { $from } = view.state.selection;
            if ($from.parent.type.spec.code) return false;
            for (let d = $from.depth; d > 0; d--) {
              if ($from.node(d).type.name === "table") return false;
            }

            editor.commands.insertContent(markdownToHtml(text));
            return true;
          },
        },
      }),
    ];
  },
});
