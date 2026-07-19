"use client";

import { useEffect, useRef, useState } from "react";
import { IconPackage } from "@tabler/icons-react";

// v69: 가방보관함 왼쪽 가장자리에 떠 있는 원형 버튼 - 팩 트리(PacksScreen)를 열 수 있다는
// 걸 알려준다. 빠른팩 바(QuickPackBar)의 접힌 버블과 같은 스타일(원형, 강조색 배경)로
// 통일하고, 기존에 쓰던 소포(팩) 아이콘(IconPackage)을 그대로 쓴다.
//
// 그냥 가만히 떠있는 버튼이 아니라, 몇 초에 한 번씩 스스로 옆으로 당겨졌다가 탄성 있게
// 돌아오는 "이 버튼을 옆으로 당겨보세요"라는 시범 동작을 반복해서 보여준다. 이때 버튼
// 오른쪽에 화살표(→)가 버튼과 정확히 같은 타이밍으로 함께 나타났다 사라진다 - 버튼이
// 오른쪽으로 움직이는 동안 화살표도 같이 오른쪽으로 등장하고(opacity 0→1), 버튼이 다시
// 왼쪽으로 돌아오면 화살표도 같이 사라진다(opacity 1→0). 두 애니메이션이 완전히 같은
// duration/easing이라 항상 같은 박자로 움직인다.
// - 탭하면 바로 팩 트리가 열린다.
// - 옆으로 당겨서 놓아도(드래그) 충분히 당겼으면 열리고, 덜 당겼으면 고무줄처럼 통통
//   튕기며 되돌아간다(스프링 물리 시뮬레이션).
//
// on/off는 계정 설정(UserProfile.packSettings.packTreeHintEnabled, 설정 > 팩 설정)으로만
// 관리한다. 꺼도 왼쪽 엣지 스와이프 제스처 자체는 계속 살아있다 - 이 버튼은 그 존재를
// 알려주는 눈에 보이는 힌트일 뿐이다.
//
// 위치 주의: 앱 화면이 데스크톱에서는 max-w-3xl로 가운데 정렬된 컬럼이라, position: fixed를
// 쓰면 브라우저 창의 진짜 왼쪽 끝에 붙어버려서 실제 앱 컬럼과 동떨어져 보인다. 그래서
// position: absolute로 두고, 부모(AppShell의 앱 컬럼 div)가 relative여야 한다.
const OPEN_THRESHOLD = 46; // 이 이상 당기면 손을 놓았을 때 열림
const MAX_VISUAL_PULL = 90; // 화면상 최대로 늘어나 보이는 거리(그 이상 당겨도 시각적으로는 여기서 saturate)
const TAP_MOVE_TOLERANCE = 8; // 이 이하로만 움직였으면 드래그가 아니라 탭으로 간주
const BTN_SIZE = 52;
const REST_LEFT = 8; // 평소 버튼이 벽에서 떨어진 거리

const SPRING_STIFFNESS = 210;
const SPRING_DAMPING = 9;

export default function PackTreeSwipeHint({
  enabled,
  onOpen,
}: {
  // 설정 > 팩 설정의 토글값 (profile?.packSettings?.packTreeHintEnabled ?? true).
  enabled: boolean;
  onOpen: () => void;
}) {
  const [pull, setPull] = useState(0); // 드래그로 인한 추가 이동 거리(감쇠 적용됨)
  const [dragging, setDragging] = useState(false);
  const [springing, setSpringing] = useState(false);
  const [justOpened, setJustOpened] = useState(false);
  const startXRef = useRef<number | null>(null);
  const rawDxRef = useRef(0);
  const movedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!enabled) return null;

  const applyResistance = (dx: number) => {
    const clamped = Math.max(0, dx);
    return MAX_VISUAL_PULL * (1 - Math.exp(-clamped / 85));
  };

  // 진짜 고무줄처럼 통통 튕기며 되돌아가는 스프링 시뮬레이션 (질량-스프링-감쇠 모델).
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

  const endDrag = (finalRawDx: number) => {
    setDragging(false);
    startXRef.current = null;
    if (!movedRef.current) {
      // 거의 안 움직였으면 드래그가 아니라 탭 - 바로 열어준다.
      onOpen();
      return;
    }
    if (finalRawDx >= OPEN_THRESHOLD) {
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
    rawDxRef.current = 0;
    movedRef.current = false;
    setSpringing(false);
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (startXRef.current === null) return;
    const dx = e.clientX - startXRef.current;
    rawDxRef.current = dx;
    if (Math.abs(dx) > TAP_MOVE_TOLERANCE) movedRef.current = true;
    setPull(applyResistance(dx));
  };

  const handlePointerUp = () => {
    if (startXRef.current === null) return;
    endDrag(rawDxRef.current);
  };

  return (
    <>
      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label="팩 보관함 열기"
        className="absolute flex items-center justify-center select-none"
        style={{
          left: REST_LEFT + pull,
          top: "50%",
          width: BTN_SIZE,
          height: BTN_SIZE,
          borderRadius: 9999,
          transform: "translateY(-50%)",
          background: "var(--accent)",
          boxShadow: "0 6px 16px -2px color-mix(in srgb, var(--accent) 55%, transparent), 0 2px 6px rgba(0,0,0,0.15)",
          touchAction: "none",
          cursor: "grab",
          transition: dragging || springing ? "none" : "left 200ms ease",
          animation: dragging || springing ? "none" : "pib-hint-demo 1.8s ease-in-out infinite",
        }}
      >
        <IconPackage size={24} stroke={1.75} color="#fff" />
      </button>

      {/* 버튼이 스스로 오른쪽으로 당겨지는 시범 동작과 정확히 같은 타이밍(1.8s ease-in-out)으로
          함께 움직이는 화살표 - 깜빡이며 갑자기 나타나지 않고, 버튼과 함께 오른쪽으로 따라나오면서
          등장하고(opacity 0→1), 버튼이 되돌아가면 같이 사라진다(opacity 1→0). 드래그/스프링 중에는
          아예 렌더링하지 않는다(시범 동작 전용). */}
      {!dragging && !springing && (
        <span
          aria-hidden="true"
          className="absolute select-none pointer-events-none"
          style={{
            left: -18,
            top: "50%",
            color: "var(--accent)",
            fontSize: 18,
            lineHeight: 1,
            fontWeight: 600,
            animation: "pib-hint-arrow 1.8s ease-in-out infinite",
          }}
        >
          →
        </span>
      )}

      <style jsx>{`
        @keyframes pib-hint-demo {
          0%,
          11% {
            transform: translateY(-50%) translateX(0);
          }
          39% {
            transform: translateY(-50%) translateX(22px);
          }
          58% {
            transform: translateY(-50%) translateX(17px);
          }
          81%,
          100% {
            transform: translateY(-50%) translateX(0);
          }
        }
        @keyframes pib-hint-arrow {
          0%,
          11% {
            opacity: 0;
            transform: translateY(-50%) translateX(0);
          }
          39% {
            opacity: 1;
            transform: translateY(-50%) translateX(22px);
          }
          58% {
            opacity: 1;
            transform: translateY(-50%) translateX(17px);
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
