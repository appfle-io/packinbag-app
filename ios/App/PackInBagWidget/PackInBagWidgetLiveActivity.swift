// 잠금화면 실시간 현황 · 다이내믹 아일랜드(2026-10-10). 데이터 · 시작은 Shared/PIBActivity.swift.
// 잠금화면에서 바로 체크(ToggleItemIntent - 앱 프로세스에서 서버에 저장하고 이 화면도 갱신).
import ActivityKit
import WidgetKit
import SwiftUI
import AppIntents

struct PackLockScreenView: View {
    @Environment(\.colorScheme) private var systemScheme
    let attributes: PackActivityAttributes
    let state: PackActivityAttributes.ContentState

    var body: some View {
        let style = PIBStyle(theme: attributes.theme, font: attributes.font, size: attributes.size)
        let c = PIBPalette.of(style.scheme(systemScheme))
        let left = state.total - state.done
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(state.packName).font(style.font(16, bold: true)).foregroundStyle(c.ink).lineLimit(1)
                Text(state.bagName).font(style.font(12)).foregroundStyle(c.sub).lineLimit(1)
                Spacer(minLength: 4)
                Text(left == 0 ? "다 챙겼어요" : "\(state.done)/\(state.total)")
                    .font(style.font(13, bold: true)).foregroundStyle(c.brand)
            }
            ProgressView(value: Double(state.done), total: Double(max(state.total, 1)))
                .tint(c.brand)
            ForEach(state.items, id: \.id) { item in
                Button(intent: ToggleItemLiveIntent(bagId: attributes.bagId, packId: attributes.packId, itemId: item.id)) {
                    ItemRow(item: item, style: style, c: c)
                }
                .buttonStyle(.plain)
            }
            let hidden = state.total - state.items.count
            if hidden > 0 {
                Text("외 \(hidden)개").font(style.font(11)).foregroundStyle(c.sub)
            }
        }
        .padding(16)
        .environment(\.colorScheme, style.scheme(systemScheme))
        .activityBackgroundTint(c.background)
        .activitySystemActionForegroundColor(c.ink)
    }
}

struct PackInBagWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PackActivityAttributes.self) { context in
            PackLockScreenView(attributes: context.attributes, state: context.state)
        } dynamicIsland: { context in
            let style = PIBStyle(theme: "dark", font: context.attributes.font, size: context.attributes.size)
            let c = PIBPalette.of(.dark)
            let left = context.state.total - context.state.done
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.packName).font(style.font(15, bold: true)).foregroundStyle(c.ink).lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.done)/\(context.state.total)").font(style.font(14, bold: true)).foregroundStyle(c.brand)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(context.state.items.prefix(3), id: \.id) { item in
                            Button(intent: ToggleItemLiveIntent(bagId: context.attributes.bagId, packId: context.attributes.packId, itemId: item.id)) {
                                ItemRow(item: item, style: style, c: c)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: "bag.fill").foregroundStyle(c.brand)
            } compactTrailing: {
                Text(left == 0 ? "완료" : "\(left)").font(.system(size: 13, weight: .semibold)).foregroundStyle(c.ink)
            } minimal: {
                Text("\(left)").font(.system(size: 12, weight: .semibold)).foregroundStyle(c.brand)
            }
        }
    }
}
