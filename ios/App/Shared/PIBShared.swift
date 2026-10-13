// 팩인백 앱 · 위젯이 함께 쓰는 코드(2026-10-10). 이 Shared 폴더는 App · PackInBagWidgetExtension 두 타깃에 모두 들어간다.
// - App Group(group.com.appfle.packinbag)에 가방 요약 · 기기 토큰을 저장한다
// - 서버(/api/native/*)를 기기 토큰으로 부른다(앱이 꺼져 있어도 위젯 · 단축어 · 잠금화면에서)
// 요약 모양은 웹의 lib/nativeSummary.ts와 같다.
import Foundation
import WidgetKit

enum PIB {
    static let appGroup = "group.com.appfle.packinbag"
    static var defaults: UserDefaults { UserDefaults(suiteName: appGroup) ?? .standard }
    // 위젯 자동 새로고침 주기(안전망): 이 시간보다 오래된 요약을 보면 서버에서 다시 받는다(10/11 15분 → 30분)
    static let staleAfter: TimeInterval = 30 * 60
    // 푸시 환경: Xcode에서 바로 설치(Debug) = 개발용 APNs, Archive(Release → TestFlight · App Store) = 운영 APNs
    #if DEBUG
    static let apnsEnvironment = "sandbox"
    #else
    static let apnsEnvironment = "production"
    #endif
}

struct PIBItem: Codable, Hashable {
    let id: String
    var text: String
    var checked: Bool
}

struct PIBPack: Codable, Hashable {
    let id: String
    var name: String
    var items: [PIBItem]
    // "미분류" 팩(가방 하단 입력창으로 넣은 것, 10/11). 요약에서 맨 앞에 온다
    var inbox: Bool? = nil
}

struct PIBBag: Codable, Hashable {
    let id: String
    var name: String
    var travelDate: String?
    var packs: [PIBPack]
    // 내가 고정한 가방(10/11). 위젯 편집 · 단축어 가방 목록에서 "고정한 가방" 묶음
    var pinned: Bool? = nil

    // D-Day까지 남은 날(오늘 0, 지났으면 음수). 날짜가 없으면 nil
    var daysLeft: Int? {
        guard let travelDate else { return nil }
        let parts = travelDate.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        let cal = Calendar.current
        guard let day = cal.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])) else { return nil }
        return cal.dateComponents([.day], from: cal.startOfDay(for: Date()), to: day).day
    }
}

struct PIBSummary: Codable {
    var v: Int
    var updatedAt: String
    var bags: [PIBBag]
    // 보관함 팩(1.6 Siri · Spotlight 검색, 10/12). 앱이 열려 있을 때 웹만 넣는다.
    // 서버 요약(/api/native/summary)에는 없다 → 저장할 때 없으면 예전 목록을 그대로 둔다(PIBStore.save)
    var library: [PIBLibraryPack]? = nil
}

struct PIBLibraryPack: Codable, Hashable {
    let id: String
    var name: String
    // "checklist" | "note"
    var kind: String
    // 체크리스트 팩의 아이템 수
    var count: Int? = nil
}

enum PIBError: LocalizedError {
    case notSignedIn
    // 서버가 거절(4xx) - 다시 보내도 안 됨
    case rejected(String)
    // 잠깐 안 됨(5xx · 네트워크) - 나중에 다시
    case server(String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn: return "팩인백 앱에서 먼저 로그인해 주세요"
        case .rejected(let message), .server(let message): return message
        }
    }
}

// 위젯에서 누른 체크(서버에 아직 안 올라간 것). 누르자마자 화면에 반영하고 뒤에서 보낸다
struct PIBPendingToggle: Codable, Hashable {
    let bagId: String
    let packId: String
    let itemId: String
    let checked: Bool
    let at: Double
}

// ---- App Group 저장소 ---------------------------------------------------------

enum PIBStore {
    private static let summaryKey = "pib.summary"
    private static let savedAtKey = "pib.summarySavedAt"
    private static let tokenKey = "pib.token"
    private static let uidKey = "pib.uid"
    private static let apiKey = "pib.apiBase"
    private static let pendingKey = "pib.pendingToggles"

    static func summary() -> PIBSummary? {
        guard let data = PIB.defaults.data(forKey: summaryKey) else { return nil }
        return try? JSONDecoder().decode(PIBSummary.self, from: data)
    }

    // 서버 · 앱에서 온 요약을 저장할 때, 아직 못 보낸 체크는 그 위에 덮어 둔다(눌렀던 게 되돌아가 보이지 않게)
    static func save(_ summary: PIBSummary) {
        var summary = summary
        for p in pending() { apply(p, to: &summary) }
        if summary.library == nil { summary.library = self.summary()?.library }
        guard let data = try? JSONEncoder().encode(summary) else { return }
        PIB.defaults.set(data, forKey: summaryKey)
        PIB.defaults.set(Date().timeIntervalSince1970, forKey: savedAtKey)
    }

    @discardableResult
    static func save(json: String) -> Bool {
        guard let data = json.data(using: .utf8),
              let summary = try? JSONDecoder().decode(PIBSummary.self, from: data) else { return false }
        save(summary)
        return true
    }

    static var summaryAge: TimeInterval {
        let t = PIB.defaults.double(forKey: savedAtKey)
        return t == 0 ? .infinity : Date().timeIntervalSince1970 - t
    }

    // 마지막으로 서버 · 앱에서 최신 내용을 받은 시각(위젯 · 실시간 현황의 "N분 전"). 위젯에서 누른 체크는 바꾸지 않는다
    static var summarySavedAt: Date? {
        let t = PIB.defaults.double(forKey: savedAtKey)
        return t == 0 ? nil : Date(timeIntervalSince1970: t)
    }

    static func bag(_ bagId: String) -> PIBBag? {
        summary()?.bags.first { $0.id == bagId }
    }

    static func pack(bagId: String, packId: String) -> (bag: PIBBag, pack: PIBPack)? {
        guard let bag = bag(bagId), let pack = bag.packs.first(where: { $0.id == packId }) else { return nil }
        return (bag, pack)
    }

    static func item(bagId: String, packId: String, itemId: String) -> PIBItem? {
        pack(bagId: bagId, packId: packId)?.pack.items.first { $0.id == itemId }
    }

    // 서버 응답을 기다리지 않고 화면에 먼저 반영
    static func setChecked(bagId: String, packId: String, itemId: String, checked: Bool) {
        guard var summary = summary() else { return }
        apply(PIBPendingToggle(bagId: bagId, packId: packId, itemId: itemId, checked: checked, at: 0), to: &summary)
        guard let data = try? JSONEncoder().encode(summary) else { return }
        PIB.defaults.set(data, forKey: summaryKey) // 저장 시각은 그대로(서버 최신본이 아님)
    }

    private static func apply(_ t: PIBPendingToggle, to summary: inout PIBSummary) {
        guard let b = summary.bags.firstIndex(where: { $0.id == t.bagId }),
              let p = summary.bags[b].packs.firstIndex(where: { $0.id == t.packId }),
              let i = summary.bags[b].packs[p].items.firstIndex(where: { $0.id == t.itemId }) else { return }
        summary.bags[b].packs[p].items[i].checked = t.checked
    }

    // ---- 못 보낸 체크 ----
    static func pending() -> [PIBPendingToggle] {
        guard let data = PIB.defaults.data(forKey: pendingKey),
              let list = try? JSONDecoder().decode([PIBPendingToggle].self, from: data) else { return [] }
        // 하루 넘은 것은 버린다
        let cutoff = Date().timeIntervalSince1970 - 24 * 3600
        return list.filter { $0.at > cutoff }
    }

    private static func setPending(_ list: [PIBPendingToggle]) {
        if let data = try? JSONEncoder().encode(list) { PIB.defaults.set(data, forKey: pendingKey) }
    }

    static func enqueue(bagId: String, packId: String, itemId: String, checked: Bool) {
        var list = pending().filter { !($0.bagId == bagId && $0.packId == packId && $0.itemId == itemId) }
        list.append(PIBPendingToggle(bagId: bagId, packId: packId, itemId: itemId, checked: checked, at: Date().timeIntervalSince1970))
        setPending(list)
    }

    // 보낸 뒤 그사이 다시 누른 것은 남긴다(같은 값일 때만 지운다)
    static func removePending(_ t: PIBPendingToggle) {
        setPending(pending().filter { $0 != t })
    }

    // ---- 기기 토큰(로그인한 계정) ----
    static var token: String? { PIB.defaults.string(forKey: tokenKey) }
    static var uid: String? { PIB.defaults.string(forKey: uidKey) }
    static var apiBase: String { PIB.defaults.string(forKey: apiKey) ?? "https://packinbag.seeuson.com" }

    static func setSession(uid: String, token: String, apiBase: String) {
        PIB.defaults.set(uid, forKey: uidKey)
        PIB.defaults.set(token, forKey: tokenKey)
        PIB.defaults.set(apiBase, forKey: apiKey)
    }

    static func clearSession() {
        [tokenKey, uidKey, summaryKey, savedAtKey, pendingKey, PIBUndo.key].forEach { PIB.defaults.removeObject(forKey: $0) }
    }
}

// ---- 되돌리기(1.6, 2026-10-13) ---------------------------------------------------------
// 위젯 · 잠금화면 실시간 현황에서 누른 체크를 하나씩 되돌린다(앱 · 웹에서 누른 체크는 쌓지 않음).
// - 한 줄 = 누르기 전 값. 되돌리기는 "그 값으로 맞추기"라 같은 아이템을 체크 → 해제해도 순서대로 정확히 돌아간다
// - 일반 실행 취소와 같다: 체크 A · B → 되돌리기(B) → 체크 C · D 이면 [A, C, D]가 남아 3번 더 되돌릴 수 있다. 다시 실행은 없다
// - 범위: 위젯 · 잠금화면이 보여 주는 가방 · 팩(가방 전체면 그 가방 전부). 같은 팩이면 위젯 · 잠금화면이 기록을 함께 쓴다
// - 시간 제한 없이 최근 50개. 그사이 지워진 아이템 · 이미 그 값인 아이템(다른 기기에서 바뀜)은 건너뛴다. 로그아웃하면 지운다
struct PIBUndoEntry: Codable, Hashable {
    let bagId: String
    // 아이템의 원래 팩(가방 전체로 띄웠어도)
    let packId: String
    let itemId: String
    // 누르기 전 값
    let prev: Bool
    let at: Double
}

enum PIBUndo {
    static let key = "pib.undoStack"
    static let limit = 50
    static let wholeBag = "*"

    private static func all() -> [PIBUndoEntry] {
        guard let data = PIB.defaults.data(forKey: key),
              let list = try? JSONDecoder().decode([PIBUndoEntry].self, from: data) else { return [] }
        return list
    }

    private static func set(_ list: [PIBUndoEntry]) {
        if list.isEmpty {
            PIB.defaults.removeObject(forKey: key)
        } else if let data = try? JSONEncoder().encode(Array(list.suffix(limit))) {
            PIB.defaults.set(data, forKey: key)
        }
    }

    private static func matches(_ e: PIBUndoEntry, bagId: String, packId: String) -> Bool {
        e.bagId == bagId && (packId == wholeBag || e.packId == packId)
    }

    static func push(bagId: String, packId: String, itemId: String, prev: Bool) {
        var list = all()
        list.append(PIBUndoEntry(bagId: bagId, packId: packId, itemId: itemId, prev: prev, at: Date().timeIntervalSince1970))
        set(list)
    }

    // ↶ 버튼을 보일지(지워진 아이템이 섞여 있을 수 있지만 누르면 건너뛰며 정리된다)
    static func count(bagId: String, packId: String) -> Int {
        all().filter { matches($0, bagId: bagId, packId: packId) }.count
    }

    // 범위 안의 가장 최근 것을 꺼내 요약에 반영하고 서버 대기열에 넣는다. 서버 전송(PIBSync.flush)은 부르는 쪽이
    @discardableResult
    static func undo(bagId: String, packId: String) -> PIBUndoEntry? {
        var list = all()
        defer { set(list) }
        while let i = list.lastIndex(where: { matches($0, bagId: bagId, packId: packId) }) {
            let e = list.remove(at: i)
            guard let current = PIBStore.item(bagId: e.bagId, packId: e.packId, itemId: e.itemId),
                  current.checked != e.prev else { continue }
            PIBStore.setChecked(bagId: e.bagId, packId: e.packId, itemId: e.itemId, checked: e.prev)
            PIBStore.enqueue(bagId: e.bagId, packId: e.packId, itemId: e.itemId, checked: e.prev)
            return e
        }
        return nil
    }
}

// ---- 서버 ---------------------------------------------------------------------

enum PIBAPI {
    private static func request(_ path: String, method: String = "GET", body: [String: Any]? = nil, token: String? = nil, base: String? = nil) async throws -> Data {
        guard let token = token ?? PIBStore.token else { throw PIBError.notSignedIn }
        guard let url = URL(string: (base ?? PIBStore.apiBase) + path) else { throw PIBError.server("주소가 올바르지 않아요") }
        var req = URLRequest(url: url, timeoutInterval: 15)
        req.httpMethod = method
        req.setValue("Device \(token)", forHTTPHeaderField: "Authorization")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 {
            throw PIBError.notSignedIn
        }
        guard (200..<300).contains(status) else {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            let text = message ?? "잠시 후 다시 시도해 주세요"
            // 429(하루 횟수)는 나중에 다시 보낼 수 있다
            throw (400..<500).contains(status) && status != 429 ? PIBError.rejected(text) : PIBError.server(text)
        }
        return data
    }

    // 서버에서 최신 요약을 받아 저장한다
    static func refreshSummary() async throws {
        let data = try await request("/api/native/summary")
        let summary = try JSONDecoder().decode(PIBSummary.self, from: data)
        PIBStore.save(summary)
    }

    static func toggle(bagId: String, packId: String, itemId: String, checked: Bool) async throws {
        _ = try await request("/api/native/toggle-item", method: "POST",
                              body: ["bagId": bagId, "packId": packId, "itemId": itemId, "checked": checked])
    }

    // 넣은 개수를 돌려준다(여러 줄이면 줄마다 하나)
    static func quickAdd(text: String) async throws -> Int {
        let data = try await request("/api/native/quick-add", method: "POST", body: ["text": text, "type": "check"])
        return ((try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["added"] as? Int) ?? 1
    }

    // 단축어 "가방에 추가"(10/11). packId가 없으면 미분류. (넣은 개수, 넣은 팩 이름)
    static func addItem(bagId: String, packId: String?, text: String) async throws -> (added: Int, packName: String) {
        var body: [String: Any] = ["bagId": bagId, "text": text]
        if let packId { body["packId"] = packId }
        let data = try await request("/api/native/add-item", method: "POST", body: body)
        let json = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
        return ((json["added"] as? Int) ?? 1, (json["packName"] as? String) ?? "미분류")
    }

    // 로그아웃 · 다른 계정 로그인 때 예전 토큰을 서버에서 지운다(실패해도 괜찮다)
    static func revoke(token: String, base: String) async {
        _ = try? await request("/api/native/device-token", method: "DELETE", token: token, base: base)
    }

    // 푸시(APNs) 토큰을 이 기기 토큰에 붙인다(앱 AppDelegate PIBPush가 부름, 2026-10-11)
    static func registerPush(token: String, environment: String, alerts: Bool) async throws {
        _ = try await request("/api/native/push-token", method: "POST",
                              body: ["token": token, "env": environment, "alerts": alerts])
    }

    // 실시간 현황 푸시 토큰(다른 멤버 체크를 서버가 잠금화면에 바로 반영, 2026-10-11)
    static func registerLive(token: String, bagId: String, packId: String) async throws {
        _ = try await request("/api/native/live-token", method: "POST",
                              body: ["token": token, "bagId": bagId, "packId": packId, "env": PIB.apnsEnvironment])
    }

    static func clearLive() async {
        _ = try? await request("/api/native/live-token", method: "DELETE")
    }
}

enum PIBWidgets {
    static func reload() {
        WidgetCenter.shared.reloadAllTimelines()
    }
}

// 못 보낸 체크를 서버로 보낸다(위젯을 누른 직후 · 위젯이 다시 그려질 때 · 앱이 요약을 넘길 때).
// 체크는 "이 값으로 맞추기"라 두 번 보내도 괜찮다.
enum PIBSync {
    @discardableResult
    static func flush() async -> Bool {
        var changed = false
        for t in PIBStore.pending() {
            do {
                try await PIBAPI.toggle(bagId: t.bagId, packId: t.packId, itemId: t.itemId, checked: t.checked)
                PIBStore.removePending(t)
            } catch PIBError.rejected {
                // 지워진 아이템 · 잠긴 가방 등 - 버리고 서버 값으로 돌린다
                PIBStore.removePending(t)
                PIBStore.setChecked(bagId: t.bagId, packId: t.packId, itemId: t.itemId, checked: !t.checked)
                changed = true
            } catch PIBError.notSignedIn {
                PIBStore.clearSession()
                return true
            } catch {
                // 네트워크 · 서버 잠깐 안 됨 - 다음에 다시
            }
        }
        return changed
    }
}
