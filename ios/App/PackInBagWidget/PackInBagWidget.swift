// 홈 화면 위젯(작게 · 중간 · 크게) + 잠금화면 위젯(2026-10-10, 10-11 새로고침 버튼).
// - 팩 하나의 체크 아이템을 보여 준다. 누르면 바로 체크 · 해제(ToggleItemIntent, 서버는 뒤에서), 챙긴 것은 취소선 + 맨 아래
// - 줄 수는 위젯 높이와 글자 크기로 정한다(크기마다 고정 개수가 아님). 크게(large)는 2열
// - 새로고침: ↻ 버튼 · 단축어 · 앱이 열려 있을 때 · 다른 멤버 변경 푸시 + 안전망으로 30분마다(30분 넘게 지난 요약만 서버에서)
//   아래 줄에 마지막으로 받은 시각을 "14시 05분에 새로고침"처럼 보여 준다(10/11 - "N분 N초 전"에서 바꿈). 자정에는 D-Day · 날짜를 다시 그린다
// - 위젯을 누르면(버튼 밖) 그 가방이 열린다(packinbag://bag/{id})
import WidgetKit
import SwiftUI
import AppIntents

struct PackEntry: TimelineEntry {
    let date: Date
    let configuration: ConfigurationAppIntent
    let bag: PIBBag?
    let pack: PIBPack?
    let signedIn: Bool
    var syncedAt: Date? = nil
    // 가방 전체(10/11): 팩을 이어 붙인 가짜 팩을 보여 주고, 체크는 아이템마다 원래 팩 id로 보낸다
    var wholeBag = false
    var itemPacks: [String: String] = [:]
}

func pibBagURL(_ bagId: String) -> URL? {
    URL(string: "packinbag://bag/\(bagId)")
}

// 마지막으로 받은 시각(10/11): 오늘이면 "14시 05분에 새로고침", 다른 날이면 "10/9 14시 05분"
func pibSyncedLabel(_ date: Date, now: Date = Date()) -> String {
    let cal = Calendar.current
    let c = cal.dateComponents([.month, .day, .hour, .minute], from: date)
    let time = "\(c.hour ?? 0)시 " + String(format: "%02d분", c.minute ?? 0)
    if cal.isDate(date, inSameDayAs: now) { return "\(time)에 새로고침" }
    return "\(c.month ?? 0)/\(c.day ?? 0) \(time)"
}

// 가방 전체 → 팩 하나처럼. 요약의 팩 순서(미분류 먼저) 그대로 아이템을 잇는다
func pibWholeBag(_ bag: PIBBag) -> (pack: PIBPack, itemPacks: [String: String]) {
    var map: [String: String] = [:]
    var items: [PIBItem] = []
    for p in bag.packs {
        for item in p.items where map[item.id] == nil {
            map[item.id] = p.id
            items.append(item)
        }
    }
    return (PIBPack(id: WidgetPackEntity.wholeBag, name: bag.name, items: items), map)
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
        if !PIBStore.pending().isEmpty {
            // 방금 위젯에서 누른 체크: 화면은 바로 그리고 서버는 뒤에서(기다리면 다시 느려진다)
            Task { if await PIBSync.flush() { PIBWidgets.reload() } }
        } else if PIBStore.token != nil && PIBStore.summaryAge > PIB.staleAfter {
            // 안전망(10/11): 다른 기기에서 고친 내 가방 · 놓친 조용한 푸시를 여기서 따라잡는다
            try? await PIBAPI.refreshSummary()
        }
        // 30분마다 다시 그린다(iOS 위젯 갱신 한도 안). 자정이 더 가까우면 자정에(D-Day 글자)
        let midnight = Calendar.current.nextDate(after: Date(), matching: DateComponents(hour: 0, minute: 0, second: 5), matchingPolicy: .nextTime)
            ?? Date().addingTimeInterval(24 * 3600)
        let next = min(midnight, Date().addingTimeInterval(PIB.staleAfter))
        return Timeline(entries: [makeEntry(configuration)], policy: .after(next))
    }

    private func makeEntry(_ configuration: ConfigurationAppIntent) -> PackEntry {
        let signedIn = PIBStore.token != nil
        var found: (bag: PIBBag, pack: PIBPack)?
        var itemPacks: [String: String] = [:]
        var whole = false
        if let bagId = configuration.bag?.id {
            // 가방 → 팩(10/11). 팩을 비웠거나 "가방 전체"거나, 가방을 바꾼 뒤 예전 가방의 팩이 남아 있거나,
            // 그 팩이 지워졌으면 가방 전체로 보여 준다
            if let bag = PIBStore.bag(bagId) {
                let picked = configuration.pack
                if let picked, picked.bagId == bagId, !picked.isWholeBag,
                   let pack = bag.packs.first(where: { $0.id == picked.packId }) {
                    found = (bag, pack)
                } else {
                    let joined = pibWholeBag(bag)
                    found = (bag, joined.pack)
                    itemPacks = joined.itemPacks
                    whole = true
                }
            }
        } else if let bag = PIBStore.summary()?.bags.first(where: { !$0.packs.isEmpty }), let pack = bag.packs.first {
            found = (bag, pack)
        }
        return PackEntry(
            date: Date(), configuration: configuration, bag: found?.bag, pack: found?.pack, signedIn: signedIn,
            syncedAt: PIBStore.summarySavedAt, wholeBag: whole, itemPacks: itemPacks
        )
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
        PIBStyle(
            theme: entry.configuration.theme.rawValue,
            font: entry.configuration.font.rawValue,
            size: entry.configuration.textSize.rawValue
        )
    }

    private var rowSpacing: CGFloat { family == .systemSmall ? 4 : 6 }

    var body: some View {
        let scheme = style.scheme(systemScheme)
        let c = PIBPalette.of(scheme)
        content(c)
            .environment(\.colorScheme, scheme)
            .containerBackground(c.background, for: .widget)
    }

    // 위젯 높이와 글자 크기로 들어갈 줄 수를 정한다. 다 못 보여 주면 마지막 한 줄은 "외 N개"에 쓴다.
    // 맨 아래 새로고침 줄(시각 + ↻) 높이도 빼고 계산한다
    private func rowLimit(height: CGFloat, itemCount: Int) -> Int {
        let s = style.scale
        let rowH = 14 * s * 1.3 + rowSpacing
        var header = 15 * s * 1.3 + rowSpacing
        if family != .systemSmall { header += 11 * s * 1.3 + rowSpacing }
        header += footerHeight + rowSpacing
        let fits = max(1, Int((height - header + rowSpacing) / rowH))
        return itemCount > fits ? max(1, fits - 1) : fits
    }

    private var footerHeight: CGFloat { max(20, 11 * style.scale * 1.3) }

    @ViewBuilder
    private func content(_ c: PIBPalette) -> some View {
        if !entry.signedIn {
            message("팩인백 앱에서 로그인하면 여기에 팩이 보여요", c)
        } else if let bag = entry.bag, let pack = entry.pack {
            GeometryReader { geo in
                packView(bag: bag, pack: pack, size: geo.size, c: c)
            }
        } else {
            message("길게 눌러 \"위젯 편집\"에서 가방을 골라 주세요", c)
        }
    }

    private func packView(bag: PIBBag, pack: PIBPack, size: CGSize, c: PIBPalette) -> some View {
        let left = pack.items.filter { !$0.checked }
        let items = left + pack.items.filter { $0.checked }
        let done = pack.items.count - left.count
        // 크게(large)는 2열(10/11). 앱 가방 화면처럼 왼쪽→오른쪽, 위→아래
        let columns = family == .systemLarge ? 2 : 1
        let neededRows = (items.count + columns - 1) / columns
        let rows = rowLimit(height: size.height, itemCount: neededRows)
        let shown = Array(items.prefix(rows * columns))
        let hidden = items.count - shown.count
        return VStack(alignment: .leading, spacing: rowSpacing) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(pack.name).font(style.font(15, bold: true)).foregroundStyle(c.ink).lineLimit(1)
                Spacer(minLength: 4)
                Text("\(done)/\(pack.items.count)").font(style.font(12, bold: true)).foregroundStyle(c.brand)
            }
            if family != .systemSmall {
                Text([entry.wholeBag ? "가방 전체" : bag.name, pibDDay(bag.travelDate)].compactMap { $0 }.joined(separator: " · "))
                    .font(style.font(11)).foregroundStyle(c.sub).lineLimit(1)
            }
            if columns == 1 {
                ForEach(shown, id: \.id) { item in itemButton(item, bag: bag, pack: pack, c: c) }
            } else {
                ForEach(0..<((shown.count + 1) / 2), id: \.self) { r in
                    HStack(spacing: 12) {
                        itemButton(shown[r * 2], bag: bag, pack: pack, c: c)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        if r * 2 + 1 < shown.count {
                            itemButton(shown[r * 2 + 1], bag: bag, pack: pack, c: c)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        } else {
                            Color.clear.frame(maxWidth: .infinity, maxHeight: 1)
                        }
                    }
                }
            }
            if hidden > 0 {
                Text(left.isEmpty ? "다 챙겼어요 · 외 \(hidden)개" : "외 \(hidden)개")
                    .font(style.font(11)).foregroundStyle(left.isEmpty ? c.brand : c.sub)
            }
            Spacer(minLength: 0)
            RefreshFooter(syncedAt: entry.syncedAt, style: style, c: c, height: footerHeight) {
                Button(intent: RefreshWidgetIntent()) { RefreshIcon(style: style, c: c) }.buttonStyle(.plain)
            }
        }
        .frame(width: size.width, height: size.height, alignment: .topLeading)
        .widgetURL(pibBagURL(bag.id))
    }

    private func itemButton(_ item: PIBItem, bag: PIBBag, pack: PIBPack, c: PIBPalette) -> some View {
        Button(intent: ToggleItemIntent(bagId: bag.id, packId: entry.itemPacks[item.id] ?? pack.id, itemId: item.id)) {
            ItemRow(item: item, style: style, c: c)
        }
        .buttonStyle(.plain)
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
                .foregroundStyle(item.checked ? c.sub : c.ink)
                .lineLimit(1)
                // 위젯에서는 strikethrough가 그려지지 않는 경우가 있어 줄을 직접 긋는다(10/10)
                .overlay {
                    if item.checked {
                        Rectangle().fill(c.sub).frame(height: 1)
                    }
                }
            Spacer(minLength: 0)
        }
        .contentShape(Rectangle())
    }
}

// 맨 아래 새로고침 줄(홈 위젯 · 잠금화면 실시간 현황 공용): "14시 05분에 새로고침" + ↻ 버튼.
// 시각은 고정 글자라 저절로 바뀌지 않는다(위젯은 30분 · 자정마다 다시 그려 "오늘/다른 날"이 맞춰짐). 버튼은 부르는 쪽이 넣는다
struct RefreshFooter<Trailing: View>: View {
    let syncedAt: Date?
    let style: PIBStyle
    let c: PIBPalette
    var height: CGFloat = 20
    @ViewBuilder let trailing: () -> Trailing

    var body: some View {
        HStack(spacing: 4) {
            if let syncedAt {
                Text(pibSyncedLabel(syncedAt))
                    .font(style.font(11)).foregroundStyle(c.sub).lineLimit(1)
                    // 작게 위젯 · 큰 글자에서도 한 줄에(↻ 자리를 비켜서)
                    .minimumScaleFactor(0.75)
            } else {
                Text("새로고침해 주세요").font(style.font(11)).foregroundStyle(c.sub).lineLimit(1)
            }
            Spacer(minLength: 4)
            trailing()
        }
        .frame(height: height)
    }
}

struct RefreshIcon: View {
    let style: PIBStyle
    let c: PIBPalette

    var body: some View {
        Image(systemName: "arrow.clockwise")
            .font(.system(size: 13 * style.scale, weight: .semibold))
            .foregroundStyle(c.sub)
            // 손가락으로 누르기 쉽게 누르는 자리는 넓게
            .frame(width: 28, height: 22, alignment: .trailing)
            .contentShape(Rectangle())
            .accessibilityLabel("새로고침")
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
        content
            .containerBackground(.clear, for: .widget)
            .widgetURL(entry.bag.flatMap { pibBagURL($0.id) })
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
                    } else if let syncedAt = entry.syncedAt {
                        Text(pibSyncedLabel(syncedAt, now: entry.date)).font(.caption2).lineLimit(1).foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        } else {
            Text(entry.signedIn ? "가방을 골라 주세요" : "팩인백 로그인").font(.caption)
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
