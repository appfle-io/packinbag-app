// 단축어 · 위젯 버튼 · 잠금화면 버튼이 부르는 동작(App Intents) - 앱 · 위젯 공용(2026-10-10).
// - 빠른팩에 입력: 단축어를 실행하면 화면 위에 입력창이 뜨고, 앱을 열지 않고 빠른팩에 넣는다
// - 팩인백 새로고침: 서버에서 최신 내용을 받아 위젯 · 실시간 현황에 바로 반영
// - 아이템 체크: 위젯 · 잠금화면의 체크 버튼(단축어 목록에는 안 보임)
// 같은 코드가 위젯 확장에도 들어가므로, 위젯 쪽(PIB_WIDGET)에서는 단축어 목록에 다시 보이지 않게 한다.
// 체크 · 새로고침은 LiveActivityIntent라 앱 프로세스에서 돈다(잠금화면 실시간 현황도 같이 갱신하려고).
import Foundation
import AppIntents
import WidgetKit

// 위젯 버튼: 위젯 확장 안에서 바로 돈다(앱을 깨우지 않아 빠름). 화면에 먼저 반영하고 서버는 뒤에서 보낸다.
// 예전에는 앱 프로세스(LiveActivityIntent)에서 서버 응답까지 기다려 3~4초 걸렸다(10/10)
@available(iOS 17.0, *)
struct ToggleItemIntent: AppIntent {
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
        PIBStore.setChecked(bagId: bagId, packId: packId, itemId: itemId, checked: next)
        PIBStore.enqueue(bagId: bagId, packId: packId, itemId: itemId, checked: next)
        // 서버 전송은 기다리지 않는다(돌아가자마자 위젯이 다시 그려진다). 못 보내면 다음 그릴 때 · 앱이 열릴 때 다시
        Task { await PIBSync.flush() }
        return .result()
    }
}

// 잠금화면 실시간 현황 버튼: 실시간 현황을 고칠 수 있는 앱 프로세스에서 돈다
@available(iOS 17.0, *)
struct ToggleItemLiveIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "아이템 체크(잠금화면)"
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
        // 지금 잠금화면에 보이는 값을 기준으로 뒤집는다(서버가 원격으로 고쳤을 수 있어 요약보다 최신일 수 있다, 10/11)
        let next: Bool
        if let shown = await PIBLiveActivity.toggle(bagId: bagId, packId: packId, itemId: itemId) {
            next = shown
        } else {
            guard let current = PIBStore.item(bagId: bagId, packId: packId, itemId: itemId) else { return .result() }
            next = !current.checked
        }
        PIBStore.setChecked(bagId: bagId, packId: packId, itemId: itemId, checked: next)
        PIBStore.enqueue(bagId: bagId, packId: packId, itemId: itemId, checked: next)
        PIBWidgets.reload()
        if await PIBSync.flush() {
            await PIBLiveActivity.updateAll()
            PIBWidgets.reload()
        }
        return .result()
    }
}

// 위젯의 새로고침 버튼(10/11): 위젯 확장 안에서 서버 최신 요약을 받는다. 자동 새로고침 주기는 없다(사용자가 누를 때만)
@available(iOS 17.0, *)
struct RefreshWidgetIntent: AppIntent {
    static let title: LocalizedStringResource = "위젯 새로고침"
    static let isDiscoverable = false

    init() {}

    func perform() async throws -> some IntentResult {
        if !PIBStore.pending().isEmpty { await PIBSync.flush() }
        try? await PIBAPI.refreshSummary()
        PIBWidgets.reload()
        return .result()
    }
}

// 잠금화면 실시간 현황의 새로고침 버튼: 실시간 현황을 고칠 수 있는 앱 프로세스에서 돈다
@available(iOS 17.0, *)
struct RefreshLiveIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "잠금화면 새로고침"
    static let isDiscoverable = false

    init() {}

    func perform() async throws -> some IntentResult {
        if !PIBStore.pending().isEmpty { await PIBSync.flush() }
        try? await PIBAPI.refreshSummary()
        await PIBLiveActivity.updateAll()
        PIBWidgets.reload()
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

// 잠금화면 실시간 현황을 같은 설정으로 새로 띄운다(10/11). iOS 제한 8시간을 다시 시작 - 단축어 자동화(00 · 08 · 16시)용.
// 앱 프로세스에서 돈다(LiveActivityIntent - 앱을 열지 않고도 실시간 현황을 띄울 수 있는 방법)
@available(iOS 17.0, *)
struct RestartLiveIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "잠금화면 다시 띄우기"
    static let description = IntentDescription("잠금화면에 띄운 가방을 같은 설정으로 새로 띄워요. iOS는 8시간이 지나면 내리니 자동화로 하루 세 번(예: 0시 · 8시 · 16시) 실행해 두세요")
    #if PIB_WIDGET
    static let isDiscoverable = false
    #else
    static let isDiscoverable = true
    #endif

    init() {}

    func perform() async throws -> some IntentResult & ProvidesDialog {
        if !PIBStore.pending().isEmpty { await PIBSync.flush() }
        try? await PIBAPI.refreshSummary()
        let restarted = await PIBLiveActivity.restart()
        PIBWidgets.reload()
        return .result(dialog: restarted ? "잠금화면에 다시 띄웠어요" : "다시 띄울 게 없어요")
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

// ---- 단축어 "가방에 추가"(10/11) --------------------------------------------------------
// 가방을 고르고(필수) 팩을 고른다(선택 - 비워 두면 미분류). 팩 목록은 고른 가방의 팩만 보인다(IntentParameterDependency).
// 목록은 App Group 요약(최근 가방 30개)에서 만든다. 비어 있으면 서버에서 한 번 받는다

// 가방 목록(단축어 "가방에 추가" · 위젯 편집 공용, 10/11): 곧 출발(D-Day 7일 이내) → 고정한 가방 → 최근 쓴 가방 묶음 + 검색.
// 보관함 가방은 요약에서 이미 빠져 있다(lib/nativeSummary.ts)
@available(iOS 17.0, *)
struct BagEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "가방"
    static let defaultQuery = BagEntityQuery()

    let id: String
    let name: String
    var detail: String = ""
    var group: Group = .recent

    enum Group { case soon, pinned, recent }

    var displayRepresentation: DisplayRepresentation {
        detail.isEmpty ? DisplayRepresentation(title: "\(name)") : DisplayRepresentation(title: "\(name)", subtitle: "\(detail)")
    }

    init(id: String, name: String, detail: String = "", group: Group = .recent) {
        self.id = id
        self.name = name
        self.detail = detail
        self.group = group
    }

    init(_ bag: PIBBag) {
        let items = bag.packs.reduce(0) { $0 + $1.items.count }
        var parts = ["팩 \(bag.packs.count)개", "아이템 \(items)개"]
        if let d = bag.daysLeft, d >= 0 { parts.append(d == 0 ? "D-Day" : "D-\(d)") }
        let group: Group
        if let d = bag.daysLeft, d >= 0, d <= 7 { group = .soon }
        else if bag.pinned == true { group = .pinned }
        else { group = .recent }
        self.init(id: bag.id, name: bag.name, detail: parts.joined(separator: " · "), group: group)
    }

    static func all() async -> [BagEntity] {
        if PIBStore.summary() == nil, PIBStore.token != nil { try? await PIBAPI.refreshSummary() }
        return (PIBStore.summary()?.bags ?? []).map { BagEntity($0) }
    }
}

@available(iOS 17.0, *)
struct BagEntityQuery: EntityStringQuery {
    func entities(for identifiers: [String]) async throws -> [BagEntity] {
        let all = await BagEntity.all()
        return identifiers.compactMap { id in all.first { $0.id == id } }
    }

    func entities(matching string: String) async throws -> IntentItemCollection<BagEntity> {
        let found = await BagEntity.all().filter { $0.name.localizedCaseInsensitiveContains(string) }
        return IntentItemCollection(sections: [IntentItemSection("검색 결과", items: found)])
    }

    func suggestedEntities() async throws -> IntentItemCollection<BagEntity> {
        let all = await BagEntity.all()
        let soon = all.filter { $0.group == .soon }
        let pinned = all.filter { $0.group == .pinned }
        let recent = all.filter { $0.group == .recent }
        var sections: [IntentItemSection<BagEntity>] = []
        if !soon.isEmpty { sections.append(IntentItemSection("곧 출발", items: soon)) }
        if !pinned.isEmpty { sections.append(IntentItemSection("고정한 가방", items: pinned)) }
        if !recent.isEmpty { sections.append(IntentItemSection("최근 쓴 가방", items: recent)) }
        return IntentItemCollection(sections: sections)
    }
}

@available(iOS 17.0, *)
struct BagPackEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "팩"
    static let defaultQuery = BagPackEntityQuery()

    // "가방id|팩id"
    let id: String
    let name: String
    // 검색 결과 아래 줄(1.6)
    var bagName: String = ""

    var bagId: String { String(id.split(separator: "|").first ?? "") }
    var packId: String { String(id.split(separator: "|").last ?? "") }

    var displayRepresentation: DisplayRepresentation {
        bagName.isEmpty ? DisplayRepresentation(title: "\(name)") : DisplayRepresentation(title: "\(name)", subtitle: "\(bagName)")
    }

    // 미분류는 목록에서 뺀다(팩을 비워 두면 미분류)
    static func of(bagId: String?) -> [BagPackEntity] {
        (PIBStore.summary()?.bags ?? [])
            .filter { bagId == nil || $0.id == bagId }
            .flatMap { bag in
                bag.packs.filter { $0.inbox != true }.map { BagPackEntity(id: "\(bag.id)|\($0.id)", name: $0.name, bagName: bag.name) }
            }
    }
}

@available(iOS 17.0, *)
struct BagPackEntityQuery: EntityQuery {
    @IntentParameterDependency<AddToBagIntent>(\.$bag)
    var addIntent

    func entities(for identifiers: [String]) async throws -> [BagPackEntity] {
        let all = BagPackEntity.of(bagId: nil)
        return identifiers.compactMap { id in all.first { $0.id == id } }
    }

    func suggestedEntities() async throws -> [BagPackEntity] {
        BagPackEntity.of(bagId: addIntent?.bag.id)
    }
}

@available(iOS 17.0, *)
struct AddToBagIntent: AppIntent {
    static let title: LocalizedStringResource = "가방에 추가"
    static let description = IntentDescription("앱을 열지 않고 고른 가방에 아이템을 넣어요. 팩을 비워 두면 미분류에, 여러 줄이면 줄마다 하나씩 들어가요")
    #if PIB_WIDGET
    static let isDiscoverable = false
    #else
    static let isDiscoverable = true
    #endif
    static let openAppWhenRun = false

    @Parameter(title: "가방", requestValueDialog: IntentDialog("어느 가방에 넣을까요?"))
    var bag: BagEntity

    @Parameter(title: "팩", description: "비워 두면 미분류에 넣어요")
    var pack: BagPackEntity?

    @Parameter(title: "내용", requestValueDialog: IntentDialog("넣을 내용을 적어 주세요"))
    var text: String

    static var parameterSummary: some ParameterSummary {
        Summary("\(\.$bag)의 \(\.$pack)에 \(\.$text) 넣기")
    }

    init() {}

    func perform() async throws -> some IntentResult & ProvidesDialog {
        // 다른 가방의 팩을 골랐으면 미분류로
        let packId = pack.flatMap { $0.bagId == bag.id ? $0.packId : nil }
        let result = try await PIBAPI.addItem(bagId: bag.id, packId: packId, text: text)
        // 위젯에도 바로 보이게
        try? await PIBAPI.refreshSummary()
        PIBWidgets.reload()
        let count = result.added > 1 ? "\(result.added)개 " : ""
        return .result(dialog: "\(bag.name) · \(result.packName)에 \(count)넣었어요")
    }
}

// ---- Siri · Spotlight 검색(1.6, 2026-10-12) ---------------------------------------------
// 가방 · 가방 속 팩 · 보관함 팩을 기기 검색 색인에 넣는다(IndexedEntity, iOS 18 이상). 색인은 앱 프로세스에서만(AppDelegate PIBSpotlight).
// 목록은 App Group 요약 기준 - 개인 잠금으로 잠근 가방 · 팩 · 보관함 팩은 요약에서 이미 빠져 있다(lib/nativeSummary.ts).
// 보관함 팩은 앱이 열려 있을 때 웹이 넘긴 목록(PIBSummary.library)만 쓴다(A안 - 서버 읽기 비용 없음).
// 결과를 누르면 열기 인텐트(AppDelegate의 Open*Intent)가 packinbag:// 주소로 앱을 연다 → 웹 bagReminders.onBagNotificationTap

@available(iOS 17.0, *)
struct LibraryPackEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "보관함 팩"
    static let defaultQuery = LibraryPackEntityQuery()

    let id: String
    let name: String
    var detail: String = ""

    var displayRepresentation: DisplayRepresentation {
        detail.isEmpty ? DisplayRepresentation(title: "\(name)") : DisplayRepresentation(title: "\(name)", subtitle: "\(detail)")
    }

    static func all() -> [LibraryPackEntity] {
        (PIBStore.summary()?.library ?? []).map { p in
            let detail = p.kind == "note" ? "보관함 · 메모" : "보관함 · 아이템 \(p.count ?? 0)개"
            return LibraryPackEntity(id: p.id, name: p.name, detail: detail)
        }
    }
}

@available(iOS 17.0, *)
struct LibraryPackEntityQuery: EntityStringQuery {
    func entities(for identifiers: [String]) async throws -> [LibraryPackEntity] {
        let all = LibraryPackEntity.all()
        return identifiers.compactMap { id in all.first { $0.id == id } }
    }

    func entities(matching string: String) async throws -> [LibraryPackEntity] {
        LibraryPackEntity.all().filter { $0.name.localizedCaseInsensitiveContains(string) }
    }

    func suggestedEntities() async throws -> [LibraryPackEntity] {
        LibraryPackEntity.all()
    }
}

@available(iOS 18.0, *)
extension BagEntity: IndexedEntity {}

@available(iOS 18.0, *)
extension BagPackEntity: IndexedEntity {}

@available(iOS 18.0, *)
extension LibraryPackEntity: IndexedEntity {}

enum PIBLinks {
    static func bag(_ bagId: String, packId: String? = nil) -> URL? {
        guard let packId, !packId.isEmpty else { return URL(string: "packinbag://bag/\(bagId)") }
        return URL(string: "packinbag://bag/\(bagId)?pack=\(packId)")
    }

    static func library(_ packId: String) -> URL? {
        URL(string: "packinbag://library/\(packId)")
    }
}
