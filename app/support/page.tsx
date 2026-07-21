import { FAQ_ITEMS } from "@/lib/faqs";

export const metadata = {
  title: "고객지원 · 팩인백",
};

export default function SupportPage() {
  const grouped = FAQ_ITEMS.reduce<Record<string, typeof FAQ_ITEMS>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-sm leading-7 text-neutral-800">
      <h1 className="mb-2 text-xl font-bold">팩인백(Pack In Bag) 고객지원</h1>
      <p className="mb-8 text-neutral-500">
        자주 묻는 질문을 확인하거나, 해결되지 않은 문제는 이메일로 문의해주세요.
      </p>

      <section className="mb-10">
        <h2 className="mb-2 font-semibold">문의하기</h2>
        <p>
          이메일:{" "}
          <a href="mailto:appfle.io@gmail.com" className="underline">
            appfle.io@gmail.com
          </a>
        </p>
        <p className="mt-1 text-neutral-500">
          앱을 설치하신 분은 설정 화면의 &apos;문의하기&apos;를 통해서도 문의를 남길 수 있어요.
        </p>
      </section>

      {Object.entries(grouped).map(([category, items]) => (
        <section key={category} className="mb-8">
          <h2 className="mb-3 font-semibold">{category}</h2>
          <div className="flex flex-col gap-4">
            {items.map((item) => (
              <div key={item.id}>
                <p className="font-medium">{item.question}</p>
                <p className="text-neutral-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
