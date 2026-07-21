export const metadata = {
  title: "개인정보처리방침 · 팩인백",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-sm leading-7 text-neutral-800">
      <h1 className="mb-6 text-xl font-bold">팩인백(Pack In Bag) 개인정보처리방침</h1>

      <p className="mb-4 text-neutral-500">시행일: 2026년 8월 1일</p>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">1. 수집하는 개인정보 항목</h2>
        <p>
          팩인백은 회원가입 및 서비스 제공을 위해 아래 정보를 수집합니다.
        </p>
        <ul className="list-disc pl-5">
          <li>이메일 주소 (이메일 로그인 시)</li>
          <li>구글 계정의 이름, 이메일, 프로필 사진 (구글 로그인 시)</li>
          <li>사용자가 직접 업로드하는 가방/짐 관련 이미지</li>
          <li>서비스 이용 과정에서 생성되는 가방/팩/그룹 데이터</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">2. 개인정보의 이용 목적</h2>
        <ul className="list-disc pl-5">
          <li>회원 식별 및 로그인 기능 제공</li>
          <li>그룹(가방 공유) 기능 제공을 위한 초대/멤버 관리</li>
          <li>서비스 개선 및 문의 응대</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">3. 개인정보의 보관 및 파기</h2>
        <p>
          이용자의 데이터는 Google Firebase(Firestore, Storage)에 저장되며,
          회원 탈퇴 시 관련 데이터는 지체 없이 삭제됩니다.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">4. 제3자 제공 및 처리위탁</h2>
        <p>
          팩인백은 인증 및 데이터 저장을 위해 Google Firebase를 이용하고 있으며,
          이 과정에서 Google의 개인정보처리방침이 함께 적용될 수 있습니다.
        </p>
        <p className="mt-2">
          &apos;AI로 정리하기&apos;, &apos;AI 해시태그&apos; 등 AI 기능을 사용하는 경우,
          이용자가 입력한 짐/팩 텍스트가 응답 생성을 위해 Google Gemini API로
          전송됩니다. 이 텍스트는 AI 응답 생성 목적으로만 일시적으로 처리되며,
          팩인백이 별도로 저장하거나 다른 목적으로 이용하지 않습니다.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">5. 문의처</h2>
        <p>개인정보 관련 문의: appfle.io@gmail.com</p>
      </section>

      <p className="text-neutral-500">
        ※ 이 문서는 앱스토어 제출용 기본 템플릿입니다. 실제 서비스 운영 전
        appfle님의 상황(연락처, 실제 수집 항목, 보관 기간 등)에 맞게 반드시
        직접 검토하고 수정해주세요.
      </p>
    </main>
  );
}
