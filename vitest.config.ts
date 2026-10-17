import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 단위테스트(2026-10-17). Firebase를 부르지 않는 순수 함수만.
// 실행: npm test / 한 묶음만: npm test -- -t PREM-JUDGE (테스트 이름 앞에 docs/spec의 ID를 붙인다)
const root = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: root }],
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "hooks/**/*.test.ts"],
  },
});
