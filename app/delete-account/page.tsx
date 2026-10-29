export const metadata = {
  title: "계정 삭제 안내 · 팩인백",
};

// 계정 삭제 안내(2026-10-22). Google Play 데이터 보안 양식의 "계정 삭제 요청 URL" — 앱을 설치하지 않아도
// 삭제 방법 · 요청 창구 · 지워지는 데이터를 볼 수 있어야 한다(_secrets/docs/packinbag_play_store_listing.md 4절).
// 지우는 범위는 lib/accountService.deleteAllUserData + app/api/delete-account-data(auth.md AUTH-DEL)와 맞춘다
export default function DeleteAccountPage() {
  return (
    // 앱 전체가 바디 스크롤을 막아 두어 이 페이지는 자기 스크롤 칸을 갖는다(privacy · support와 같음)
    <div className="h-dvh overflow-y-auto">
      <main className="mx-auto max-w-2xl px-6 py-12 text-sm leading-7 text-neutral-800">
        <h1 className="mb-2 text-xl font-bold">팩인백(Pack In Bag) 계정 삭제 안내</h1>
        <p className="mb-8 text-neutral-500">앱 이름: 팩인백 · 개발자: appfle</p>

        <section className="mb-6">
          <h2 className="mb-2 font-semibold">1. 앱 또는 웹에서 직접 삭제하기</h2>
          <ol className="list-decimal pl-5">
            <li>
              팩인백 앱을 열거나 웹(
              <a href="https://packinbag.seeuson.com" className="underline">
                packinbag.seeuson.com
              </a>
              )에서 삭제할 계정으로 로그인합니다.
            </li>
            <li>&apos;설정&apos; 탭을 누르고, 맨 위의 프로필 줄을 누릅니다.</li>
            <li>프로필 화면 아래의 &apos;회원 탈퇴&apos;를 누릅니다.</li>
            <li>
              닉네임을 그대로 입력하고 본인 확인(이메일 계정은 비밀번호, Google · Apple 계정은 다시 로그인)을 마친 뒤 &apos;영구
              삭제&apos;를 누릅니다.
            </li>
          </ol>
          <p className="mt-2">삭제는 바로 처리되며 되돌릴 수 없습니다.</p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 font-semibold">2. 로그인할 수 없을 때 이메일로 요청하기</h2>
          <p>
            <a href="mailto:appfle.io@gmail.com" className="underline">
              appfle.io@gmail.com
            </a>
            으로 제목 &apos;팩인백 계정 삭제 요청&apos;과 함께 아래 내용을 보내 주세요.
          </p>
          <ul className="list-disc pl-5">
            <li>가입한 이메일 주소(Google · Apple로 가입했다면 그 계정의 이메일)</li>
            <li>앱에서 쓰던 닉네임</li>
          </ul>
          <p className="mt-2">
            가입한 이메일 주소에서 보낸 요청인지 확인한 뒤 삭제하고, 처리 결과를 회신해 드립니다. 다른 주소에서 보내셨다면 본인 확인을
            위해 추가 질문을 드릴 수 있습니다.
          </p>
          <p className="mt-2 text-neutral-500">
            &apos;로그인 없이 둘러보기&apos;(게스트)로 쓴 데이터는 앱 안에 삭제 메뉴가 없습니다. 지우고 싶으시면 앱의 설정 &gt;
            문의하기로 요청해 주세요.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 font-semibold">3. 삭제되는 데이터</h2>
          <ul className="list-disc pl-5">
            <li>계정(로그인 정보 · 이메일 주소)과 프로필(닉네임 · 캐릭터 · 앱 설정)</li>
            <li>나 혼자 쓰는 가방과 그 안의 팩 · 아이템 · 메모, 첨부한 사진 · 파일</li>
            <li>팩 보관함의 팩 · 메모와 첨부 사진 · 파일, 위젯 꾸미기 사진</li>
            <li>내가 만든 공유 링크 · 짧은 주소, 앱 알림함, 문의 내역</li>
            <li>알림 · 위젯용 기기 토큰, AI · 인증 메일 사용 기록</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 font-semibold">4. 삭제 후 남는 정보</h2>
          <ul className="list-disc pl-5">
            <li>
              다른 사람과 함께 쓰던 가방: 나는 멤버에서 빠지고 가방은 다른 멤버가 계속 씁니다. 내가 넣은 아이템 · 메모도 그 가방에
              남습니다. 내가 그룹장이었다면 가장 먼저 들어온 멤버가 그룹장이 됩니다.
            </li>
            <li>탈퇴 기록: 계정을 구분하는 무작위 ID와 탈퇴 날짜만 남기며, 이름 · 이메일 등은 남기지 않습니다.</li>
            <li>장애에 대비해 보관하는 백업 사본에는 삭제 전 데이터가 남아 있을 수 있으며, 백업을 정리할 때 함께 지워집니다.</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 font-semibold">5. 문의</h2>
          <p>
            appfle.io@gmail.com ·{" "}
            <a href="/privacy" className="underline">
              개인정보처리방침
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}
