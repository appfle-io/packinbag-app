const fs = require("fs");
const path = require("path");

const tagName = process.env.TAG_NAME || process.argv[2] || "v1.0.4-offline-portable";
const match = tagName.match(/^v(\d+\.\d+\.\d+)/);
const version = match ? match[1] : "1.0.4";
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
- 하단 **Assets** 영역에서 사용 중인 OS의 배포 파일을 다운로드하세요.
- **Windows**: \`Packinbag-offline-win-portable_*.zip\` (압축 해제 후 \`팩인백.exe\` 실행)
- **macOS**: \`Packinbag-offline-mac-portable_*.dmg\` 또는 \`Packinbag-offline-mac-portable_*.zip\`

> [!TIP]
> **macOS 실행 시 "손상되었기 때문에 열 수 없습니다" 안내가 표시될 때**:
> Apple 개발자 유료 서명이 미포함된 배포판이므로, macOS Gatekeeper 보안 정책에 의해 차단될 수 있습니다.
> 터미널에서 아래 명령어를 1회 입력하시면 정상 실행됩니다:
> \`\`\`bash
> xattr -cr /Applications/Packinbag.app
> # 또는 다운로드 폴더에서 압축 해제 후 바로 실행 시:
> xattr -cr ~/Downloads/Packinbag.app
> \`\`\`

### 주요 특징
- 별도의 설치 과정 없이 즉시 실행되는 포터블 에디션
- 모든 데이터가 내 PC 로컬에 안전하게 보관됨 (인터넷/로그인 불필요)
- 설정 > 데이터 백업 및 복원에서 .json 백업 파일 내보내기/불러오기 지원
`;

const outputPath = path.resolve(process.cwd(), "release-body.md");
fs.writeFileSync(outputPath, notes + footer, "utf8");
console.log("Release body successfully written to release-body.md");
