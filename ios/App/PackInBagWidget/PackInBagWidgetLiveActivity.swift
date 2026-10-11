// 잠금화면 실시간 현황 · 다이내믹 아일랜드(2026-10-10). 데이터 · 시작은 Shared/PIBActivity.swift.
// 잠금화면에서 바로 체크(ToggleItemLiveIntent - 앱 프로세스에서 서버에 저장하고 이 화면도 갱신).
// 여백: 잠금화면 카드 안쪽 좌우 18 · 위아래 14, 줄 사이 8
// 높이(10/11): iOS가 잠금화면 실시간 현황을 최대 160pt로 자른다(넘치면 위아래가 잘림). 예전에는 아이템 4줄을 세로로 쌓아 잘렸다 →
//   아이템은 2열 2줄(최대 4개), "외 N개"와 새로고침 시각은 맨 아래 한 줄에
// 다이내믹 아일랜드 · 잠금화면을 누르면 그 가방이 열린다(packinbag://bag/{id}, 10/11). 잠금화면 아래 줄에 받은 시각 + ↻
import ActivityKit
import WidgetKit
import SwiftUI
import AppIntents

struct PackLockScreenView: View {
    @Environment(\.colorScheme) private var systemScheme
    let attributes: PackActivityAttributes
    let state: PackActivityAttributes.ContentState

    // 160pt 안에 들어가는 개수(2열 × 2줄)
    private static let maxShown = 4

    var body: some View {
        let style = PIBStyle(theme: attributes.theme, font: attributes.font, size: attributes.size)
        // 직접 고른 배경색(10/11): 밝기로 글자색(라이트/다크)을 정한다
        let custom = attributes.theme == "custom" ? PIBCustomColor(hex: attributes.bgColor) : nil
        let scheme = custom.map { $0.isLight ? ColorScheme.light : .dark } ?? style.scheme(systemScheme)
        let c = PIBPalette.of(scheme)
        let background = custom.map { $0.color.opacity(attributes.bgAlpha ?? 1) } ?? c.background
        let left = state.total - state.done
        let shown = Array(state.items.prefix(Self.maxShown))
        let hidden = max(0, state.total - shown.count)
        let synced = state.syncedAt.map { pibSyncedLabel(Date(timeIntervalSince1970: $0)) }
        let footer = [hidden > 0 ? "외 \(hidden)개" : nil, synced].compactMap { $0 }.joined(separator: " · ")
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(state.packName).font(style.font(15, bold: true)).foregroundStyle(c.ink).lineLimit(1)
                Text(state.bagName).font(style.font(11)).foregroundStyle(c.sub).lineLimit(1)
                Spacer(minLength: 8)
                Text(left == 0 ? "다 챙겼어요" : "\(state.done)/\(state.total)")
                    .font(style.font(13, bold: true)).foregroundStyle(c.brand)
            }
            ProgressView(value: Double(state.done), total: Double(max(state.total, 1)))
                .tint(c.brand)
            // 아이템 2열(왼쪽→오른쪽, 위→아래 - 홈 위젯 크게와 같은 순서)
            VStack(alignment: .leading, spacing: 6) {
                ForEach(0..<((shown.count + 1) / 2), id: \.self) { r in
                    HStack(spacing: 12) {
                        itemButton(shown[r * 2], style: style, c: c)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        if r * 2 + 1 < shown.count {
                            itemButton(shown[r * 2 + 1], style: style, c: c)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        } else {
                            Color.clear.frame(maxWidth: .infinity, maxHeight: 1)
                        }
                    }
                }
            }
            // "외 N개 · 14시 05분에 새로고침" + ↻. 다른 멤버 체크는 서버가 바로 반영하고, 놓친 게 있으면 ↻
            HStack(spacing: 4) {
                Text(footer.isEmpty ? "새로고침해 주세요" : footer)
                    .font(style.font(11)).foregroundStyle(c.sub).lineLimit(1)
                    .minimumScaleFactor(0.75)
                Spacer(minLength: 4)
                Button(intent: RefreshLiveIntent()) { RefreshIcon(style: style, c: c) }.buttonStyle(.plain)
            }
            .frame(height: 20)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .environment(\.colorScheme, scheme)
        .activityBackgroundTint(background)
        .activitySystemActionForegroundColor(c.ink)
        // 버튼 밖을 누르면 그 가방이 열린다
        .widgetURL(pibBagURL(attributes.bagId))
    }

    private func itemButton(_ item: PIBItem, style: PIBStyle, c: PIBPalette) -> some View {
        // 가방 전체로 띄우면 체크는 아이템의 원래 팩으로
        let packId = state.itemPacks?[item.id] ?? attributes.packId
        return Button(intent: ToggleItemLiveIntent(bagId: attributes.bagId, packId: packId, itemId: item.id)) {
            ItemRow(item: item, style: style, c: c)
        }
        .buttonStyle(.plain)
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
                            Button(intent: ToggleItemLiveIntent(bagId: context.attributes.bagId, packId: context.state.itemPacks?[item.id] ?? context.attributes.packId, itemId: item.id)) {
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
            .widgetURL(pibBagURL(context.attributes.bagId))
        }
    }
}
