// 팩인백 위젯 확장에 들어 있는 것(2026-10-10): 홈 화면 팩 위젯 · 잠금화면 위젯 · 잠금화면 실시간 현황
import WidgetKit
import SwiftUI

@main
struct PackInBagWidgetBundle: WidgetBundle {
    var body: some Widget {
        PackInBagWidget()
        PackInBagLockWidget()
        PackInBagWidgetLiveActivity()
    }
}
