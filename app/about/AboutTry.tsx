"use client";

// /about "써 보기": 진짜 팩인백을 체험 모드(?demo=1, offline.md OFF-DEMO)로 페이지 안에 띄운다.
// 왼쪽 단계는 앱을 대신 조작하지 않고, 지금 해 볼 것을 알려 준다(앱은 방문자가 직접 누른다)
import { useRef, useState } from "react";
import styles from "./about.module.css";

const DEMO_URL = "/?demo=1";

const STEPS: { title: string; body: string; tip: string }[] = [
  {
    title: "체크해 보기",
    body: "챙긴 건 누르면 끝이에요",
    tip: "‘도쿄 3박 4일 자유여행’ 가방을 열고 아이템을 눌러 보세요. 위쪽 숫자와 막대가 같이 올라가요.",
  },
  {
    title: "팩 불러오기",
    body: "자주 챙기는 건 팩으로 한 번에",
    tip: "가방 아래 입력창 왼쪽의 상자 버튼을 누르면, 보관해 둔 팩을 골라 가방에 담을 수 있어요.",
  },
  {
    title: "빠른팩에 적기",
    body: "생각나면 일단 적어 두기",
    tip: "아래 오른쪽 검은 + 버튼을 눌러 한 줄 적어 보세요. 나중에 팩이나 가방으로 옮길 수 있어요.",
  },
  {
    title: "가족이랑 같이 챙기기",
    body: "누가 뭘 챙겼는지 바로 보여요",
    tip: "가방 위 사람 모양 버튼이 함께 챙기는 사람이에요. 초대는 로그인하면 써 볼 수 있어요.",
  },
  {
    title: "메모도 같이 적기",
    body: "표, 체크, 사진, PDF까지",
    tip: "도쿄 가방 안의 ‘여행 일정 & 맛집 메모’를 열어 보세요. 메모 앱처럼 제목, 표, 체크를 넣을 수 있어요.",
  },
  {
    title: "다녀와서는 다시 싸기",
    body: "목록은 그대로, 체크만 비워요",
    tip: "가방 위 ‘다시 싸기’를 눌러 보세요. 아이템은 그대로 두고 체크만 싹 비워져요.",
  },
];

export default function AboutTry() {
  const [step, setStep] = useState(0);
  const [view, setView] = useState<"pc" | "phone">("pc");
  const frameRef = useRef<HTMLIFrameElement>(null);

  // 처음부터 다시: 체험 저장(이 창의 pib_demo_*)을 지우고 다시 연다. 같은 주소라 iframe 안 저장소에 손이 닿는다
  const resetDemo = () => {
    const w = frameRef.current?.contentWindow;
    try {
      if (w) {
        Object.keys(w.sessionStorage)
          .filter((k) => k.startsWith("pib_demo"))
          .forEach((k) => w.sessionStorage.removeItem(k));
        w.location.href = DEMO_URL;
      }
    } catch {
      if (frameRef.current) frameRef.current.src = DEMO_URL;
    }
    setStep(0);
  };

  return (
    <>
      <div className={styles.tryRow}>
        <ol aria-label="써 보기 순서" className={styles.steps}>
          {STEPS.map((s, i) => {
            const on = i === step;
            return (
              <li key={s.title}>
                <button
                  type="button"
                  aria-current={on ? "step" : undefined}
                  onClick={() => setStep(i)}
                  className={[styles.step, on ? styles.stepOn : "", i < step ? styles.stepPast : ""].join(" ")}
                >
                  <span className={styles.stepNum}>{i < step ? "✓" : i + 1}</span>
                  <span>
                    <span className={styles.stepTitle}>{s.title}</span>
                    <span className={styles.stepBody}>{s.body}</span>
                    {on && <span className={styles.tip}>{s.tip}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className={styles.stage}>
          <div className={styles.stageBar}>
            <div className={styles.seg} role="group" aria-label="화면 크기">
              <button type="button" aria-pressed={view === "pc"} onClick={() => setView("pc")} className={[styles.segBtn, view === "pc" ? styles.segOn : ""].join(" ")}>
                PC 화면
              </button>
              <button type="button" aria-pressed={view === "phone"} onClick={() => setView("phone")} className={[styles.segBtn, view === "phone" ? styles.segOn : ""].join(" ")}>
                휴대폰 화면
              </button>
            </div>
            <button type="button" onClick={resetDemo} className={styles.reset}>
              처음부터 다시
            </button>
          </div>
          <div className={styles.frameWrap}>
            <iframe
              ref={frameRef}
              src={DEMO_URL}
              title="팩인백 체험"
              className={view === "pc" ? styles.framePc : styles.framePhone}
            />
          </div>
          <p className={styles.stageNote}>체험에서 만든 건 이 창에만 있고, 창을 닫으면 사라져요. AI · 사진 첨부 · 가족 초대는 로그인하면 쓸 수 있어요.</p>
        </div>
      </div>

      <div className={styles.mobileTry}>
        <p>로그인 없이 진짜 팩인백을 바로 써 볼 수 있어요. 예시 가방이 들어 있어요.</p>
        <a href={DEMO_URL} className={`${styles.btn} ${styles.btnDark}`}>
          바로 써 보기
        </a>
      </div>
    </>
  );
}
