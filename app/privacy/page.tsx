export const metadata = {
  title: "개인정보처리방침 · 팩인백",
};

// 개인정보처리방침(2026-10-11 개정: iOS 알림 · 위젯 · 잠금화면용 기기 토큰 추가).
// App Store Connect의 개인정보 처리방침 URL은 https://packinbag.seeuson.com/privacy
export default function PrivacyPage() {
  return (
    // 앱 전체가 바디 스크롤을 막아 두어(앱 셸 기준) 이 페이지는 자기 스크롤 칸을 갖는다(10/11 - 아래가 잘려 안 보였다)
    <div className="h-dvh overflow-y-auto">
    <main className="mx-auto max-w-2xl px-6 py-12 text-sm leading-7 text-neutral-800">
      <h1 className="mb-6 text-xl font-bold">팩인백(Pack In Bag) 개인정보처리방침</h1>

      <p className="mb-4 text-neutral-500">시행일: 2026년 10월 11일 (이전: 2026년 8월 1일)</p>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">1. 수집하는 개인정보 항목</h2>
        <p>팩인백은 회원가입 및 서비스 제공을 위해 아래 정보를 수집합니다.</p>
        <ul className="list-disc pl-5">
          <li>이메일 주소 (이메일 로그인 시)</li>
          <li>Google · Apple 계정의 이름, 이메일 (Google · Apple 로그인 시)</li>
          <li>닉네임, 선택한 캐릭터</li>
          <li>사용자가 직접 올리는 사진 · PDF 파일</li>
          <li>서비스 이용 과정에서 만들어지는 가방 · 팩 · 메모 · 함께 쓰는 사람(멤버) 정보</li>
          <li>
            iPhone 앱에서 알림 · 위젯 · 잠금화면 기능을 쓸 때: 푸시 알림 토큰(Apple이 기기마다 발급), 앱이 이 기기용으로 만든 무작위
            기기 토큰, 알림 허용 여부
          </li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">2. 개인정보의 이용 목적</h2>
        <ul className="list-disc pl-5">
          <li>회원 식별 및 로그인 기능 제공</li>
          <li>가방 공유(초대 · 멤버 관리)와 실시간 함께 체크</li>
          <li>알림 보내기(함께 쓰는 가방 소식, 맡긴 아이템, 새 멤버), 홈 화면 위젯 · 잠금화면에 가방 내용 보여 주기</li>
          <li>서비스 개선 및 문의 응대</li>
        </ul>
        <p className="mt-2">팩인백은 광고 목적의 추적을 하지 않으며, 수집한 정보를 광고에 쓰지 않습니다.</p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">3. 개인정보의 보관 및 파기</h2>
        <p>
          이용자의 데이터는 Google Firebase(Firestore, Storage, Cloud Functions)에 저장 · 처리되며, 회원 탈퇴 시 관련 데이터는 지체 없이
          삭제됩니다. 푸시 알림 토큰과 기기 토큰은 로그아웃하거나 다른 계정으로 로그인하면 함께 삭제되고, 기기 토큰은 원문이 아니라
          변환한 값(해시)만 저장합니다.
        </p>
        <p className="mt-2">
          위젯 · 잠금화면에 보여 줄 가방 요약(가방 · 팩 이름, 체크 아이템)은 이용자의 iPhone 안에만 저장되며, 메모 본문은 넣지 않습니다.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">4. 제3자 제공 및 처리위탁</h2>
        <ul className="list-disc pl-5">
          <li>Google Firebase: 인증, 데이터 저장, 알림 발송 처리</li>
          <li>Apple 푸시 알림 서비스(APNs): iPhone으로 알림 · 위젯 갱신 전달</li>
          <li>Vercel: 웹 서비스 운영</li>
          <li>Resend: 인증 메일 발송(사용하는 경우)</li>
        </ul>
        <p className="mt-2">
          &apos;메모로 가방 만들기&apos;, &apos;AI로 가져오기&apos;, &apos;빠진 것 확인&apos; 등 AI 기능을 사용하는 경우, 이용자가 입력한 아이템 ·
          팩 텍스트가 응답 생성을 위해 Google Gemini API로 전송됩니다. 이 텍스트는 AI 응답 생성 목적으로만 일시적으로 처리되며, 팩인백이
          별도로 저장하거나 다른 목적으로 이용하지 않습니다.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">5. 이용자의 권리</h2>
        <p>
          이용자는 앱의 설정 &gt; 프로필에서 정보를 고치거나 회원 탈퇴로 데이터를 삭제할 수 있습니다. 알림은 설정 &gt; 알림 또는 iPhone
          설정 &gt; 팩인백 &gt; 알림에서 끌 수 있습니다.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">6. 문의처</h2>
        <p>개인정보 관련 문의: appfle.io@gmail.com</p>
      </section>
    </main>
    </div>
  );
}
