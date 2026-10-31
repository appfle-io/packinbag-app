// 위젯을 길게 눌러 "위젯 편집"에서 고르는 값(2026-10-10): 가방 → 팩(또는 가방 전체) · 배경 · 글꼴 · 글자 크기 · 열 수(1.6) · 완료된 항목 보이기(1.6, 10/13).
// 10/11: 예전에는 "팩 또는 가방 전체" 한 목록에 모든 가방의 팩이 다 나와 너무 길었다 → 가방을 먼저 고르고(BagEntity, 묶음 + 검색)
// 팩 목록에는 그 가방의 팩만 보인다(IntentParameterDependency). 팩을 비워 두면 가방 전체.
// 가방을 바꿨는데 팩이 예전 가방 것이면 가방 전체로 보여 준다(편집 화면은 iOS가 그려서 자동으로 비울 수 없음).
// 목록은 App Group에 저장된 요약(앱이 넘기거나 서버에서 받은 것)에서 만든다. 보관함 가방은 요약에 없다.
import WidgetKit
import AppIntents

struct WidgetPackEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "팩"
    static let defaultQuery = WidgetPackQuery()

    // "가방id|팩id", 가방 전체는 "가방id|*"
    let id: String
    let name: String
    let detail: String

    var bagId: String { String(id.split(separator: "|").first ?? "") }
    var packId: String { String(id.split(separator: "|").last ?? "") }

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)", subtitle: "\(detail)")
    }

    // "가방 전체"를 고른 위젯의 팩 자리 값
    static let wholeBag = "*"
    var isWholeBag: Bool { packId == WidgetPackEntity.wholeBag }

    // 그 가방의 팩 목록. 맨 위는 "가방 전체"(팩 순서대로 · 미분류 먼저 이어 보여 줌)
    static func of(bagId: String?) -> [WidgetPackEntity] {
        (PIBStore.summary()?.bags ?? [])
            .filter { bagId == nil || $0.id == bagId }
            .flatMap { bag -> [WidgetPackEntity] in
                let total = bag.packs.reduce(0) { $0 + $1.items.count }
                let whole = WidgetPackEntity(
                    id: "\(bag.id)|\(wholeBag)", name: "가방 전체",
                    detail: "팩 \(bag.packs.count)개 · 아이템 \(total)개"
                )
                return [whole] + bag.packs.map { p in
                    let done = p.items.filter { $0.checked }.count
                    return WidgetPackEntity(id: "\(bag.id)|\(p.id)", name: p.name, detail: "\(done)/\(p.items.count) 챙김")
                }
            }
    }
}

struct WidgetPackQuery: EntityQuery {
    @IntentParameterDependency<ConfigurationAppIntent>(\.$bag)
    var config

    func entities(for identifiers: [WidgetPackEntity.ID]) async throws -> [WidgetPackEntity] {
        let all = WidgetPackEntity.of(bagId: nil)
        return identifiers.compactMap { id in all.first { $0.id == id } }
    }

    func suggestedEntities() async throws -> [WidgetPackEntity] {
        if PIBStore.summary() == nil, PIBStore.token != nil {
            try? await PIBAPI.refreshSummary()
        }
        // 가방을 아직 안 골랐으면 위젯이 보여 주는 가방(맨 앞 가방)의 팩.
        // IntentParameterDependency는 값이 있을 때만 config를 주고, 그때 bag은 이미 풀린 값이다(? 불필요)
        let bagId = config?.bag.id ?? PIBStore.summary()?.bags.first?.id
        return WidgetPackEntity.of(bagId: bagId)
    }
}

struct ConfigurationAppIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "팩 고르기"
    static let description = IntentDescription("위젯에 보여 줄 가방과 팩, 모양을 골라요")

    @Parameter(title: "가방")
    var bag: BagEntity?

    @Parameter(title: "팩", description: "비워 두면 가방 전체")
    var pack: WidgetPackEntity?

    @Parameter(title: "배경", description: "배경화면은 앱 설정 > 위젯 꾸미기에서 먼저 맞춰요", default: .system)
    var theme: PIBTheme

    // 1.11(11/1). 배경이 "배경화면"일 때만 쓴다
    @Parameter(title: "배경화면 위치", description: "위젯 왼쪽 위가 있는 칸", default: .tl)
    var wallSlot: PIBWallSlot

    @Parameter(title: "글꼴", default: .system)
    var font: PIBFont

    @Parameter(title: "글자 크기", default: .medium)
    var textSize: PIBTextSize

    // 1.6(10/12). 중간 · 크게만(작게는 1열 고정). 예전에 놓인 위젯은 기본값 2열이 된다
    @Parameter(title: "열 수", description: "작게 위젯은 항상 1열", default: .two)
    var columns: PIBColumns

    // 1.6(10/13). 끄면 챙긴 아이템을 목록에서 뺀다. 예전에 놓인 위젯은 켬(예전과 같음)
    @Parameter(title: "완료된 항목 보이기", default: true)
    var showDone: Bool
}

// ---- 북마크 위젯(가방 바로가기, 1.7 · 2026-10-18) ----------------------------------------------
// 위젯 편집: 가방(위 BagEntity 그대로) + 꾸미기(앱 설정 > 위젯 꾸미기에서 저장한 것 + "기본").
// 꾸미기 목록은 App Group(PIBStyleStore)에서. 지워진 꾸미기를 고른 위젯은 기본 모양으로 그린다
struct WidgetStyleEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "꾸미기"
    static let defaultQuery = WidgetStyleQuery()
    static let plainId = "plain"

    let id: String
    let name: String
    let detail: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)", subtitle: "\(detail)")
    }

    static func all() -> [WidgetStyleEntity] {
        let plain = WidgetStyleEntity(id: plainId, name: "기본", detail: "앱과 같은 바탕")
        return [plain] + PIBStyleStore.all().map { s in
            let kind = s.bg == "photo" ? "사진" : s.bg == "solid" ? "단색" : "기본 바탕"
            return WidgetStyleEntity(id: s.id, name: s.name, detail: kind)
        }
    }
}

struct WidgetStyleQuery: EntityQuery {
    func entities(for identifiers: [WidgetStyleEntity.ID]) async throws -> [WidgetStyleEntity] {
        let all = WidgetStyleEntity.all()
        return identifiers.compactMap { id in all.first { $0.id == id } }
    }

    func suggestedEntities() async throws -> [WidgetStyleEntity] {
        WidgetStyleEntity.all()
    }
}

struct BookmarkConfigIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "가방 바로가기"
    static let description = IntentDescription("누르면 고른 가방이 바로 열려요. 꾸미기는 앱 설정 > 위젯 꾸미기에서 만들어요")

    @Parameter(title: "가방")
    var bag: BagEntity?

    @Parameter(title: "꾸미기", description: "비워 두면 기본")
    var style: WidgetStyleEntity?
}
