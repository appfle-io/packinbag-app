// 팩인백 앱 · 위젯이 함께 쓰는 코드(2026-10-10). 이 Shared 폴더는 App · PackInBagWidgetExtension 두 타깃에 모두 들어간다.
// - App Group(group.com.appfle.packinbag)에 가방 요약 · 기기 토큰을 저장한다
// - 서버(/api/native/*)를 기기 토큰으로 부른다(앱이 꺼져 있어도 위젯 · 단축어 · 잠금화면에서)
// 요약 모양은 웹의 lib/nativeSummary.ts와 같다.
import Foundation
import WidgetKit

enum PIB {
    static let appGroup = "group.com.appfle.packinbag"
    static var defaults: UserDefaults { UserDefaults(suiteName: appGroup) ?? .standard }
    // 위젯이 이 시간보다 오래된 요약을 보면 서버에서 다시 받는다
    static let staleAfter: TimeInterval = 15 * 60
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
}

struct PIBBag: Codable, Hashable {
    let id: String
    var name: String
    var travelDate: String?
    var packs: [PIBPack]
}

struct PIBSummary: Codable {
    var v: Int
    var updatedAt: String
    var bags: [PIBBag]
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
        [tokenKey, uidKey, summaryKey, savedAtKey, pendingKey].forEach { PIB.defaults.removeObject(forKey: $0) }
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

    // 로그아웃 · 다른 계정 로그인 때 예전 토큰을 서버에서 지운다(실패해도 괜찮다)
    static func revoke(token: String, base: String) async {
        _ = try? await request("/api/native/device-token", method: "DELETE", token: token, base: base)
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
