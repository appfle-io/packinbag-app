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
    // theme "custom"일 때 배경색 "#RRGGBB"와 불투명도(0.2~1, 10/11)
    var bgColor: String? = nil
    var bgAlpha: Double? = nil
}

@available(iOS 16.2, *)
enum PIBLiveActivity {
    // 잠금화면에 보이는 줄 수(데이터 4KB 제한 안에서 넉넉히). 서버(functions/src/live.ts MAX_LIVE_ITEMS)와 같게
    static let maxItems = 5
    static let wholeBag = "*"
    private static let liveSentKey = "pib.liveSent"

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
        bgColor: String? = nil, bgAlpha: Double? = nil
    ) async throws -> String {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            throw PIBError.server("설정 > 팩인백에서 실시간 현황을 켜 주세요")
        }
        guard let state = state(bagId: bagId, packId: packId) else { throw PIBError.server("팩을 찾을 수 없어요") }
        for activity in Activity<PackActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
        let attributes = PackActivityAttributes(
            bagId: bagId, packId: packId, theme: theme, font: font, size: size,
            bgColor: theme == "custom" ? bgColor : nil, bgAlpha: theme == "custom" ? bgAlpha : nil
        )
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
            guard activity.activityState == .active else { continue }
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

    // 잠금화면에서 누른 체크: 지금 보이는 화면을 기준으로 바로 고친다(요약이 서버 원격 갱신보다 늦을 수 있어서).
    // packId는 아이템의 원래 팩. 가방 전체("*")로 띄운 것도 같은 가방이면 찾는다.
    // 이미 끝난(ended) 것은 고칠 수 없으니 찾지 않는다
    static func toggle(bagId: String, packId: String, itemId: String) async -> Bool? {
        guard let activity = Activity<PackActivityAttributes>.activities.first(where: {
            $0.activityState == .active &&
            $0.attributes.bagId == bagId && ($0.attributes.packId == packId || $0.attributes.packId == wholeBag)
        }) else {
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
        guard activity.content.state != state else { return }
        await activity.update(ActivityContent(state: state, staleDate: nil))
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
