// 잠금화면 실시간 현황(Live Activity) - 앱 · 위젯 공용(2026-10-10).
// 앱이 시작하고(웹 → PackInBagNativePlugin.startLiveActivity), 위젯 확장이 화면을 그린다(PackInBagWidgetLiveActivity.swift).
// 최대 8시간 표시(iOS 규칙) · 다 챙기면 5분 뒤 자동으로 내려간다. 내용은 App Group 요약에서 만든다.
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
    // 잠금화면에 보이는 줄 수(데이터 4KB 제한 안에서 넉넉히)
    static let maxItems = 5

    static func state(bagId: String, packId: String) -> PackActivityAttributes.ContentState? {
        guard let found = PIBStore.pack(bagId: bagId, packId: packId) else { return nil }
        let items = found.pack.items
        let ordered = items.filter { !$0.checked } + items.filter { $0.checked }
        return .init(
            bagName: found.bag.name,
            packName: found.pack.name,
            items: Array(ordered.prefix(maxItems)),
            done: items.filter { $0.checked }.count,
            total: items.count
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
        let activity = try Activity.request(
            attributes: attributes,
            content: .init(state: state, staleDate: nil),
            pushType: nil
        )
        return activity.id
    }

    // 요약이 바뀌었을 때(앱 · 위젯 체크 · 새로고침) 떠 있는 실시간 현황을 맞춘다
    static func updateAll() async {
        for activity in Activity<PackActivityAttributes>.activities {
            guard let state = state(bagId: activity.attributes.bagId, packId: activity.attributes.packId) else {
                await activity.end(nil, dismissalPolicy: .immediate)
                continue
            }
            let content = ActivityContent(state: state, staleDate: nil)
            if state.total > 0 && state.done == state.total {
                await activity.end(content, dismissalPolicy: .after(Date().addingTimeInterval(5 * 60)))
            } else if activity.content.state != state {
                await activity.update(content)
            }
        }
    }

    static func endAll() async {
        for activity in Activity<PackActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }

    static var current: (bagId: String, packId: String)? {
        Activity<PackActivityAttributes>.activities.first.map { ($0.attributes.bagId, $0.attributes.packId) }
    }
}
