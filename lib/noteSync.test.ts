import { describe, expect, it, vi } from "vitest";
import { NoteSyncSession, type NoteVersion } from "@/lib/noteSync";
import { mergeEditorDocs } from "@/lib/syncMerge";

const P = (t: string) => ({ type: "paragraph", ...(t ? { content: [{ type: "text", text: t }] } : {}) });
const D = (...lines: string[]) => ({ type: "doc", content: lines.map(P) });
const rawOf = (d: object | undefined) => JSON.stringify(d ?? null);
const lines = (d: object | undefined) =>
  ((d as { content: { content?: { text: string }[] }[] }).content ?? []).map((b) => (b.content ?? []).map((n) => n.text).join(""));

// 서버 한 대 + 기기 여러 대. 저장 응답과 구독 소식은 직접 눌러서 순서를 정한다
class Server {
  note: NoteVersion;
  history: NoteVersion[] = [];
  constructor(doc: object) {
    this.note = { doc, raw: rawOf(doc), rev: 1 };
  }
  // 트랜잭션: 서버 최신과 합쳐 쓰기
  apply(base: NoteVersion, sent: object): NoteVersion {
    const merged = this.note.raw !== base.raw ? (mergeEditorDocs(base.doc, sent, this.note.doc) ?? sent) : sent;
    this.note = { doc: merged, raw: rawOf(merged), rev: this.note.rev + 1 };
    this.history.push(this.note);
    return this.note;
  }
}

class Device {
  doc: object;
  composing = false;
  pending: { run: () => void; fail: (e: unknown) => void }[] = [];
  queued: object[] = [];
  errors: unknown[] = [];
  session: NoteSyncSession;
  constructor(public server: Server) {
    this.doc = server.note.doc as object;
    this.session = new NoteSyncSession({
      initial: server.note,
      commit: (base, sent) =>
        new Promise((resolve, reject) => {
          this.pending.push({ run: () => resolve(server.apply(base, sent)), fail: reject });
        }),
      writeQueued: (sent) => this.queued.push(sent),
      getDoc: () => this.doc,
      applyDoc: (next) => {
        this.doc = next;
      },
      isComposing: () => this.composing,
      onError: (e) => this.errors.push(e),
      retryMs: 10,
      composingRetryMs: 10,
    });
  }
  type(...l: string[]) {
    this.doc = D(...l);
    this.session.flush();
  }
  // 날아간 저장을 끝낸다(응답까지)
  async finish() {
    const p = this.pending.shift();
    p?.run();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }
}

describe("NoteSyncSession", () => {
  it("녹화 재현: 늦게 돌아온 내 저장으로 예전 글이 새 줄에 생기지 않는다", async () => {
    const server = new Server(D("처제네"));
    const me = new Device(server);
    me.type("처제네", "#*");
    await me.finish();
    const echo1 = server.note;
    me.type("처제네", "#*75");
    await me.finish();
    const echo2 = server.note;
    me.type("처제네", "#*7511");
    // 옛 소식이 뒤늦게 차례로 도착
    me.session.onRemote(echo1);
    me.session.onRemote(echo2);
    await me.finish();
    me.session.onRemote(server.note);
    expect(lines(me.doc)).toEqual(["처제네", "#*7511"]);
    expect(lines(server.note.doc)).toEqual(["처제네", "#*7511"]);
  });

  it("지운 줄이 옛 소식으로 되살아나지 않는다", async () => {
    const server = new Server(D("#*7511#", "#*"));
    const me = new Device(server);
    const old = server.note;
    me.type("#*7511#");
    me.session.onRemote(old);
    await me.finish();
    me.session.onRemote(old);
    expect(lines(me.doc)).toEqual(["#*7511#"]);
  });

  it("저장은 한 번에 하나, 날아가는 동안의 입력은 다음 한 번으로 묶인다", async () => {
    const server = new Server(D(""));
    const me = new Device(server);
    me.type("가");
    me.type("가나");
    me.type("가나다");
    expect(me.pending.length).toBe(1);
    await me.finish();
    expect(me.pending.length).toBe(1);
    await me.finish();
    expect(server.history.length).toBe(2);
    expect(lines(server.note.doc)).toEqual(["가나다"]);
  });

  it("내용이 같으면 서버에 쓰지 않는다", () => {
    const server = new Server(D("가"));
    const me = new Device(server);
    me.session.flush();
    expect(me.pending.length).toBe(0);
  });

  it("두 사람이 같은 줄을 동시에 고쳐도 둘 다 남고 줄이 늘지 않는다", async () => {
    const server = new Server(D("오늘 장보기"));
    const a = new Device(server);
    const b = new Device(server);
    a.type("오늘 저녁 장보기");
    b.type("오늘 장보기 목록");
    await a.finish();
    b.session.onRemote(server.note); // b는 저장이 날아가는 중 - 끝난 뒤 처리
    await b.finish();
    a.session.onRemote(server.note);
    expect(lines(a.doc)).toEqual(["오늘 저녁 장보기 목록"]);
    expect(lines(b.doc)).toEqual(["오늘 저녁 장보기 목록"]);
    expect(lines(server.note.doc)).toEqual(["오늘 저녁 장보기 목록"]);
  });

  it("두 사람이 번갈아 계속 쳐도 양쪽 글이 모두 남고 양쪽 화면이 같아진다", async () => {
    const server = new Server(D("A:", "B:"));
    const a = new Device(server);
    const b = new Device(server);
    let at = "A:";
    let bt = "B:";
    for (let i = 0; i < 6; i++) {
      at += "a";
      a.doc = D(at, lines(a.doc)[1]);
      a.session.flush();
      bt += "b";
      b.doc = D(lines(b.doc)[0], bt);
      b.session.flush();
      await a.finish();
      await b.finish();
      a.session.onRemote(server.note);
      b.session.onRemote(server.note);
      at = lines(a.doc)[0];
      bt = lines(b.doc)[1];
    }
    a.session.flush();
    b.session.flush();
    await a.finish();
    await b.finish();
    a.session.onRemote(server.note);
    b.session.onRemote(server.note);
    expect(lines(server.note.doc)).toEqual(["A:aaaaaa", "B:bbbbbb"]);
    expect(lines(a.doc)).toEqual(lines(server.note.doc));
    expect(lines(b.doc)).toEqual(lines(server.note.doc));
  });

  it("상대 글이 올 때 내가 아직 안 올린 입력이 사라지지 않는다", () => {
    const server = new Server(D("가", "나"));
    const me = new Device(server);
    me.doc = D("가", "나!"); // 입력만 하고 아직 저장 전
    server.apply(server.note, D("가?", "나"));
    me.session.onRemote(server.note);
    expect(lines(me.doc)).toEqual(["가?", "나!"]);
  });

  it("한글 조합 중에는 화면을 바꾸지 않고, 합치기 전에는 올리지 않는다", async () => {
    vi.useFakeTimers();
    const server = new Server(D("가", "나"));
    const me = new Device(server);
    me.composing = true;
    server.apply(server.note, D("가?", "나"));
    me.session.onRemote(server.note);
    expect(lines(me.doc)).toEqual(["가", "나"]);
    me.doc = D("가", "나!");
    me.session.flush();
    expect(me.pending.length).toBe(0);
    me.composing = false;
    vi.advanceTimersByTime(20);
    expect(lines(me.doc)).toEqual(["가?", "나!"]);
    expect(me.pending.length).toBe(1);
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });

  it("저장이 실패하면 다시 보내고 글을 잃지 않는다", async () => {
    vi.useFakeTimers();
    const server = new Server(D("가"));
    const me = new Device(server);
    me.type("가나");
    me.pending.shift()?.fail({ code: "unavailable" });
    await vi.advanceTimersByTimeAsync(20);
    expect(me.pending.length).toBe(1);
    me.pending.shift()?.run();
    await vi.advanceTimersByTimeAsync(0);
    expect(lines(server.note.doc)).toEqual(["가나"]);
    vi.useRealTimers();
  });

  it("끊긴 채 나가면 대기열로 넘겨 글을 잃지 않는다", async () => {
    const server = new Server(D("가"));
    const me = new Device(server);
    me.type("가나");
    me.session.close();
    me.pending.shift()?.fail({ code: "unavailable" });
    await Promise.resolve();
    await Promise.resolve();
    expect(me.queued.map((d) => lines(d))).toEqual([["가나"]]);
  });

  it("권한이 없으면 멈추고 알린다", async () => {
    const server = new Server(D("가"));
    const me = new Device(server);
    me.type("가나");
    me.pending.shift()?.fail({ code: "permission-denied" });
    await Promise.resolve();
    await Promise.resolve();
    expect(me.session.isStopped()).toBe(true);
    expect(me.errors.length).toBe(1);
  });
});
