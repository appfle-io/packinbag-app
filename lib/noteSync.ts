// 가방 안 메모 저장 · 받기 순서 관리(2026-11-05). Firestore 호출 없음 - 순수 로직(lib/noteSync.test.ts).
//
// 왜: 예전에는 메모를 가방 자동저장에 태웠다. 저장이 겹치고 기준점이 늦게 움직여서, 늦게 돌아온 내 저장을 다른 사람의
// 변경으로 착각해 합쳤다(입력 중 예전 글이 새 줄로 되살아남, 2026-11-04 사용자 녹화). 저장마다 가방 문서도 함께 써서 비용도 컸다.
//
// 지키는 것:
// - ack = 서버에 있다고 확인한 마지막 본문. 화면 본문은 늘 "ack + 아직 안 올린 내 입력"이다.
// - 저장은 한 번에 하나. 날아가는 동안 또 고치면 끝난 뒤 지금 본문으로 한 번 더 보낸다(그 사이 입력은 한 번으로 묶임).
// - rev는 서버에서 늘 커진다. ack.rev 이하인 소식은 내 옛 저장이거나 이미 합친 것이라 버린다.
// - 날아가는 동안 온 소식은 저장이 끝난 뒤에 처리한다(내 저장이 들어 있는 소식을 옛 기준점으로 합치지 않게).
// - 한글 조합 중에는 화면을 바꾸지 않는다(조합이 깨진다). 끝나면 합치고, 합치기 전에는 올리지 않는다.

import { mergeEditorDocs } from "@/lib/syncMerge";

export interface NoteVersion {
  doc: object | undefined;
  raw: string;
  rev: number;
}

export interface NoteSyncOptions {
  initial: NoteVersion;
  // 트랜잭션 저장: 서버 최신과 합쳐서 쓰고 쓴 결과를 돌려준다. null = 그 사이 메모가 지워짐
  commit: (base: NoteVersion, sent: object) => Promise<NoteVersion | null>;
  // 끊긴 채 화면을 떠날 때의 마지막 수단: SDK 대기열에 넣어 연결되면 전송
  writeQueued: (sent: object) => void;
  getDoc: () => object | undefined;
  applyDoc: (next: object) => void;
  isComposing: () => boolean;
  onError: (err: unknown) => void;
  retryMs?: number;
  composingRetryMs?: number;
}

const rawOf = (d: object | undefined) => JSON.stringify(d ?? null);

function isFatal(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "permission-denied";
}

export class NoteSyncSession {
  private ack: NoteVersion;
  private inflight = false;
  private dirty = false;
  private failed = false;
  private stopped = false;
  private closed = false;
  private lastDoc: object | undefined;
  private incoming: NoteVersion | null = null;
  // 화면에 아직 못 합친 것들(순서대로): base 대비 theirs가 바뀐 내용
  private toApply: { base: object | undefined; theirs: object }[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private opts: NoteSyncOptions) {
    this.ack = opts.initial;
    this.lastDoc = opts.initial.doc;
  }

  private mine(): object | undefined {
    if (this.closed) return this.lastDoc;
    const d = this.opts.getDoc();
    if (d) this.lastDoc = d;
    return this.lastDoc;
  }

  private schedule(ms: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.drain();
      if (this.dirty) this.flush();
    }, ms);
  }

  // 화면을 지금 본문으로 합친다. 조합 중이면 나중에. 합칠 것이 남아 있으면 false
  private drain(): boolean {
    if (this.toApply.length === 0) return true;
    if (this.closed) {
      this.toApply = [];
      return true;
    }
    if (this.opts.isComposing()) {
      this.schedule(this.opts.composingRetryMs ?? 250);
      return false;
    }
    let mine = this.mine();
    const before = rawOf(mine);
    for (const { base, theirs } of this.toApply) mine = mergeEditorDocs(base, mine, theirs) ?? theirs;
    this.toApply = [];
    if (mine && rawOf(mine) !== before) {
      this.opts.applyDoc(mine);
      this.lastDoc = this.opts.getDoc() ?? mine;
    }
    return true;
  }

  private receive(note: NoteVersion) {
    if (note.rev <= this.ack.rev) return;
    const base = this.ack.doc;
    const sameBody = note.raw === this.ack.raw;
    this.ack = note;
    if (!sameBody && note.doc) this.toApply.push({ base, theirs: note.doc });
    this.drain();
  }

  // 구독으로 받은 본문
  onRemote(note: NoteVersion) {
    if (this.stopped) return;
    if (this.inflight) {
      if (!this.incoming || note.rev > this.incoming.rev) this.incoming = note;
      return;
    }
    this.receive(note);
  }

  // 지금 본문을 서버로. 날아가는 중이면 끝난 뒤 한 번 더
  flush() {
    if (this.stopped) return;
    if (this.inflight) {
      this.dirty = true;
      return;
    }
    if (!this.drain()) {
      this.dirty = true;
      return;
    }
    this.dirty = false;
    const sent = this.mine();
    if (!sent || rawOf(sent) === this.ack.raw) return;
    this.inflight = true;
    const base = this.ack;
    this.opts
      .commit(base, sent)
      .then((written) => {
        this.inflight = false;
        this.failed = false;
        if (written === null) {
          this.stopped = true;
          return;
        }
        if (written.rev >= this.ack.rev) {
          this.ack = written;
          if (written.raw !== rawOf(sent) && written.doc) this.toApply.push({ base: sent, theirs: written.doc });
        }
        this.afterCommit();
      })
      .catch((err) => {
        this.inflight = false;
        if (isFatal(err)) {
          this.stopped = true;
          this.opts.onError(err);
          return;
        }
        this.failed = true;
        this.dirty = true;
        if (this.closed) {
          this.dropToQueue();
          return;
        }
        this.afterCommit(this.opts.retryMs ?? 3000);
      });
  }

  private afterCommit(retryMs?: number) {
    const pending = this.incoming;
    this.incoming = null;
    if (pending) this.receive(pending);
    this.drain();
    if (retryMs !== undefined) this.schedule(retryMs);
    else if (this.dirty) this.flush();
  }

  private dropToQueue() {
    const sent = this.mine();
    if (!sent || rawOf(sent) === this.ack.raw) return;
    this.opts.writeQueued(sent);
    this.ack = { doc: sent, raw: rawOf(sent), rev: this.ack.rev };
    this.dirty = false;
    this.failed = false;
  }

  // 화면을 떠남: 마지막 본문을 올리고 더는 화면을 건드리지 않는다
  close() {
    this.mine();
    this.closed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.toApply = [];
    if (this.stopped) return;
    if (this.failed && !this.inflight) this.dropToQueue();
    else this.flush();
  }

  // 화면을 떠날 때 요약에 쓸 지금 본문
  current(): object | undefined {
    return this.mine();
  }

  // 이 메모가 지워졌거나 권한이 없어 더 저장하지 않는지
  isStopped(): boolean {
    return this.stopped;
  }
}
