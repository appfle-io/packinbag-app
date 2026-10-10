// 홈 화면 위젯(작게 · 중간 · 크게) + 잠금화면 위젯(2026-10-10).
// - 팩 하나의 체크 아이템을 보여 준다. 누르면 체크 · 해제(ToggleItemIntent), 챙긴 것은 취소선 + 맨 아래
// - 앱이 열려 있으면 앱이 바로 새로 그리게 하고, 아니면 15분 넘게 지난 요약은 서버에서 다시 받는다(20분마다 다시 그림)
import WidgetKit
import SwiftUI
import AppIntents

struct PackEntry: TimelineEntry {
    let date: Date
    let configuration: ConfigurationAppIntent
    let bag: PIBBag?
    let pack: PIBPack?
    let signedIn: Bool
}

struct Provider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> PackEntry {
        PackEntry(date: Date(), configuration: ConfigurationAppIntent(), bag: Sample.bag, pack: Sample.pack, signedIn: true)
    }

    func snapshot(for configuration: ConfigurationAppIntent, in context: Context) async -> PackEntry {
        let entry = makeEntry(configuration)
        // 위젯 고르는 화면(미리 보기)에서 아직 데이터가 없으면 예시로
        if context.isPreview && entry.pack == nil {
            return PackEntry(date: Date(), configuration: configuration, bag: Sample.bag, pack: Sample.pack, signedIn: true)
        }
        return entry
    }

    func timeline(for configuration: ConfigurationAppIntent, in context: Context) async -> Timeline<PackEntry> {
        if PIBStore.token != nil && PIBStore.summaryAge > PIB.staleAfter {
            try? await PIBAPI.refreshSummary()
        }
        return Timeline(entries: [makeEntry(configuration)], policy: .after(Date().addingTimeInterval(20 * 60)))
    }

    private func makeEntry(_ configuration: ConfigurationAppIntent) -> PackEntry {
        let signedIn = PIBStore.token != nil
        var found: (bag: PIBBag, pack: PIBPack)?
        if let picked = configuration.pack {
            found = PIBStore.pack(bagId: picked.bagId, packId: picked.packId)
        } else if let bag = PIBStore.summary()?.bags.first(where: { !$0.packs.isEmpty }), let pack = bag.packs.first {
            found = (bag, pack)
        }
        return PackEntry(date: Date(), configuration: configuration, bag: found?.bag, pack: found?.pack, signedIn: signedIn)
    }
}

enum Sample {
    static let pack = PIBPack(id: "sample", name: "출근 가방", items: [
        PIBItem(id: "1", text: "사원증", checked: false),
        PIBItem(id: "2", text: "노트북 충전기", checked: false),
        PIBItem(id: "3", text: "텀블러", checked: false),
        PIBItem(id: "4", text: "이어폰", checked: true),
    ])
    static let bag = PIBBag(id: "sample", name: "평일", travelDate: nil, packs: [pack])
}

// ---- 홈 화면 위젯 ----------------------------------------------------------------

struct PackWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var systemScheme
    let entry: PackEntry

    private var style: PIBStyle {
        PIBStyle(theme: entry.configuration.theme.rawValue, font: entry.configuration.font.rawValue, size: entry.configuration.textSize.rawValue)
    }

    private var limit: Int {
        switch family {
        case .systemSmall: return 3
        case .systemMedium: return 4
        default: return 11
        }
    }

    var body: some View {
        let scheme = style.scheme(systemScheme)
        let c = PIBPalette.of(scheme)
        content(c)
            .environment(\.colorScheme, scheme)
            .containerBackground(c.background, for: .widget)
    }

    @ViewBuilder
    private func content(_ c: PIBPalette) -> some View {
        if !entry.signedIn {
            message("팩인백 앱에서 로그인하면 여기에 팩이 보여요", c)
        } else if let bag = entry.bag, let pack = entry.pack {
            let items = pack.items.filter { !$0.checked } + pack.items.filter { $0.checked }
            let done = pack.items.filter { $0.checked }.count
            VStack(alignment: .leading, spacing: family == .systemSmall ? 4 : 6) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(pack.name).font(style.font(15, bold: true)).foregroundStyle(c.ink).lineLimit(1)
                    Spacer(minLength: 4)
                    Text("\(done)/\(pack.items.count)").font(style.font(12, bold: true)).foregroundStyle(c.brand)
                }
                if family != .systemSmall {
                    Text([bag.name, pibDDay(bag.travelDate)].compactMap { $0 }.joined(separator: " · "))
                        .font(style.font(11)).foregroundStyle(c.sub).lineLimit(1)
                }
                if done == pack.items.count && !pack.items.isEmpty {
                    Spacer(minLength: 0)
                    Text("다 챙겼어요").font(style.font(14, bold: true)).foregroundStyle(c.brand)
                    Spacer(minLength: 0)
                } else {
                    ForEach(items.prefix(limit), id: \.id) { item in
                        Button(intent: ToggleItemIntent(bagId: bag.id, packId: pack.id, itemId: item.id)) {
                            ItemRow(item: item, style: style, c: c)
                        }
                        .buttonStyle(.plain)
                    }
                    if items.count > limit {
                        Text("외 \(items.count - limit)개").font(style.font(11)).foregroundStyle(c.sub)
                    }
                    Spacer(minLength: 0)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        } else {
            message("길게 눌러 \"위젯 편집\"에서 팩을 골라 주세요", c)
        }
    }

    private func message(_ text: String, _ c: PIBPalette) -> some View {
        Text(text)
            .font(style.font(13))
            .foregroundStyle(c.sub)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct ItemRow: View {
    let item: PIBItem
    let style: PIBStyle
    let c: PIBPalette

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: item.checked ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 16 * style.scale, weight: .medium))
                .foregroundStyle(item.checked ? c.brand : c.sub)
            Text(item.text)
                .font(style.font(14))
                .strikethrough(item.checked, color: c.sub)
                .foregroundStyle(item.checked ? c.sub : c.ink)
                .lineLimit(1)
            Spacer(minLength: 0)
        }
        .contentShape(Rectangle())
    }
}

struct PackInBagWidget: Widget {
    let kind: String = "PackInBagWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: ConfigurationAppIntent.self, provider: Provider()) { entry in
            PackWidgetView(entry: entry)
        }
        .configurationDisplayName("팩 체크리스트")
        .description("팩 하나를 골라 바로 체크해요. 챙긴 것은 아래로 내려가요.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// ---- 잠금화면 위젯 --------------------------------------------------------------

struct LockWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: PackEntry

    var body: some View {
        content.containerBackground(.clear, for: .widget)
    }

    @ViewBuilder
    private var content: some View {
        if let bag = entry.bag, let pack = entry.pack {
            let total = pack.items.count
            let done = pack.items.filter { $0.checked }.count
            let left = total - done
            switch family {
            case .accessoryCircular:
                Gauge(value: Double(done), in: 0...Double(max(total, 1))) {
                    Image(systemName: "bag")
                } currentValueLabel: {
                    Text("\(left)")
                }
                .gaugeStyle(.accessoryCircularCapacity)
            case .accessoryInline:
                Text([pack.name, left == 0 ? "다 챙김" : "남은 \(left)개", pibDDay(bag.travelDate)].compactMap { $0 }.joined(separator: " · "))
            default:
                VStack(alignment: .leading, spacing: 1) {
                    Text(pack.name).font(.headline).lineLimit(1)
                    Text([left == 0 ? "다 챙겼어요" : "남은 \(left)개", pibDDay(bag.travelDate)].compactMap { $0 }.joined(separator: " · "))
                        .font(.caption)
                    if let next = pack.items.first(where: { !$0.checked }) {
                        Text(next.text).font(.caption).lineLimit(1).foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        } else {
            Text(entry.signedIn ? "팩을 골라 주세요" : "팩인백 로그인").font(.caption)
        }
    }
}

struct PackInBagLockWidget: Widget {
    let kind: String = "PackInBagLockWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: ConfigurationAppIntent.self, provider: Provider()) { entry in
            LockWidgetView(entry: entry)
        }
        .configurationDisplayName("팩 남은 개수")
        .description("잠금화면에서 남은 개수와 D-Day를 봐요.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

#Preview(as: .systemMedium) {
    PackInBagWidget()
} timeline: {
    PackEntry(date: .now, configuration: ConfigurationAppIntent(), bag: Sample.bag, pack: Sample.pack, signedIn: true)
}
