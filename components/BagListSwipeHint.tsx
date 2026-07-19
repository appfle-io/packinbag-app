"use client";

import { useEffect, useRef, useState } from "react";
import { IconBackpack } from "@tabler/icons-react";

// v?: 팩 보관함(PacksScreen) 오른쪽 가장자리에 떠 있는 원형 버튼 - 가방 보관함(HomeScreen)으로
// 돌아갈 수 있다는 걸 알려준다. PackTreeSwipeHint(가방보관함 왼쪽의 팩 트리 열기 버튼)를
// 좌우로 그대로 뒤집은 대칭 버전이다 - 위치만 반대(오른쪽)고, 당기는 방향도 반대(왼쪽)다.
//
// - 몇 초에 한 번씩 스스로 왼쪽으로 당겨졌다가 탄성 있게 돌아오는 시범 동작을 반복해서
//   보여준다. 이때 버튼 왼쪽에 화살표(←)가 버튼과 정확히 같은 타이밍으로 함께 나타났다
//   사라진다.
// - 탭하면 바로 가방 보관함으로 돌아간다.
// - 왼쪽으로 당겨서 놓아도(드래그) 충분히 당겼으면 닫히고, 덜 당겼으면 고무줄처럼 통통
//   튕기며 되돌아간다(스프링 물리 시뮬레이션). PacksScreen 자체에 이미 있는 우→왼 스와이프
//   닫기 제스처와 자연스럽게 이어지는 방향이다.
//
// on/off는 PackTreeSwipeHint와 동일하게 계정 설정(UserProfile.packSettings.packTreeHintEnabled,
// 설정 > 팩 설정 > "가방 보관함 ↔ 팩 보관함 이동 버튼")으로 함께 관리한다 - 별도 토글을 만들지
// 않고, 가방↔팩 양방향 버튼이 한 스위치로 같이 켜지고 꺼진다. 꺼도 오른쪽 엣지에서 왼쪽으로
// 스와이프하는 제스처 자체(PacksScreen의 useSwipeBack)는 계속 살아있다.
//
// 위치 주의: PackTreeSwipeHint와 마찬가지로 position: absolute + 부모(relative 앱 컬럼)
// 조합으로 둬야 데스크톱에서도 앱 컬럼 안쪽에 붙는다.
const OPEN_THRESHOLD = 46; // 이 이상 왼쪽으로 당기면 손을 놓았을 때 닫힘(가방 보관함으로 이동)
const MAX_VISUAL_PULL = 90;
const TAP_MOVE_TOLERANCE = 8;
const BTN_SIZE = 52;
const REST_RIGHT = 8; // 평소 버튼이 오른쪽 벽에서 떨어진 거리

const SPRING_STIFFNESS = 210;
const SPRING_DAMPING = 9;

export default function BagListSwipeHint({
  enabled,
  onOpen,
}: {
  // 설정 > 팩 설정의 토글값 (profile?.packSettings?.packTreeHintEnabled ?? true) - PackTreeSwipeHint와 공유.
  enabled: boolean;
  onOpen: () => void;
}) {
  const [pull, setPull] = useState(0); // 왼쪽으로 당긴 거리(감쇠 적용됨, 항상 0 이상)
  const [dragging, setDragging] = useState(false);
  const [springing, setSpringing] = useState(false);
  const [justOpened, setJustOpened] = useState(false);
  const startXRef = useRef<number | null>(null);
  const rawLeftDxRef = useRef(0); // 왼쪽으로 이동한 거리(양수일수록 많이 당김)
  const movedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!enabled) return null;

  const applyResistance = (leftDx: number) => {
    const clamped = Math.max(0, leftDx);
    return MAX_VISUAL_PULL * (1 - Math.exp(-clamped / 85));
  };

  const runSpringBack = (initialDisplacement: number) => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    let displacement = initialDisplacement;
    let velocity = 0;
    let lastTime = performance.now();
    setSpringing(true);

    const step = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.032);
      lastTime = now;
      const accel = -SPRING_STIFFNESS * displacement - SPRING_DAMPING * velocity;
      velocity += accel * dt;
      displacement += velocity * dt;
      setPull(displacement);
      if (Math.abs(displacement) < 0.4 && Math.abs(velocity) < 6) {
        setPull(0);
        setSpringing(false);
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const endDrag = (finalLeftDx: number) => {
    setDragging(false);
    startXRef.current = null;
    if (!movedRef.current) {
      // 거의 안 움직였으면 드래그가 아니라 탭 - 바로 가방 보관함으로 이동.
      onOpen();
      return;
    }
    if (finalLeftDx >= OPEN_THRESHOLD) {
      setJustOpened(true);
      setPull(MAX_VISUAL_PULL);
      setTimeout(() => onOpen(), 90);
    } else {
      runSpringBack(pull);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (justOpened) return;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    startXRef.current = e.clientX;
    rawLeftDxRef.current = 0;
    movedRef.current = false;
    setSpringing(false);
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (startXRef.current === null) return;
    const dx = e.clientX - startXRef.current;
    const leftDx = -dx; // 왼쪽으로 당길수록 양수
    rawLeftDxRef.current = leftDx;
    if (Math.abs(dx) > TAP_MOVE_TOLERANCE) movedRef.current = true;
    setPull(applyResistance(leftDx));
  };

  const handlePointerUp = () => {
    if (startXRef.current === null) return;
    endDrag(rawLeftDxRef.current);
  };

  return (
    <>
      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label="가방 보관함으로 이동"
        className="absolute flex items-center justify-center select-none"
        style={{
          right: REST_RIGHT + pull,
          top: "50%",
          width: BTN_SIZE,
          height: BTN_SIZE,
          borderRadius: 9999,
          transform: "translateY(-50%)",
          background: "var(--accent)",
          boxShadow: "0 6px 16px -2px color-mix(in srgb, var(--accent) 55%, transparent), 0 2px 6px rgba(0,0,0,0.15)",
          touchAction: "none",
          cursor: "grab",
          transition: dragging || springing ? "none" : "right 200ms ease",
          animation: dragging || springing ? "none" : "pib-hint-demo-rev 1.8s ease-in-out infinite",
        }}
      >
        <IconBackpack size={24} stroke={1.75} color="#fff" />
      </button>

      {/* 버튼이 스스로 왼쪽으로 당겨지는 시범 동작과 정확히 같은 타이밍(1.8s ease-in-out)으로
          함께 움직이는 화살표(←) - PackTreeSwipeHint의 화살표를 좌우로 뒤집은 버전. 드래그/스프링
          중에는 렌더링하지 않는다(시범 동작 전용). */}
      {!dragging && !springing && (
        <span
          aria-hidden="true"
          className="absolute select-none pointer-events-none"
          style={{
            right: -18,
            top: "50%",
            color: "var(--accent)",
            fontSize: 18,
            lineHeight: 1,
            fontWeight: 600,
            animation: "pib-hint-arrow-rev 1.8s ease-in-out infinite",
          }}
        >
          ←
        </span>
      )}

      <style jsx>{`
        @keyframes pib-hint-demo-rev {
          0%,
          11% {
            transform: translateY(-50%) translateX(0);
          }
          39% {
            transform: translateY(-50%) translateX(-22px);
          }
          58% {
            transform: translateY(-50%) translateX(-17px);
          }
          81%,
          100% {
            transform: translateY(-50%) translateX(0);
          }
        }
        @keyframes pib-hint-arrow-rev {
          0%,
          11% {
            opacity: 0;
            transform: translateY(-50%) translateX(0);
          }
          39% {
            opacity: 1;
            transform: translateY(-50%) translateX(-22px);
          }
          58% {
            opacity: 1;
            transform: translateY(-50%) translateX(-17px);
          }
          81%,
          100% {
            opacity: 0;
            transform: translateY(-50%) translateX(0);
          }
        }
      `}</style>
    </>
  );
}
