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
    }

    var bagId: String
    var packId: String
    // 꾸미기(시작할 때 고른 값): theme system|light|dark · font system|pretendard|gmarket|gaegu|d2coding · size small|medium|large
    var theme: String
    var font: String
    var size: String
}

@available(iOS 16.2, *)
enum PIBLiveActivity {
    // 잠금화면에 보이는 줄 수(데이터 4KB 제한 안에서 넉넉히). 서버(functions/src/live.ts MAX_LIVE_ITEMS)와 같게
    static let maxItems = 5
    private static let liveSentKey = "pib.liveSent"

    static func order(_ items: [PIBItem]) -> [PIBItem] {
        items.filter { !$0.checked } + items.filter { $0.checked }
    }

    static func state(bagId: String, packId: String) -> PackActivityAttributes.ContentState? {
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
    static func start(bagId: String, packId: String, theme: String, font: String, size: String) async throws -> String {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            throw PIBError.server("설정 > 팩인백에서 실시간 현황을 켜 주세요")
        }
        guard let state = state(bagId: bagId, packId: packId) else { throw PIBError.server("팩을 찾을 수 없어요") }
        for activity in Activity<PackActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
        let attributes = PackActivityAttributes(bagId: bagId, packId: packId, theme: theme, font: font, size: size)
        let activity: Activity<PackActivityAttributes>
        do {
            // 푸시 토큰을 받는다(서버 원격 갱신). 푸시를 못 쓰는 상태면 토큰 없이라도 띄운다
            activity = try Activity.request(attributes: attributes, content: .init(state: state, staleDate: nil), pushType: .token)
        } catch {
            activity = try Activity.request(attributes: attributes, content: .init(state: state, staleDate: nil), pushType: nil)
        }
        PIB.defaults.removeObject(forKey: liveSentKey)
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
                    try await PIBAPI.registerLive(token: hex, bagId: bagId, packId: packId)
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
            // 이미 끝난(다 챙겨 내려가는 중인) 것은 두고 본다
            guard activity.activityState == .active else { continue }
            guard let state = state(bagId: activity.attributes.bagId, packId: activity.attributes.packId) else {
                await end(activity, content: nil, after: nil)
                continue
            }
            if let shown = activity.content.state.syncedAt, let mine = state.syncedAt, mine < shown { continue }
            await apply(state, to: activity)
        }
    }

    // 잠금화면에서 누른 체크: 지금 보이는 화면을 기준으로 바로 고친다(요약이 서버 원격 갱신보다 늦을 수 있어서)
    static func toggle(bagId: String, packId: String, itemId: String) async -> Bool? {
        guard let activity = Activity<PackActivityAttributes>.activities.first(where: { $0.attributes.bagId == bagId && $0.attributes.packId == packId }) else {
            return nil
        }
        var state = activity.content.state
        guard let index = state.items.firstIndex(where: { $0.id == itemId }) else { return nil }
        let next = !state.items[index].checked
        state.items[index].checked = next
        state.done = max(0, min(state.total, state.done + (next ? 1 : -1)))
        // 다시 정렬하지 않는다(누른 줄이 손가락 아래에서 사라지지 않게). 다음 갱신 때 정렬된다
        await apply(state, to: activity)
        return next
    }

    private static func apply(_ state: PackActivityAttributes.ContentState, to activity: Activity<PackActivityAttributes>) async {
        let content = ActivityContent(state: state, staleDate: nil)
        if state.total > 0 && state.done == state.total {
            await end(activity, content: content, after: Date().addingTimeInterval(5 * 60))
        } else if activity.content.state != state {
            await activity.update(content)
        }
    }

    private static func end(_ activity: Activity<PackActivityAttributes>, content: ActivityContent<PackActivityAttributes.ContentState>?, after: Date?) async {
        let policy: ActivityUIDismissalPolicy = after.map { ActivityUIDismissalPolicy.after($0) } ?? .immediate
        await activity.end(content, dismissalPolicy: policy)
        PIB.defaults.removeObject(forKey: liveSentKey)
        await PIBAPI.clearLive()
    }

    static func endAll() async {
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
