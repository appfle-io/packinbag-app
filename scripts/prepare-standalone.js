const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const standaloneDir = path.join(root, ".next", "standalone");
const publicDir = path.join(root, "public");
const staticDir = path.join(root, ".next", "static");

console.log("[Packinbag] Standalone 빌드 산출물 검사 및 에셋 준비 시작...");

if (!fs.existsSync(standaloneDir)) {
  console.error("  [오류] .next/standalone 디렉토리가 존재하지 않습니다.");
  process.exit(1);
}

// 1. server.js 위치 재귀 검색
function findServerJs(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === "server.js") {
      return fullPath;
    }
    if (entry.isDirectory() && entry.name !== "node_modules") {
      const found = findServerJs(fullPath);
      if (found) return found;
    }
  }
  return null;
}

const serverJsPath = findServerJs(standaloneDir);
if (serverJsPath) {
  const serverDir = path.dirname(serverJsPath);
  console.log(`  - server.js 발견: ${path.relative(standaloneDir, serverJsPath)}`);

  // 만약 server.js가 standaloneDir 최상위가 아니라면 최상위로 파일들을 끌어올림
  if (serverDir !== standaloneDir) {
    console.log("  - standalone 최상위로 파일 동기화 진행...");
    fs.cpSync(serverDir, standaloneDir, { recursive: true, force: true });
  }
} else {
  console.warn("  [경고] server.js를 찾지 못했습니다.");
}

// 2. public 및 .next/static 복사
const targetPublic = path.join(standaloneDir, "public");
const targetStatic = path.join(standaloneDir, ".next", "static");

if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, targetPublic, { recursive: true, force: true });
  console.log("  - public 디렉토리 복사 완료");
}

if (fs.existsSync(staticDir)) {
  fs.mkdirSync(path.dirname(targetStatic), { recursive: true });
  fs.cpSync(staticDir, targetStatic, { recursive: true, force: true });
  console.log("  - .next/static 디렉토리 복사 완료");
}

console.log("[Packinbag] Standalone 에셋 준비 완료!");
