// 팩인백 위젯 확장에 들어 있는 것(2026-10-10): 홈 화면 팩 위젯 · 잠금화면 위젯 · 잠금화면 실시간 현황
// 1.7(2026-10-18): 홈 화면 "가방 바로가기"(북마크 위젯, 작게) 추가
import WidgetKit
import SwiftUI

@main
struct PackInBagWidgetBundle: WidgetBundle {
    var body: some Widget {
        PackInBagWidget()
        PackInBagBookmarkWidget()
        PackInBagLockWidget()
        PackInBagWidgetLiveActivity()
    }
}
