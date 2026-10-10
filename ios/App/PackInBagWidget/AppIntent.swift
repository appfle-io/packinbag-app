// 위젯을 길게 눌러 "위젯 편집"에서 고르는 값(2026-10-10): 보여 줄 팩 · 배경 · 글꼴 · 글자 크기.
// 팩 목록은 App Group에 저장된 요약(앱이 넘기거나 서버에서 받은 것)에서 만든다.
import WidgetKit
import AppIntents

struct PackEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "팩"
    static let defaultQuery = PackQuery()

    // "가방id|팩id"
    let id: String
    let bagName: String
    let packName: String

    var bagId: String { String(id.split(separator: "|").first ?? "") }
    var packId: String { String(id.split(separator: "|").last ?? "") }

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(packName)", subtitle: "\(bagName)")
    }

    static func all() -> [PackEntity] {
        (PIBStore.summary()?.bags ?? []).flatMap { bag in
            bag.packs.map { PackEntity(id: "\(bag.id)|\($0.id)", bagName: bag.name, packName: $0.name) }
        }
    }
}

struct PackQuery: EntityQuery {
    func entities(for identifiers: [PackEntity.ID]) async throws -> [PackEntity] {
        let all = PackEntity.all()
        return identifiers.compactMap { id in all.first { $0.id == id } }
    }

    func suggestedEntities() async throws -> [PackEntity] {
        // 저장된 요약이 없으면(위젯을 처음 놓은 경우) 서버에서 한 번 받아 본다
        if PIBStore.summary() == nil, PIBStore.token != nil {
            try? await PIBAPI.refreshSummary()
        }
        return PackEntity.all()
    }

    func defaultResult() async -> PackEntity? {
        PackEntity.all().first
    }
}

struct ConfigurationAppIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "팩 고르기"
    static let description = IntentDescription("위젯에 보여 줄 팩과 모양을 골라요")

    @Parameter(title: "팩")
    var pack: PackEntity?

    @Parameter(title: "배경", default: .system)
    var theme: PIBTheme

    @Parameter(title: "배경 투명도", default: .p100)
    var opacity: PIBOpacity

    @Parameter(title: "글꼴", default: .system)
    var font: PIBFont

    @Parameter(title: "글자 크기", default: .medium)
    var textSize: PIBTextSize
}
