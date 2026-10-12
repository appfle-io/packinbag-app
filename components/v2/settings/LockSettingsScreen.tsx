"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { Button, ListRow, SectionHeader, Toggle } from "@/components/v2/ui";
import { ConfirmSheet } from "@/components/v2/bag/sheets/ConfirmSheet";
import { PinSetupSheet, useLockGuard } from "@/components/v2/lock/LockUI";
import { authenticateBiometric, biometricLabel, getBiometricInfo, type BiometricType } from "@/lib/v2/biometric";
import { setSessionUnlocked } from "@/lib/v2/privateLock";
import { SubScreen } from "./SubScreen";

// 설정 > 잠금(2026-10-12, lib/v2/privateLock). PIN 만들기 · 바꾸기 · Face ID · 지금 잠그기 · 잠금 끄기.
// 무엇을 잠글지는 가방 더보기 · 팩 길게 누르기 · 팩 탭 길게 누르기에서 고른다
export function LockSettingsScreen({ onBack }: { onBack: () => void }) {
  const privacy = useLockGuard();
  const { show } = useToast();
  const [setup, setSetup] = useState<"create" | "change" | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const [bio, setBio] = useState<{ available: boolean; type: BiometricType }>({ available: false, type: "none" });
  useEffect(() => {
    void getBiometricInfo().then(setBio);
  }, []);

  const lock = privacy.lock;
  const bags = lock?.bags?.length ?? 0;
  const packs = (lock?.packs?.length ?? 0) + (lock?.library?.length ?? 0);
  const bioName = biometricLabel(bio.type);

  const toggleBio = async (on: boolean) => {
    if (!on) {
      privacy.setBiometricOn(false);
      return;
    }
    // 켤 때 한 번 확인해서 정말 되는지 본다
    if (await authenticateBiometric(`${bioName}로 잠금을 풀어요`)) {
      privacy.setBiometricOn(true);
      show(`이제 ${bioName}로 열 수 있어요`);
    } else {
      show(`${bioName}를 확인하지 못했어요`);
    }
  };

  return (
    <SubScreen title="잠금" onBack={onBack} bodyClassName="gap-8">
      {!privacy.hasPin ? (
        <section className="flex flex-col gap-4">
          <p className="m-0 text-body text-sub">
            가방이나 팩을 나만 볼 수 있게 PIN으로 잠가요. 함께 쓰는 사람에게는 잠금이 보이지 않고, 같은 계정이면 모든 기기에서 같은 PIN으로 열어요.
          </p>
          <Button block onClick={() => setSetup("create")}>
            PIN 만들기
          </Button>
          <p className="m-0 text-caption text-faint">PIN을 만든 뒤 가방 더보기, 팩을 길게 눌러 나오는 메뉴에서 잠글 수 있어요.</p>
        </section>
      ) : (
        <>
          <section className="flex flex-col">
            <SectionHeader>잠금</SectionHeader>
            <ListRow title="잠근 것" trailing={bags + packs > 0 ? `가방 ${bags} · 팩 ${packs}` : "아직 없어요"} divider />
            {bio.available && (
              <Toggle
                checked={privacy.biometricOn}
                onChange={(on) => void toggleBio(on)}
                label={`${bioName}로 열기`}
                description="이 기기에만 적용돼요. 안 되면 PIN으로 열어요"
                className="border-b border-line"
              />
            )}
            <ListRow
              title="PIN 바꾸기"
              subtitle={`지금 ${privacy.pinLength}자리`}
              chevron
              onClick={() => privacy.requireUnlock(() => setSetup("change"), { title: "지금 PIN을 입력해 주세요" })}
            />
            <ListRow
              divider={false}
              title="지금 잠그기"
              subtitle={privacy.unlocked ? "풀려 있는 잠금을 바로 다시 잠가요" : "모두 잠겨 있어요"}
              disabled={!privacy.unlocked}
              onClick={() => {
                setSessionUnlocked(false);
                show("모두 잠갔어요");
              }}
            />
          </section>
          <section className="flex flex-col gap-3">
            <p className="m-0 text-caption text-faint">
              한 번 풀면 앱을 나갈 때까지 잠긴 것이 모두 열려요. 앱을 나갔다 오면 다시 잠겨요. PIN을 5번 틀리면 잠시 기다려야 하고, 잊었으면 잠금 화면의 &quot;PIN을 잊었어요&quot;에서 계정 확인 뒤 다시 만들 수 있어요.
            </p>
            <Button
              variant="danger"
              className="self-start px-0"
              onClick={() => privacy.requireUnlock(() => setConfirmOff(true), { title: "지금 PIN을 입력해 주세요" })}
            >
              잠금 끄기
            </Button>
          </section>
        </>
      )}

      <PinSetupSheet
        open={setup !== null}
        mode={setup ?? "create"}
        onClose={() => setSetup(null)}
        onDone={() => {
          show(setup === "change" ? "PIN을 바꿨어요" : "PIN을 만들었어요. 이제 가방 · 팩을 잠글 수 있어요");
          setSetup(null);
        }}
      />
      <ConfirmSheet
        open={confirmOff}
        onClose={() => setConfirmOff(false)}
        title="잠금을 끌까요?"
        message="잠가 둔 가방과 팩이 모두 풀리고 PIN도 지워져요."
        confirmLabel="잠금 끄기"
        danger
        onConfirm={() => {
          void privacy.disable();
          show("잠금을 껐어요");
        }}
      />
      {privacy.element}
    </SubScreen>
  );
}
