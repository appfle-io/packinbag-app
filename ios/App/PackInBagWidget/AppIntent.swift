// 위젯을 길게 눌러 "위젯 편집"에서 고르는 값(2026-10-10): 가방 → 팩(또는 가방 전체) · 배경 · 글꼴 · 글자 크기.
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

    @Parameter(title: "배경", default: .system)
    var theme: PIBTheme

    @Parameter(title: "글꼴", default: .system)
    var font: PIBFont

    @Parameter(title: "글자 크기", default: .medium)
    var textSize: PIBTextSize
}
