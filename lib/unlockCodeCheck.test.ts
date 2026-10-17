import { describe, expect, it } from "vitest";
import { isUnlockCodeValidFor } from "@/lib/unlockCodeCheck";

// docs/spec/premium.md PREM-JUDGE-03: 이용권은 claimed + claimedBy.uid가 본인 + 만료 전일 때만
const ME = "uid-me";
const at = (ms: number) => ({ toDate: () => new Date(ms) });
const claimed = (extra: Record<string, unknown> = {}) => ({ status: "claimed", claimedBy: { uid: ME }, ...extra });

describe("isUnlockCodeValidFor", () => {
  it("PREM-JUDGE-03 코드 문서가 없으면 아님", () => {
    expect(isUnlockCodeValidFor(undefined, ME)).toBe(false);
  });

  it("PREM-JUDGE-03 아직 아무도 안 쓴 코드(unused)를 써넣어도 아님", () => {
    expect(isUnlockCodeValidFor({ status: "unused" }, ME)).toBe(false);
  });

  it("PREM-JUDGE-03 무효화된 코드는 아님", () => {
    expect(isUnlockCodeValidFor(claimed({ status: "invalidated" }), ME)).toBe(false);
  });

  it("PREM-JUDGE-03 남이 쓴 코드는 아님", () => {
    expect(isUnlockCodeValidFor(claimed({ claimedBy: { uid: "someone-else" } }), ME)).toBe(false);
    expect(isUnlockCodeValidFor({ status: "claimed" }, ME)).toBe(false);
  });

  it("PREM-JUDGE-03 내가 쓴 무기한 코드는 맞음", () => {
    expect(isUnlockCodeValidFor(claimed(), ME)).toBe(true);
  });

  it("PREM-JUDGE-03 만료 전이면 맞고, 지났으면 아님", () => {
    expect(isUnlockCodeValidFor(claimed({ expiresAt: at(Date.now() + 60_000) }), ME)).toBe(true);
    expect(isUnlockCodeValidFor(claimed({ expiresAt: at(Date.now() - 60_000) }), ME)).toBe(false);
  });

  it("PREM-JUDGE-03 expiresAt이 비어 있으면 무기한", () => {
    expect(isUnlockCodeValidFor(claimed({ expiresAt: null }), ME)).toBe(true);
  });
});
