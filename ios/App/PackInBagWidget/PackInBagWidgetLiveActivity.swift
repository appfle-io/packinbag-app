// 잠금화면 실시간 현황 · 다이내믹 아일랜드(2026-10-10). 데이터 · 시작은 Shared/PIBActivity.swift.
// 잠금화면에서 바로 체크(ToggleItemLiveIntent - 앱 프로세스에서 서버에 저장하고 이 화면도 갱신).
// 여백: 잠금화면 카드 안쪽 좌우 20 · 위아래 18, 줄 사이 10(10/10 - 처음엔 16으로 붙어 보였다)
import ActivityKit
import WidgetKit
import SwiftUI
import AppIntents

struct PackLockScreenView: View {
    @Environment(\.colorScheme) private var systemScheme
    let attributes: PackActivityAttributes
    let state: PackActivityAttributes.ContentState

    var body: some View {
        let style = PIBStyle(theme: attributes.theme, font: attributes.font, size: attributes.size, opacity: attributes.opacity ?? "p100")
        let c = PIBPalette.of(style.scheme(systemScheme))
        let left = state.total - state.done
        let hidden = state.total - state.items.count
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(state.packName).font(style.font(16, bold: true)).foregroundStyle(c.ink).lineLimit(1)
                Text(state.bagName).font(style.font(12)).foregroundStyle(c.sub).lineLimit(1)
                Spacer(minLength: 8)
                Text(left == 0 ? "다 챙겼어요" : "\(state.done)/\(state.total)")
                    .font(style.font(13, bold: true)).foregroundStyle(c.brand)
            }
            ProgressView(value: Double(state.done), total: Double(max(state.total, 1)))
                .tint(c.brand)
                .padding(.bottom, 2)
            VStack(alignment: .leading, spacing: 8) {
                ForEach(state.items, id: \.id) { item in
                    Button(intent: ToggleItemLiveIntent(bagId: attributes.bagId, packId: attributes.packId, itemId: item.id)) {
                        ItemRow(item: item, style: style, c: c)
                    }
                    .buttonStyle(.plain)
                }
            }
            if hidden > 0 {
                Text("외 \(hidden)개").font(style.font(11)).foregroundStyle(c.sub)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 18)
        .environment(\.colorScheme, style.scheme(systemScheme))
        // 투명도를 낮추면 잠금화면 배경이 흐리게 비친다
        .activityBackgroundTint(c.background.opacity(style.backgroundOpacity))
        .activitySystemActionForegroundColor(c.ink)
    }
}

struct PackInBagWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PackActivityAttributes.self) { context in
            PackLockScreenView(attributes: context.attributes, state: context.state)
        } dynamicIsland: { context in
            // 다이내믹 아일랜드는 늘 검은 바탕이라 글자색만 다크 기준
            let style = PIBStyle(theme: "dark", font: context.attributes.font, size: context.attributes.size)
            let c = PIBPalette.of(.dark)
            let left = context.state.total - context.state.done
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.packName).font(style.font(15, bold: true)).foregroundStyle(c.ink).lineLimit(1)
                        .padding(.leading, 6)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.done)/\(context.state.total)").font(style.font(14, bold: true)).foregroundStyle(c.brand)
                        .padding(.trailing, 6)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(context.state.items.prefix(3), id: \.id) { item in
                            Button(intent: ToggleItemLiveIntent(bagId: context.attributes.bagId, packId: context.attributes.packId, itemId: item.id)) {
                                ItemRow(item: item, style: style, c: c)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 6)
                    .padding(.top, 4)
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
