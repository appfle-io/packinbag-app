// 잠금화면 실시간 현황(Live Activity) - 앱 · 위젯 공용(2026-10-10, 10-11 원격 갱신 · 새로고침 시각).
// 앱이 시작하고(웹 → PackInBagNativePlugin.startLiveActivity), 위젯 확장이 화면을 그린다(PackInBagWidgetLiveActivity.swift).
// 최대 8시간 표시(iOS 규칙) · 다 챙기면 5분 뒤 자동으로 내려간다. 내용은 App Group 요약에서 만든다.
// 10/11(B-5): 시작할 때 푸시 토큰을 받아 서버에 올린다 → 다른 멤버가 체크하면 서버(functions/src/live.ts)가 이 화면을 바로 고친다.
//   서버가 보내는 content-state는 아래 ContentState와 같은 모양이어야 한다(키 이름 · 숫자 형식)
import Foundation
import ActivityKit

@available(iOS 16.2, *)
struct PackActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var bagName: String
        var packName: String
        // 안 챙긴 것 먼저, 그다음 챙긴 것(위에서부터 몇 개만)
        var items: [PIBItem]
        var done: Int
        var total: Int
        // 이 내용을 받은 시각(1970년부터 초). "N분 전" 표시용. 예전에 띄운 것은 없을 수 있다
        var syncedAt: Double?
        // 가방 전체(packId "*", 10/11)일 때 아이템 id → 원래 팩 id(체크를 그 팩으로 보낸다). 팩 하나면 없음
        var itemPacks: [String: String]?
        // 다 챙긴 시각(1970년부터 초, 10/11). 이때부터 5분 뒤 내린다. 하나라도 풀면 없어진다
        var doneAt: Double?
    }

    var bagId: String
    // 팩 id. "*"면 가방 전체(팩 순서대로 · 미분류 먼저 이어 붙임, 10/11)
    var packId: String
    // 꾸미기(시작할 때 고른 값): theme system|light|dark|custom · font system|pretendard|gmarket|gaegu|d2coding · size small|medium|large
    var theme: String
    var font: String
    var size: String
    // theme "custom"일 때 배경색 "#RRGGBB"와 불투명도(0~1, 10/12)
    var bgColor: String? = nil
    var bgAlpha: Double? = nil
    // 글자색(1.6, 10/12): nil = auto(배경에 맞춰, 예전과 같음) | "white" | "black" | "custom"(textColor "#RRGGBB").
    // 옛 빌드가 띄운 활동에는 없다(옵셔널이라 그대로 읽힌다). 다이내믹 아일랜드는 쓰지 않음(항상 다크)
    var textTone: String? = nil
    var textColor: String? = nil
    // 완료된 항목 보이기(1.6, 10/13): nil = 보임(예전과 같음) | false = 챙긴 것을 화면에서 뺀다(서버는 그대로 안 챙긴 것 먼저 보낸다)
    var showDone: Bool? = nil
    // 띄운 시각(1970년부터 초, 10/27). iOS가 8시간 뒤 끝내므로 그 직전을 멈춤 시각(staleDate)으로 둔다.
    // 옛 빌드가 띄운 활동에는 없다(멈춤 표시 없이 예전처럼)
    var startedAt: Double? = nil
}

@available(iOS 16.2, *)
enum PIBLiveActivity {
    // 잠금화면에 보이는 줄 수(데이터 4KB 제한 안에서 넉넉히). 서버(functions/src/live.ts MAX_LIVE_ITEMS)와 같게
    static let maxItems = 5
    static let wholeBag = "*"
    private static let liveSentKey = "pib.liveSent"
    // iOS는 띄운 때부터 8시간이 지나면 끝낸다(갱신해도 안 늘어남). 끝난 카드는 잠금화면에 남아도 고칠 수 없어서(10/27 버그:
    // 체크해도 먹통 · 앱에서 체크해도 안 바뀜) 5분 전부터 "멈췄어요"로 보이고, 앱을 열거나 카드를 누르면 다시 띄운다.
    // 서버(functions/src/live.ts STALE_AFTER_SEC)도 같은 값으로 stale-date를 보낸다
    static let staleAfter: TimeInterval = 8 * 3600 - 5 * 60

    static func staleDate(_ a: PackActivityAttributes) -> Date? {
        a.startedAt.map { Date(timeIntervalSince1970: $0 + staleAfter) }
    }

    // 지금 고칠 수 있는 카드(멈춤 시각이 지났어도 iOS가 끝내기 전이면 고칠 수는 있다)
    private static func isLive(_ activity: Activity<PackActivityAttributes>) -> Bool {
        activity.activityState == .active || activity.activityState == .stale
    }

    // 8시간 제한으로 끝났거나 곧 끝나는 카드
    private static func isStopped(_ activity: Activity<PackActivityAttributes>) -> Bool {
        if activity.activityState == .ended || activity.activityState == .stale { return true }
        return staleDate(activity.attributes).map { $0 <= Date() } ?? false
    }

    static func order(_ items: [PIBItem]) -> [PIBItem] {
        items.filter { !$0.checked } + items.filter { $0.checked }
    }

    static func state(bagId: String, packId: String) -> PackActivityAttributes.ContentState? {
        if packId == wholeBag {
            // 가방 전체: 요약의 팩 순서(미분류 먼저) 그대로 잇는다. 제목은 가방 이름, 옆 글은 "가방 전체"
            guard let bag = PIBStore.bag(bagId) else { return nil }
            var owner: [String: String] = [:]
            var items: [PIBItem] = []
            for p in bag.packs {
                for item in p.items where owner[item.id] == nil {
                    owner[item.id] = p.id
                    items.append(item)
                }
            }
            let shown = Array(order(items).prefix(maxItems))
            return .init(
                bagName: "가방 전체",
                packName: bag.name,
                items: shown,
                done: items.filter { $0.checked }.count,
                total: items.count,
                syncedAt: PIBStore.summarySavedAt?.timeIntervalSince1970,
                itemPacks: Dictionary(uniqueKeysWithValues: shown.map { ($0.id, owner[$0.id] ?? "") })
            )
        }
        guard let found = PIBStore.pack(bagId: bagId, packId: packId) else { return nil }
        let items = found.pack.items
        return .init(
            bagName: found.bag.name,
            packName: found.pack.name,
            items: Array(order(items).prefix(maxItems)),
            done: items.filter { $0.checked }.count,
            total: items.count,
            syncedAt: PIBStore.summarySavedAt?.timeIntervalSince1970
        )
    }

    // 같은 팩이 이미 떠 있으면 그것을 내리고 새로 띄운다
    @discardableResult
    static func start(
        bagId: String, packId: String, theme: String, font: String, size: String,
        bgColor: String? = nil, bgAlpha: Double? = nil, textTone: String? = nil, textColor: String? = nil, showDone: Bool? = nil
    ) async throws -> String {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            throw PIBError.server("설정 > 팩인백에서 실시간 현황을 켜 주세요")
        }
        guard let state = state(bagId: bagId, packId: packId) else { throw PIBError.server("팩을 찾을 수 없어요") }
        for activity in Activity<PackActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
        let tone = (textTone == nil || textTone == "auto") ? nil : textTone
        let attributes = PackActivityAttributes(
            bagId: bagId, packId: packId, theme: theme, font: font, size: size,
            bgColor: theme == "custom" ? bgColor : nil, bgAlpha: theme == "custom" ? bgAlpha : nil,
            textTone: tone, textColor: tone == "custom" ? textColor : nil,
            showDone: showDone == false ? false : nil,
            startedAt: Date().timeIntervalSince1970
        )
        let activity: Activity<PackActivityAttributes>
        do {
            // 푸시 토큰을 받는다(서버 원격 갱신). 푸시를 못 쓰는 상태면 토큰 없이라도 띄운다
            activity = try Activity.request(attributes: attributes, content: .init(state: state, staleDate: staleDate(attributes)), pushType: .token)
        } catch {
            activity = try Activity.request(attributes: attributes, content: .init(state: state, staleDate: staleDate(attributes)), pushType: nil)
        }
        PIB.defaults.removeObject(forKey: liveSentKey)
        if let data = try? JSONEncoder().encode(attributes) { PIB.defaults.set(data, forKey: configKey) }
        observe(activity)
        return activity.id
    }

    // 앱을 켤 때: 이미 떠 있는 것의 토큰도 다시 지켜본다
    static func observeExisting() {
        for activity in Activity<PackActivityAttributes>.activities { observe(activity) }
    }

    private static func observe(_ activity: Activity<PackActivityAttributes>) {
        let bagId = activity.attributes.bagId
        let packId = activity.attributes.packId
        Task {
            for await data in activity.pushTokenUpdates {
                let hex = data.map { String(format: "%02x", $0) }.joined()
                let mark = "\(hex)|\(bagId)|\(packId)"
                if PIB.defaults.string(forKey: liveSentKey) == mark { continue }
                do {
                    try await PIBAPI.registerLive(token: hex, bagId: bagId, packId: packId, startedAt: activity.attributes.startedAt)
                    PIB.defaults.set(mark, forKey: liveSentKey)
                } catch {
                    print("[팩인백] 실시간 현황 토큰 업로드 실패:", error.localizedDescription)
                }
            }
        }
    }

    // 요약이 바뀌었을 때(앱 · 새로고침 · 조용한 푸시) 떠 있는 실시간 현황을 맞춘다.
    // 서버가 더 최근에 고쳐 둔 화면(syncedAt이 더 늦음)은 예전 요약으로 되돌리지 않는다
    static func updateAll() async {
        for activity in Activity<PackActivityAttributes>.activities {
            guard isLive(activity) else { continue }
            // 다 챙긴 지 5분이 지났으면 내린다(다 챙긴 순간 바로 end하면 다시 풀 수 없어서, 10/11)
            if isExpired(activity.content.state) {
                await end(activity, content: activity.content, after: nil)
                continue
            }
            guard let state = state(bagId: activity.attributes.bagId, packId: activity.attributes.packId) else {
                await end(activity, content: nil, after: nil)
                continue
            }
            if let shown = activity.content.state.syncedAt, let mine = state.syncedAt, mine < shown { continue }
            await apply(state, to: activity)
        }
    }

    private static let doneLinger: TimeInterval = 5 * 60

    private static func isAllDone(_ s: PackActivityAttributes.ContentState) -> Bool {
        s.total > 0 && s.done == s.total
    }

    private static func isExpired(_ s: PackActivityAttributes.ContentState) -> Bool {
        guard isAllDone(s), let at = s.doneAt else { return false }
        return Date().timeIntervalSince1970 - at > doneLinger
    }

    // packId는 아이템의 원래 팩. 가방 전체("*")로 띄운 것도 같은 가방이면 찾는다.
    // 이미 끝난(ended) 것은 고칠 수 없으니 찾지 않는다
    private static func find(bagId: String, packId: String) -> Activity<PackActivityAttributes>? {
        Activity<PackActivityAttributes>.activities.first(where: {
            isLive($0) &&
            $0.attributes.bagId == bagId && ($0.attributes.packId == packId || $0.attributes.packId == wholeBag)
        })
    }

    // 잠금화면 카드에 지금 보이는 체크 값(끝난 카드도). 다시 띄우기 전에 누른 사람이 본 값을 기억하려고(10/27)
    static func shownChecked(bagId: String, itemId: String) -> Bool? {
        Activity<PackActivityAttributes>.activities
            .first(where: { $0.activityState != .dismissed && $0.attributes.bagId == bagId })?
            .content.state.items.first(where: { $0.id == itemId })?.checked
    }

    // 잠금화면에서 누른 체크: 지금 보이는 화면을 기준으로 바로 고친다(요약이 서버 원격 갱신보다 늦을 수 있어서).
    // 여기서는 체크 표시만 바꾼다. 정렬은 잠깐 뒤 reorder(B안, 10/13 - 누른 게 먼저 보이고 이어서 맨 뒤로)
    static func toggle(bagId: String, packId: String, itemId: String) async -> Bool? {
        guard let activity = find(bagId: bagId, packId: packId) else { return nil }
        var state = activity.content.state
        guard let index = state.items.firstIndex(where: { $0.id == itemId }) else { return nil }
        let next = !state.items[index].checked
        state.items[index].checked = next
        state.done = max(0, min(state.total, state.done + (next ? 1 : -1)))
        await apply(state, to: activity)
        return next
    }

    // 체크 직후 정렬(10/13): 서버 갱신을 기다리지 않고 지금 화면을 요약 순서대로(안 챙긴 것 먼저) 다시 세운다.
    // 예전에는 서버 저장 뒤 Cloud Function 푸시가 올 때까지(몇 초) 그대로라 안 눌린 줄 알았다
    static func reorder(bagId: String, packId: String) async {
        guard let activity = find(bagId: bagId, packId: packId) else { return }
        await apply(resorted(activity.content.state, attributes: activity.attributes), to: activity)
    }

    // 되돌리기(10/13): 한 아이템을 그 값으로 맞추고 바로 정렬한다. 화면에서 빠진 아이템(챙겨서 밀려남)은 요약에서 다시 넣는다
    static func set(bagId: String, packId: String, itemId: String, checked: Bool) async {
        guard let activity = find(bagId: bagId, packId: packId) else { return }
        var state = activity.content.state
        if let index = state.items.firstIndex(where: { $0.id == itemId }) {
            guard state.items[index].checked != checked else { return }
            state.items[index].checked = checked
        } else if let item = PIBStore.item(bagId: bagId, packId: packId, itemId: itemId) {
            var item = item
            item.checked = checked
            state.items.append(item)
            if activity.attributes.packId == wholeBag { state.itemPacks?[itemId] = packId }
        } else {
            return
        }
        state.done = max(0, min(state.total, state.done + (checked ? 1 : -1)))
        await apply(resorted(state, attributes: activity.attributes), to: activity)
    }

    // 요약(App Group)의 순서로 안 챙긴 것 먼저 → 챙긴 것. 체크 값은 지금 화면 것을 쓴다(서버가 원격으로 고친 값일 수 있어서).
    // 안 챙긴 것이 maxItems보다 적으면 요약에서 채운다(연달아 챙겨도 빈자리가 안 생기게, "완료된 항목 숨기기"에서 특히)
    private static func resorted(_ s: PackActivityAttributes.ContentState, attributes a: PackActivityAttributes) -> PackActivityAttributes.ContentState {
        var rank: [String: Int] = [:]
        var owner: [String: String] = [:]
        var catalog: [PIBItem] = []
        if let bag = PIBStore.bag(a.bagId) {
            for p in bag.packs where a.packId == wholeBag || p.id == a.packId {
                for item in p.items where rank[item.id] == nil {
                    rank[item.id] = catalog.count
                    owner[item.id] = p.id
                    catalog.append(item)
                }
            }
        }
        var state = s
        var items = s.items
        var have = Set(items.map(\.id))
        for item in catalog where !item.checked && !have.contains(item.id) {
            if items.filter({ !$0.checked }).count >= maxItems { break }
            items.append(item)
            have.insert(item.id)
        }
        let sorted = items.enumerated().sorted { x, y in
            if x.element.checked != y.element.checked { return !x.element.checked }
            let rx = rank[x.element.id] ?? Int.max
            let ry = rank[y.element.id] ?? Int.max
            return rx != ry ? rx < ry : x.offset < y.offset
        }.map(\.element)
        state.items = Array(sorted.prefix(maxItems))
        if a.packId == wholeBag {
            state.itemPacks = Dictionary(uniqueKeysWithValues: state.items.map { ($0.id, s.itemPacks?[$0.id] ?? owner[$0.id] ?? "") })
        }
        return state
    }

    // 다 챙겨도 바로 내리지 않는다(10/11 버그: 예전에는 다 챙기는 순간 end(5분 뒤 사라짐) → 끝난 화면은 고칠 수 없어
    // 잠금화면에서 해제를 눌러도 화면은 그대로이고 서버만 풀렸다). 다 챙긴 시각(doneAt)만 남기고 계속 띄워 두며,
    // 5분이 지나면 다음 갱신(앱 · 새로고침 · 조용한 푸시) 때 내린다. 그 전에 사용자가 옆으로 밀어 지울 수도 있다
    private static func apply(_ state: PackActivityAttributes.ContentState, to activity: Activity<PackActivityAttributes>) async {
        var state = state
        if isAllDone(state) {
            state.doneAt = activity.content.state.doneAt ?? state.doneAt ?? Date().timeIntervalSince1970
        } else {
            state.doneAt = nil
        }
        let stale = staleDate(activity.attributes)
        guard activity.content.state != state || activity.content.staleDate != stale else { return }
        await activity.update(ActivityContent(state: state, staleDate: stale))
    }

    private static func end(_ activity: Activity<PackActivityAttributes>, content: ActivityContent<PackActivityAttributes.ContentState>?, after: Date?) async {
        let policy: ActivityUIDismissalPolicy = after.map { ActivityUIDismissalPolicy.after($0) } ?? .immediate
        await activity.end(content, dismissalPolicy: policy)
        PIB.defaults.removeObject(forKey: liveSentKey)
        await PIBAPI.clearLive()
    }

    // 단축어 "잠금화면 다시 띄우기"(10/11): iOS는 띄운 때부터 8시간이 지나면 끝낸다(갱신해도 늘어나지 않음).
    // 같은 설정(가방 · 팩 · 꾸미기)으로 내렸다 새로 띄워 8시간을 다시 시작한다. 자동화(00 · 08 · 16시 등)에 걸어 둔다.
    // 11/1: 챙길 게 없으면(다 챙김 · 아이템 0개 · 팩이 요약에 없음) 새로 띄우지 않고 남은 카드도 내린다(예전에는 옛 카드가
    // 그대로 남아 갱신이 안 된 것처럼 보였다). 설정은 기억해 두어(configKey) 카드가 없어도 다음 실행 때 아이템이 생겼으면 다시 띄운다.
    // 설정을 잊는 건 앱에서 내리기 · 로그아웃(endAll)뿐
    enum RestartResult { case restarted, nothingLeft, noCard }

    static func restart() async -> RestartResult {
        let shown = Activity<PackActivityAttributes>.activities.first(where: { $0.activityState != .dismissed })
        guard let a = shown?.attributes ?? savedConfig else { return .noCard }
        guard let fresh = state(bagId: a.bagId, packId: a.packId), fresh.total > 0, !isAllDone(fresh) else {
            await endAll(forget: false)
            return .nothingLeft
        }
        do {
            _ = try await start(
                bagId: a.bagId, packId: a.packId, theme: a.theme, font: a.font, size: a.size,
                bgColor: a.bgColor, bgAlpha: a.bgAlpha, textTone: a.textTone, textColor: a.textColor, showDone: a.showDone
            )
            return .restarted
        } catch {
            print("[팩인백] 잠금화면 다시 띄우기 실패:", error.localizedDescription)
            return .noCard
        }
    }

    private static let configKey = "pib.liveConfig"

    private static var savedConfig: PackActivityAttributes? {
        PIB.defaults.data(forKey: configKey).flatMap { try? JSONDecoder().decode(PackActivityAttributes.self, from: $0) }
    }

    // 8시간 제한으로 끝났거나 곧 끝나는 카드를 같은 설정으로 다시 띄운다(10/27). 앱을 열 때 · 잠금화면 카드를 누를 때.
    // 살아 있는 카드가 있거나, bagId를 줬는데 다른 가방이면 그대로 둔다. 다시 띄웠으면 true.
    // 앱이 뒤에 있을 때(조용한 푸시)는 iOS가 새로 띄우기를 막으므로 부르지 않는다
    @discardableResult
    static func restartIfStopped(bagId: String? = nil) async -> Bool {
        let list = Activity<PackActivityAttributes>.activities.filter { $0.activityState != .dismissed }
        if list.contains(where: { $0.activityState == .active && !isStopped($0) }) { return false }
        guard let activity = list.first, isStopped(activity) else { return false }
        if let bagId, activity.attributes.bagId != bagId { return false }
        return await restart() == .restarted
    }

    // forget: 다시 띄울 설정도 잊는다(앱에서 내리기 · 로그아웃). 단축어가 챙길 게 없어 내릴 때는 false
    static func endAll(forget: Bool = true) async {
        if forget { PIB.defaults.removeObject(forKey: configKey) }
        let list = Activity<PackActivityAttributes>.activities
        for activity in list {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
        if !list.isEmpty {
            PIB.defaults.removeObject(forKey: liveSentKey)
            await PIBAPI.clearLive()
        }
    }

    static var current: (bagId: String, packId: String)? {
        Activity<PackActivityAttributes>.activities.first.map { ($0.attributes.bagId, $0.attributes.packId) }
    }
}
