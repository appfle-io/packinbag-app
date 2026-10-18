import type { Metadata } from "next";
import AboutTry from "./AboutTry";
import AboutVideo from "./AboutVideo";
import styles from "./about.module.css";

// 팩인백 소개 페이지(2026-10-18). 목업: https://claude.ai/artifact/FezZTjcKsDRsoee1n7vQNW
// "써 보기"는 진짜 앱을 체험 모드로 띄운다(AboutTry, offline.md OFF-DEMO).
// 앱으로 가는 링크는 모두 /?demo=0 — 같은 탭의 체험 표시(sessionStorage)를 지워 평소 팩인백이 열리게

export const metadata: Metadata = {
  title: "팩인백 · 매번 챙기는 준비물, 체크만 다시",
  description: "가방마다 팩을 담아 두고, 다녀오면 체크만 다시. 가족과 같이 챙기는 준비물 체크리스트 팩인백.",
};

const APP_STORE_URL = "https://apps.apple.com/kr/app/id6793290752";
const APP_URL = "/?demo=0";

const HOW = [
  ["자주 챙기는 건 팩으로", "세면도구, 충전기, 기저귀처럼 늘 같이 챙기는 것들을 팩 하나로 묶어 두세요."],
  ["상황마다 가방을 만들고 팩을 담아요", "출근, 여행, 장보기처럼 가방을 따로 만들고 필요한 팩을 불러와요. 이번에만 필요한 건 바로 적어 넣으면 돼요."],
  ["다녀와서는 체크만 비워요", "다시 싸기 한 번이면 목록은 그대로 두고 체크만 싹 비워져요. 다음엔 체크만 하면 끝이에요."],
];

const FEATURES = [
  ["가족이랑 같이 챙기기", "초대 링크나 코드로 같은 가방을 같이 써요. 누가 체크하면 바로 보이고, 아이템마다 담당을 정할 수 있어요."],
  ["빠른팩", "생각나면 일단 적어 두세요. 정리는 나중에 팩이나 가방으로 옮기면 돼요."],
  ["메모팩", "체크리스트로 다 안 담기는 건 메모로 같이 둬요. 표, 링크, 사진, PDF도 넣을 수 있어요. 레시피나 숙소 정보처럼 메모 앱으로 써도 돼요."],
  ["AI로 나눠 담기", "카톡이나 메모에 적어 둔 준비물을 붙여 넣으면 팩별로 알아서 나눠 가방을 만들어 줘요."],
  ["홈 화면 위젯", "앱을 열지 않아도 위젯에서 바로 체크하고, 잠금화면에서 남은 개수를 봐요."],
  ["나만 잠그기", "PIN이나 Face ID로 가방과 팩을 나만 볼 수 있게 잠가요. 같이 쓰는 사람에게는 영향이 없어요."],
];

const MORE = [
  "D-Day 알림",
  "Siri · 단축어",
  "날씨로 준비물 추천",
  "빠진 것 확인",
  "담당자 지정",
  "짧은 링크로 공유",
  "다 챙긴 건 아래로",
  "다크 모드",
  "글꼴 · 글자 크기",
  "휴지통 30일 보관",
  "백업 내보내기",
];

const PLATFORMS = [
  ["iPhone · iPad", "위젯에서 바로 체크하고, 잠금화면에서 남은 개수를 봐요. Siri와 단축어로 가방을 열어요."],
  ["웹", "설치 없이 브라우저에서 바로. 넓은 화면에서는 목록과 가방을 나란히 보여 줘요."],
  ["Windows · Mac", "설치 없이 실행하는 포터블 버전도 있어요. 인터넷이 없는 곳에서도 이 기기에 저장해요."],
];

const PRICE = [
  ["가방, 팩", "개수 제한 없음"],
  ["같이 쓰는 인원", "가방마다 10명까지"],
  ["사진, PDF 첨부", "가능"],
  ["AI 기능", "하루 3번"],
];

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={`${styles.wrap} ${styles.headerRow}`}>
          <a href="#try" className={styles.brand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/backpack-logo.png" alt="" width={32} height={32} />
            팩인백
          </a>
          <nav aria-label="페이지 안 이동" className={styles.nav}>
            <a href="#try">써 보기</a>
            <a href="#video">영상</a>
            <a href="#how">쓰는 법</a>
            <a href="#features">기능</a>
            <a href="#price">요금</a>
          </nav>
          <a href={APP_URL} className={`${styles.btn} ${styles.btnDark} ${styles.btnSmall}`}>
            앱 열기
          </a>
        </div>
      </header>

      <main>
        <section id="try" className={`${styles.wrap} ${styles.hero}`}>
          <div className={styles.heroTop}>
            <div style={{ maxWidth: 640 }}>
              <h1 className={styles.h1}>
                매번 챙기는 준비물,
                <br />
                체크만 다시.
              </h1>
              <p className={styles.lead}>아래는 진짜 팩인백이에요. 로그인 없이 왼쪽 순서대로 해 보세요.</p>
            </div>
            <div className={styles.ctaRow}>
              <a href={APP_STORE_URL} className={`${styles.btn} ${styles.btnDark}`}>
                App Store에서 받기
              </a>
              <a href={APP_URL} className={`${styles.btn} ${styles.btnLine}`}>
                웹에서 시작하기
              </a>
            </div>
          </div>
          <AboutTry />
        </section>

        <section id="video" className={styles.section}>
          <div className={`${styles.wrap} ${styles.videoHead}`}>
            <h2 className={styles.h2}>1분 영상으로 보기</h2>
            <p className={styles.sub}>직접 눌러 보기 전에 한눈에 보고 싶다면요. 소리가 나요.</p>
            {/* 22MB라 누를 때만 받는다(preload metadata, 자동 재생 없음) */}
            <AboutVideo />
          </div>
        </section>

        <section id="how" className={styles.section}>
          <div className={styles.wrap}>
            <h2 className={styles.h2}>한 번 만들어 두면 계속 써요</h2>
            <p className={styles.sub}>메모 앱처럼 체크를 하나씩 지우거나, 갈 때마다 목록을 새로 쓰지 않아도 돼요.</p>
            <div className={styles.how}>
              {HOW.map(([title, body], i) => (
                <div key={title} className={styles.card}>
                  <div className={styles.cardNum}>{i + 1}</div>
                  <h3 className={styles.cardTitle}>{title}</h3>
                  <p className={styles.cardBody}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className={styles.section}>
          <div className={styles.wrap}>
            <h2 className={styles.h2}>챙기는 데 필요한 건 다 있어요</h2>
            <div className={styles.features}>
              {FEATURES.map(([title, body]) => (
                <div key={title} className={styles.feature}>
                  <h3 className={styles.featureTitle}>{title}</h3>
                  <p className={styles.featureBody}>{body}</p>
                </div>
              ))}
            </div>
            <div className={styles.chips} aria-label="그 밖의 기능">
              {MORE.map((m) => (
                <span key={m} className={styles.chip}>
                  {m}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.wrap}>
            <h2 className={styles.h2}>아이폰, 웹, PC 어디서나</h2>
            <p className={styles.sub}>같은 계정이면 어느 기기에서 고쳐도 바로 맞춰져요.</p>
            <div className={styles.platforms}>
              {PLATFORMS.map(([title, body]) => (
                <div key={title} className={styles.card}>
                  <h3 className={styles.cardTitle} style={{ marginTop: 0 }}>
                    {title}
                  </h3>
                  <p className={styles.cardBody}>{body}</p>
                </div>
              ))}
            </div>
            <p className={styles.note}>인터넷이 끊겨도 쓰던 그대로 이어서 써요. 바꾼 내용은 다시 연결되면 알아서 올라가요.</p>
          </div>
        </section>

        <section id="price" className={styles.section}>
          <div className={`${styles.wrap} ${styles.priceRow}`}>
            <div className={styles.priceHead}>
              <h2 className={styles.h2}>지금은 모든 기능이 무료예요</h2>
              <p className={styles.sub}>출시 기념으로 프리미엄 기능까지 모두 열어 두었어요.</p>
            </div>
            <div className={styles.priceTable}>
              {PRICE.map(([k, v]) => (
                <div key={k} className={styles.priceLine}>
                  <span>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.wrap} ${styles.end}`}>
          <h2 className={styles.h2}>다음 가방부터는 체크만 하세요</h2>
          <div className={styles.ctaRow} style={{ justifyContent: "center" }}>
            <a href={APP_STORE_URL} className={`${styles.btn} ${styles.btnDark}`}>
              App Store에서 받기
            </a>
            <a href={APP_URL} className={`${styles.btn} ${styles.btnLine}`}>
              웹에서 시작하기
            </a>
          </div>
        </section>
      </main>

      <footer className={`${styles.wrap} ${styles.footer}`}>
        <span>팩인백 Pack In Bag · see u, son</span>
        <span>
          <a href="/support">고객지원</a> · <a href="/privacy">개인정보처리방침</a>
        </span>
      </footer>
    </div>
  );
}
