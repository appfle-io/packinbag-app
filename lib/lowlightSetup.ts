import { createLowlight } from "lowlight";
import sql from "highlight.js/lib/languages/sql";
import java from "highlight.js/lib/languages/java";
import python from "highlight.js/lib/languages/python";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import json from "highlight.js/lib/languages/json";
import yaml from "highlight.js/lib/languages/yaml";
import bash from "highlight.js/lib/languages/bash";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import cpp from "highlight.js/lib/languages/cpp";
import kotlin from "highlight.js/lib/languages/kotlin";
import markdown from "highlight.js/lib/languages/markdown";
import plaintext from "highlight.js/lib/languages/plaintext";

export interface CodeLanguageInfo {
  id: string;
  label: string;
  badge: string;
  aliases: string[];
}

export const SUPPORTED_CODE_LANGUAGES: CodeLanguageInfo[] = [
  { id: "plaintext", label: "일반 텍스트", badge: "TXT", aliases: ["txt", "text", "plaintext"] },
  { id: "sql", label: "SQL", badge: "SQL", aliases: ["sql"] },
  { id: "java", label: "Java", badge: "JAVA", aliases: ["java"] },
  { id: "python", label: "Python", badge: "PY", aliases: ["py", "python"] },
  { id: "javascript", label: "JavaScript", badge: "JS", aliases: ["js", "javascript"] },
  { id: "typescript", label: "TypeScript", badge: "TS", aliases: ["ts", "typescript"] },
  { id: "json", label: "JSON", badge: "JSON", aliases: ["json"] },
  { id: "yaml", label: "YAML", badge: "YAML", aliases: ["yaml", "yml"] },
  { id: "bash", label: "Bash / Shell", badge: "SH", aliases: ["sh", "bash", "shell", "zsh"] },
  { id: "xml", label: "HTML / XML", badge: "HTML", aliases: ["html", "xml"] },
  { id: "css", label: "CSS", badge: "CSS", aliases: ["css", "scss"] },
  { id: "cpp", label: "C / C++", badge: "C++", aliases: ["c", "cpp", "c++"] },
  { id: "kotlin", label: "Kotlin", badge: "KT", aliases: ["kt", "kotlin"] },
  { id: "markdown", label: "Markdown", badge: "MD", aliases: ["md", "markdown"] },
];

export const lowlight = createLowlight();

// 14개 대표 언어 등록
lowlight.register("sql", sql);
lowlight.register("java", java);
lowlight.register("python", python);
lowlight.register("javascript", javascript);
lowlight.register("typescript", typescript);
lowlight.register("json", json);
lowlight.register("yaml", yaml);
lowlight.register("bash", bash);
lowlight.register("xml", xml);
lowlight.register("css", css);
lowlight.register("cpp", cpp);
lowlight.register("kotlin", kotlin);
lowlight.register("markdown", markdown);
lowlight.register("plaintext", plaintext);

// 별칭(alias) 정규화 맵
const ALIAS_MAP = new Map<string, string>();
for (const lang of SUPPORTED_CODE_LANGUAGES) {
  for (const alias of lang.aliases) {
    ALIAS_MAP.set(alias.toLowerCase(), lang.id);
  }
}

/**
 * 임의의 언어 문자열(예: 'py', 'SQL', 'txt')을 등록된 표준 언어 id로 정규화합니다.
 */
export function normalizeLanguage(lang?: string | null): string {
  if (!lang) return "plaintext";
  const clean = lang.trim().toLowerCase();
  return ALIAS_MAP.get(clean) || (lowlight.listLanguages().includes(clean) ? clean : "plaintext");
}

/**
 * 언어 id로 표시용 뱃지(예: 'PY', 'SQL', 'JAVA')를 가져옵니다.
 */
export function getLanguageBadge(lang?: string | null): string {
  const norm = normalizeLanguage(lang);
  const found = SUPPORTED_CODE_LANGUAGES.find((l) => l.id === norm);
  return found ? found.badge : norm.toUpperCase();
}

/**
 * 언어 id로 표시용 한글/영문 라벨을 가져옵니다.
 */
export function getLanguageLabel(lang?: string | null): string {
  const norm = normalizeLanguage(lang);
  const found = SUPPORTED_CODE_LANGUAGES.find((l) => l.id === norm);
  return found ? found.label : norm;
}
