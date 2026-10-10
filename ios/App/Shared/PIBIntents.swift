// 단축어 · 위젯 버튼 · 잠금화면 버튼이 부르는 동작(App Intents) - 앱 · 위젯 공용(2026-10-10).
// - 빠른팩에 입력: 단축어를 실행하면 화면 위에 입력창이 뜨고, 앱을 열지 않고 빠른팩에 넣는다
// - 팩인백 새로고침: 서버에서 최신 내용을 받아 위젯 · 실시간 현황에 바로 반영
// - 아이템 체크: 위젯 · 잠금화면의 체크 버튼(단축어 목록에는 안 보임)
// 같은 코드가 위젯 확장에도 들어가므로, 위젯 쪽(PIB_WIDGET)에서는 단축어 목록에 다시 보이지 않게 한다.
// 체크 · 새로고침은 LiveActivityIntent라 앱 프로세스에서 돈다(잠금화면 실시간 현황도 같이 갱신하려고).
import Foundation
import AppIntents
import WidgetKit

@available(iOS 17.0, *)
struct ToggleItemIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "아이템 체크"
    static let isDiscoverable = false

    @Parameter(title: "가방") var bagId: String
    @Parameter(title: "팩") var packId: String
    @Parameter(title: "아이템") var itemId: String

    init() {}

    init(bagId: String, packId: String, itemId: String) {
        self.bagId = bagId
        self.packId = packId
        self.itemId = itemId
    }

    func perform() async throws -> some IntentResult {
        guard let current = PIBStore.item(bagId: bagId, packId: packId, itemId: itemId) else { return .result() }
        let next = !current.checked
        // 화면 먼저 바꾸고(누르자마자 취소선 · 맨 아래로), 서버가 실패하면 되돌린다
        PIBStore.setChecked(bagId: bagId, packId: packId, itemId: itemId, checked: next)
        PIBWidgets.reload()
        await PIBLiveActivity.updateAll()
        do {
            try await PIBAPI.toggle(bagId: bagId, packId: packId, itemId: itemId, checked: next)
        } catch {
            PIBStore.setChecked(bagId: bagId, packId: packId, itemId: itemId, checked: !next)
            PIBWidgets.reload()
            await PIBLiveActivity.updateAll()
            throw error
        }
        return .result()
    }
}

@available(iOS 17.0, *)
struct RefreshIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "팩인백 새로고침"
    static let description = IntentDescription("서버에서 최신 가방을 받아 위젯과 잠금화면에 바로 반영해요")
    #if PIB_WIDGET
    static let isDiscoverable = false
    #else
    static let isDiscoverable = true
    #endif

    init() {}

    func perform() async throws -> some IntentResult & ProvidesDialog {
        try await PIBAPI.refreshSummary()
        PIBWidgets.reload()
        await PIBLiveActivity.updateAll()
        return .result(dialog: "최신 내용으로 바꿨어요")
    }
}

@available(iOS 17.0, *)
struct QuickAddIntent: AppIntent {
    static let title: LocalizedStringResource = "빠른팩에 입력"
    static let description = IntentDescription("앱을 열지 않고 빠른팩에 바로 적어 둬요. 여러 줄이면 줄마다 하나씩 들어가요")
    #if PIB_WIDGET
    static let isDiscoverable = false
    #else
    static let isDiscoverable = true
    #endif
    static let openAppWhenRun = false

    @Parameter(title: "내용", requestValueDialog: IntentDialog("빠른팩에 넣을 내용을 적어 주세요"))
    var text: String

    init() {}

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let added = try await PIBAPI.quickAdd(text: text)
        let message = added > 1 ? "빠른팩에 \(added)개 넣었어요" : "빠른팩에 넣었어요"
        return .result(dialog: "\(message)")
    }
}
