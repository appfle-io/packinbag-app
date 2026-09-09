const fs = require("fs");
const path = require("path");

const tagName = process.env.TAG_NAME || process.argv[2] || "v1.0.3-offline-portable";
const match = tagName.match(/^v(\d+\.\d+\.\d+)/);
const version = match ? match[1] : "1.0.3";
console.log(`Extracting release notes for version ${version} (tag: ${tagName})...`);

let notes = "";
const changelogPath = path.resolve(process.cwd(), "CHANGELOG.md");

if (fs.existsSync(changelogPath)) {
  const changelog = fs.readFileSync(changelogPath, "utf8");
  const targetHeader = `## [${version}]`;
  const startIdx = changelog.indexOf(targetHeader);

  if (startIdx !== -1) {
    const nextIdx = changelog.indexOf("\n## [", startIdx + targetHeader.length);
    notes = nextIdx !== -1
      ? changelog.slice(startIdx, nextIdx).trim()
      : changelog.slice(startIdx).trim();
    // 끝에 남아있을 수 있는 구분선 정리
    notes = notes.replace(/\n---\s*$/, "").trim();
  }
} else {
  console.warn("CHANGELOG.md not found at:", changelogPath);
}

if (!notes) {
  notes = `## [팩인백 오프라인 무설치 배포판 ${tagName}]\n\n인터넷이 없는 환경에서도 가방과 팩을 자유롭게 사용할 수 있는 무설치 포터블 버전입니다.`;
}

const footer = `

---

### 다운로드 및 실행 안내
- 하단 **Assets** 영역에서 사용 중인 OS의 압축 파일(.zip)을 다운로드하세요.
- **Windows**: \`Packinbag-offline-win-portable_*.zip\` (압축 해제 후 \`Pack In Bag.exe\` 실행)
- **macOS**: \`Packinbag-offline-mac-portable_*.zip\` (압축 해제 후 \`Pack In Bag.app\` 실행)

### 주요 특징
- 별도의 설치 과정 없이 즉시 실행되는 포터블 에디션
- 모든 데이터가 내 PC 로컬에 안전하게 보관됨 (인터넷/로그인 불필요)
- 설정 > 데이터 백업 및 복원에서 .json 백업 파일 내보내기/불러오기 지원
`;

const outputPath = path.resolve(process.cwd(), "release-body.md");
fs.writeFileSync(outputPath, notes + footer, "utf8");
console.log("Release body successfully written to release-body.md");
