// 팩인백 앱 · 위젯이 함께 쓰는 코드(2026-10-10). 이 Shared 폴더는 App · PackInBagWidgetExtension 두 타깃에 모두 들어간다.
// - App Group(group.com.appfle.packinbag)에 가방 요약 · 기기 토큰을 저장한다
// - 서버(/api/native/*)를 기기 토큰으로 부른다(앱이 꺼져 있어도 위젯 · 단축어 · 잠금화면에서)
// 요약 모양은 웹의 lib/nativeSummary.ts와 같다.
import Foundation
import WidgetKit
import UIKit
import SwiftUI

enum PIB {
    static let appGroup = "group.com.appfle.packinbag"
    static var defaults: UserDefaults { UserDefaults(suiteName: appGroup) ?? .standard }
    // 위젯 자동 새로고침 주기(안전망): 이 시간보다 오래된 요약을 보면 서버에서 다시 받는다(10/11 15분 → 30분, 10/17 → 1시간).
    // 요약 한 번 = 내가 멤버인 가방 수 + 2번 읽기라 기기마다 하루 48번 → 24번으로. 함께 쓰는 가방 변경은 조용한 푸시가 바로 알려 준다
    static let staleAfter: TimeInterval = 60 * 60
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
    // 마지막으로 다 싼 때(ISO, 1.7 · 2026-10-18). 북마크 위젯 "다 싼 날"
    var lastPackedAt: String? = nil
    // D-Day 당일을 1일로 세기(웹 Bag.ddayCountTodayAsDayOne, 2026-10-29). 켠 가방만 true — 당일부터 D+1
    var ddayDayOne: Bool? = nil

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

    // 서버가 토큰을 거절했을 때(401): 토큰만 지운다. 같은 계정이라 요약 · 꾸미기는 두고, 앱을 열면 웹이 새 토큰을 넣는다(2026-10-22)
    static func clearToken() {
        PIB.defaults.removeObject(forKey: tokenKey)
    }

    static func clearSession() {
        [tokenKey, uidKey, summaryKey, savedAtKey, pendingKey, PIBUndo.key].forEach { PIB.defaults.removeObject(forKey: $0) }
        // 북마크 위젯 꾸미기 · 사진도(다른 계정 · 로그아웃 뒤 예전 사진이 보이지 않게, 1.7)
        PIBStyleStore.clear()
    }
}

// ---- 북마크 위젯(가방 바로가기) 꾸미기(1.7, 2026-10-18) -------------------------------------------
// 웹 설정 > 위젯 꾸미기에서 저장한 것(users/{uid}.widgetStyles)을 웹이 넘긴다(lib/v2/nativeBridge pushWidgetStyles).
// 모양은 lib/types.ts WidgetStyle과 같다. 사진은 내려받기 주소로 받아 App Group 폴더에 줄여 둔다(자르기는 값으로 그릴 때)
struct PIBWidgetStyleShow: Codable, Hashable {
    var name: Bool = true
    var dday: Bool = true
    var progress: Bool = true
    var left: Bool = false
    var bar: Bool = true
    var packed: Bool = false
}

struct PIBWidgetStyle: Codable, Hashable {
    let id: String
    var name: String
    // plain | photo | solid
    var bg: String
    var color: String?
    var photoUrl: String?
    var photoPath: String?
    var zoom: Double?
    var x: Double?
    var y: Double?
    var dim: Double?
    // auto | white | black | custom
    var ink: String
    var inkColor: String?
    // tl tc tr ml mc mr bl bc br
    var pos: String
    var show: PIBWidgetStyleShow

    // 사진 파일 이름: Storage 경로의 마지막(사진을 바꾸면 경로가 바뀌어 새로 받는다)
    var photoFileName: String? {
        guard bg == "photo", let path = photoPath, photoUrl != nil else { return nil }
        let name = (path as NSString).lastPathComponent
        return name.isEmpty ? nil : name
    }
}

private struct PIBWidgetStyleList: Codable {
    var v: Int
    var styles: [PIBWidgetStyle]
}

enum PIBStyleStore {
    private static let key = "pib.widgetStyles"
    // 위젯에서 쓸 사진의 긴 변(작은 위젯에는 충분, 위젯 메모리 한도 안)
    private static let photoMaxSide: CGFloat = 900

    static func all() -> [PIBWidgetStyle] {
        guard let data = PIB.defaults.data(forKey: key),
              let list = try? JSONDecoder().decode(PIBWidgetStyleList.self, from: data) else { return [] }
        return list.styles
    }

    static func style(_ id: String) -> PIBWidgetStyle? {
        all().first { $0.id == id }
    }

    @discardableResult
    static func save(json: String) -> Bool {
        guard let data = json.data(using: .utf8),
              (try? JSONDecoder().decode(PIBWidgetStyleList.self, from: data)) != nil else { return false }
        PIB.defaults.set(data, forKey: key)
        return true
    }

    static func clear() {
        PIB.defaults.removeObject(forKey: key)
        if let dir = photoDir { try? FileManager.default.removeItem(at: dir) }
    }

    private static var photoDir: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: PIB.appGroup)?
            .appendingPathComponent("WidgetPhotos", isDirectory: true)
    }

    private static func fileURL(_ name: String) -> URL? {
        photoDir?.appendingPathComponent(name)
    }

    static func image(for style: PIBWidgetStyle) -> UIImage? {
        guard let name = style.photoFileName, let url = fileURL(name) else { return nil }
        return UIImage(contentsOfFile: url.path)
    }

    // 없는 사진은 내려받고, 안 쓰는 파일은 지운다. 무언가 바뀌었으면 true(위젯을 다시 그릴 것)
    @discardableResult
    static func syncPhotos() async -> Bool {
        guard let dir = photoDir else { return false }
        let fm = FileManager.default
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        let styles = all()
        var wanted: [String: String] = [:]
        for s in styles {
            if let name = s.photoFileName, let url = s.photoUrl { wanted[name] = url }
        }
        var changed = false
        for name in (try? fm.contentsOfDirectory(atPath: dir.path)) ?? [] where wanted[name] == nil {
            try? fm.removeItem(at: dir.appendingPathComponent(name))
            changed = true
        }
        for (name, link) in wanted {
            let target = dir.appendingPathComponent(name)
            if fm.fileExists(atPath: target.path) { continue }
            guard let url = URL(string: link),
                  let result = try? await URLSession.shared.data(from: url),
                  ((result.1 as? HTTPURLResponse)?.statusCode ?? 0) == 200,
                  let image = UIImage(data: result.0),
                  let jpeg = downsized(image).jpegData(compressionQuality: 0.85) else { continue }
            if (try? jpeg.write(to: target, options: .atomic)) != nil { changed = true }
        }
        return changed
    }

    private static func downsized(_ image: UIImage) -> UIImage {
        let side = max(image.size.width, image.size.height)
        guard side > photoMaxSide else { return image }
        let scale = photoMaxSide / side
        let size = CGSize(width: floor(image.size.width * scale), height: floor(image.size.height * scale))
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
    }
}

// "#RRGGBB" → 색 · 밝기(웹 lib/v2/widgetStyles hexLuminance와 같은 식)
func pibRGB(_ hex: String?) -> (r: Double, g: Double, b: Double)? {
    guard let hex, hex.count == 7, hex.hasPrefix("#"), let v = UInt32(hex.dropFirst(), radix: 16) else { return nil }
    return (Double((v >> 16) & 0xFF) / 255, Double((v >> 8) & 0xFF) / 255, Double(v & 0xFF) / 255)
}

func pibHexColor(_ hex: String?) -> Color? {
    guard let c = pibRGB(hex) else { return nil }
    return Color(red: c.r, green: c.g, blue: c.b)
}

func pibLuminance(_ hex: String?) -> Double {
    guard let c = pibRGB(hex) else { return 1 }
    return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b
}

// 남은 날 → "D-3" / "D-Day" / "D+2"(웹 widgetStyles.ts ddayText와 같음). dayOne이면 당일부터 D+1
func pibDDayLabel(_ days: Int, dayOne: Bool) -> String {
    if days > 0 { return "D-\(days)" }
    if dayOne { return "D+\(-days + 1)" }
    return days == 0 ? "D-Day" : "D+\(-days)"
}

// 북마크 위젯 문구(웹 widgetStyles.ts ddayText · packedText · widgetMetaLine과 같음)
enum PIBBookmarkText {
    static func dday(_ bag: PIBBag) -> String? {
        guard let d = bag.daysLeft else { return nil }
        return pibDDayLabel(d, dayOne: bag.ddayDayOne == true)
    }

    static func packed(_ iso: String?, now: Date = Date()) -> String? {
        guard let iso, let date = parse(iso) else { return nil }
        let cal = Calendar.current
        let days = cal.dateComponents([.day], from: cal.startOfDay(for: date), to: cal.startOfDay(for: now)).day ?? 0
        if days == 0 { return "오늘 다 쌌어요" }
        if days == 1 { return "어제 다 쌌어요" }
        let c = cal.dateComponents([.month, .day], from: date)
        return "\(c.month ?? 0)/\(c.day ?? 0) 다 쌌어요"
    }

    private static func parse(_ iso: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: iso) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: iso)
    }

    static func counts(_ bag: PIBBag) -> (done: Int, total: Int) {
        let items = bag.packs.flatMap { $0.items }
        return (items.filter { $0.checked }.count, items.count)
    }

    static func meta(_ bag: PIBBag, show: PIBWidgetStyleShow, now: Date = Date()) -> String {
        let (done, total) = counts(bag)
        let left = total - done
        var parts: [String] = []
        if show.progress { parts.append("\(done)/\(total) 챙김") }
        if show.left { parts.append(total > 0 && left == 0 ? "다 챙겼어요" : "남은 \(left)개") }
        if show.packed, let p = packed(bag.lastPackedAt, now: now) { parts.append(p) }
        return parts.joined(separator: " · ")
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
            // 서버가 토큰을 모르면(만료 · 로그아웃 · 계정 삭제) 지금 저장된 토큰을 지운다 → 앱을 열면 새 토큰을 받는다
            // (2026-10-22, 서버는 90일 안 쓴 토큰을 만료 — security_review SEC-AUTH-04). 예전 토큰을 지우러 보낸 요청이면 그대로 둔다
            if token == PIBStore.token { PIBStore.clearToken() }
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
    // startedAt(10/27): 띄운 시각 → 서버가 원격 갱신에 같은 멈춤 시각(stale-date)을 붙인다
    static func registerLive(token: String, bagId: String, packId: String, startedAt: Double?) async throws {
        var body: [String: Any] = ["token": token, "bagId": bagId, "packId": packId, "env": PIB.apnsEnvironment]
        if let startedAt { body["startedAt"] = startedAt }
        _ = try await request("/api/native/live-token", method: "POST", body: body)
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
