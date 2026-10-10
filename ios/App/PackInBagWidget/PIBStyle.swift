// 위젯 · 실시간 현황 꾸미기(배경 · 글꼴 · 글자 크기)와 색(2026-10-10).
// 글꼴 파일(TTF/OTF)은 이 위젯 폴더의 Fonts/에 넣고 Info.plist UIAppFonts에 등록한다. 파일이 없으면 시스템 글꼴로 보인다.
import SwiftUI
import AppIntents

enum PIBTheme: String, AppEnum {
    case system, light, dark
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "배경"
    static let caseDisplayRepresentations: [PIBTheme: DisplayRepresentation] = [
        .system: "시스템", .light: "라이트", .dark: "다크",
    ]
}

enum PIBFont: String, AppEnum {
    case system, pretendard, gmarket, gaegu, d2coding
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "글꼴"
    static let caseDisplayRepresentations: [PIBFont: DisplayRepresentation] = [
        .system: "기본", .pretendard: "프리텐다드", .gmarket: "지마켓 산스", .gaegu: "개구", .d2coding: "D2코딩",
    ]
}

enum PIBTextSize: String, AppEnum {
    case small, medium, large
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "글자 크기"
    static let caseDisplayRepresentations: [PIBTextSize: DisplayRepresentation] = [
        .small: "작게", .medium: "보통", .large: "크게",
    ]
}

struct PIBPalette {
    let background: Color
    let card: Color
    let ink: Color
    let sub: Color
    let line: Color
    let brand: Color

    static func of(_ scheme: ColorScheme) -> PIBPalette {
        scheme == .dark
            ? PIBPalette(
                background: Color(red: 0.086, green: 0.094, blue: 0.090), // #161817
                card: Color(red: 0.13, green: 0.14, blue: 0.135),
                ink: Color(red: 0.94, green: 0.95, blue: 0.94),
                sub: Color(red: 0.62, green: 0.65, blue: 0.63),
                line: Color.white.opacity(0.12),
                brand: Color(red: 0.49, green: 0.74, blue: 0.64)
            )
            : PIBPalette(
                background: .white,
                card: Color(red: 0.925, green: 0.945, blue: 0.933), // #ECF1EE
                ink: Color(red: 0.10, green: 0.11, blue: 0.105),
                sub: Color(red: 0.45, green: 0.48, blue: 0.46),
                line: Color.black.opacity(0.08),
                brand: Color(red: 0.18, green: 0.369, blue: 0.306) // #2E5E4E
            )
    }
}

struct PIBStyle {
    var theme: String
    var font: String
    var size: String

    var scale: CGFloat {
        switch size {
        case "small": return 0.88
        case "large": return 1.14
        default: return 1
        }
    }

    func scheme(_ system: ColorScheme) -> ColorScheme {
        switch theme {
        case "light": return .light
        case "dark": return .dark
        default: return system
        }
    }

    func font(_ base: CGFloat, bold: Bool = false) -> Font {
        let s = (base * scale).rounded()
        let name: String?
        switch font {
        case "pretendard": name = bold ? "Pretendard-SemiBold" : "Pretendard-Regular"
        case "gmarket": name = bold ? "GmarketSansBold" : "GmarketSansMedium"
        case "gaegu": name = bold ? "Gaegu-Bold" : "Gaegu-Regular"
        case "d2coding": name = bold ? "D2CodingBold" : "D2Coding"
        default: name = nil
        }
        if let name { return .custom(name, size: s) }
        return .system(size: s, weight: bold ? .semibold : .regular)
    }
}

// "2026-10-14" → "D-3" / "D-Day" / "D+2"
func pibDDay(_ travelDate: String?) -> String? {
    guard let travelDate else { return nil }
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "yyyy-MM-dd"
    guard let date = f.date(from: travelDate) else { return nil }
    let cal = Calendar.current
    let days = cal.dateComponents([.day], from: cal.startOfDay(for: Date()), to: cal.startOfDay(for: date)).day ?? 0
    if days == 0 { return "D-Day" }
    return days > 0 ? "D-\(days)" : "D+\(-days)"
}
