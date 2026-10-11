import UIKit
import Capacitor
import AppIntents
import ActivityKit
import UserNotifications

// iOS 27 SDK(Xcode 27)부터 UIScene 생명주기를 쓰지 않는 앱은 실행되지 않는다(2026-10-10).
// 화면(window)은 SceneDelegate가 갖고, Info.plist의 UIApplicationSceneManifest가 Main 스토리보드로 첫 화면을 만든다.
// 앱 단위 일(푸시 등록 등)은 AppDelegate, 화면 단위 일(URL 열기·유니버설 링크)은 SceneDelegate가 받는다.
@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // 로그인된 기기면 켤 때마다 APNs에 등록한다(토큰이 바뀌면 서버에 올림 - 애플 권장)
        if PIBStore.token != nil { PIBPush.register() }
        // 떠 있는 실시간 현황의 푸시 토큰을 다시 지켜본다(앱이 꺼졌다 켜져도 서버가 올바른 토큰을 갖게)
        if #available(iOS 16.2, *) { PIBLiveActivity.observeExisting() }
        return true
    }

    // ---- 푸시(APNs) 등록 결과(2026-10-11) ----
    // Capacitor 푸시 플러그인(@capacitor/push-notifications)에도 알려 주고, 서버 저장은 네이티브가 직접 한다
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
        PIBPush.didRegister(deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
        print("[팩인백] 푸시 등록 실패:", error.localizedDescription)
    }

    // 조용한 푸시(content-available) · 알림 도착(2026-10-11, B-4): 다른 멤버가 가방을 바꿨다.
    // 앱이 꺼져 있어도(강제 종료가 아니면) iOS가 잠깐 깨워 준다 → 서버에서 요약을 받아 위젯 · 실시간 현황을 새로 그린다.
    // iOS가 횟수를 줄일 수 있어(배터리 · 사용 빈도) 안 올 때도 있다 - 그때는 위젯의 새로고침 버튼
    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        guard PIBStore.token != nil else {
            completionHandler(.noData)
            return
        }
        Task {
            do {
                try await PIBAPI.refreshSummary()
                PIBWidgets.reload()
                if #available(iOS 16.2, *) { await PIBLiveActivity.updateAll() }
                completionHandler(.newData)
            } catch {
                completionHandler(.failed)
            }
        }
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    // scene을 쓰면 아래 두 개는 iOS가 부르지 않는다(SceneDelegate로 옮김). 혹시 모를 경우를 위해 남겨 둔다.
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}

// 새 파일로 나누면 Xcode 프로젝트에 등록해야 해서, 이미 앱 타깃에 들어 있는 이 파일에 함께 둔다.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    // Main 스토리보드가 만든 창을 UIKit이 여기에 넣어 준다
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // 앱이 꺼져 있을 때 링크(구글 로그인 복귀, 공유 링크 등)로 열린 경우
        if let urlContext = connectionOptions.urlContexts.first {
            openURL(urlContext)
        }
        if let activity = connectionOptions.userActivities.first {
            continueActivity(activity)
        }
    }

    // 앱이 켜져 있을 때 URL로 열림 (예전 AppDelegate application(_:open:options:))
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for context in URLContexts {
            openURL(context)
        }
    }

    // 유니버설 링크 (예전 AppDelegate application(_:continue:restorationHandler:))
    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        continueActivity(userActivity)
    }

    // 앱으로 돌아올 때: 알림 권한을 설정 앱에서 바꾼 경우 등 바뀐 게 있을 때만 서버에 알린다(바뀐 게 없으면 네트워크 안 함)
    func sceneDidBecomeActive(_ scene: UIScene) {
        Task { await PIBPush.upload() }
    }

    private func openURL(_ context: UIOpenURLContext) {
        var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
        if let source = context.options.sourceApplication {
            options[.sourceApplication] = source
        }
        options[.openInPlace] = context.options.openInPlace
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: context.url, options: options)
    }

    private func continueActivity(_ activity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: activity, restorationHandler: { _ in })
    }
}

// ---- 웹 ↔ 네이티브 다리(2026-10-10) ------------------------------------------------------
// Main.storyboard의 최상위 화면이 이 클래스다. 앱 안에 직접 만든 플러그인을 여기서 등록한다.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PackInBagNativePlugin())
    }
}

// 웹(lib/v2/nativeBridge.ts)이 부르는 플러그인 "PackInBagNative".
// 기기 토큰 · 가방 요약을 App Group에 저장하고 위젯 · 잠금화면 실시간 현황을 새로 그린다(Shared/ 폴더).
@objc(PackInBagNativePlugin)
public class PackInBagNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PackInBagNativePlugin"
    public let jsName = "PackInBagNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveSummary", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startLiveActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endLiveActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "liveActivityState", returnType: CAPPluginReturnPromise),
    ]

    @objc func getSession(_ call: CAPPluginCall) {
        var result: [String: Any] = ["hasToken": PIBStore.token != nil]
        if let uid = PIBStore.uid { result["uid"] = uid }
        call.resolve(result)
    }

    @objc func setSession(_ call: CAPPluginCall) {
        guard let uid = call.getString("uid"), let token = call.getString("token") else {
            call.reject("uid, token이 필요해요")
            return
        }
        let apiBase = call.getString("apiBase") ?? PIBStore.apiBase
        // 다른 계정으로 바뀌면 예전 토큰은 서버에서 지운다
        if let old = PIBStore.token, old != token {
            let oldBase = PIBStore.apiBase
            Task { await PIBAPI.revoke(token: old, base: oldBase) }
        }
        if PIBStore.uid != uid { PIBStore.clearSession() }
        PIBStore.setSession(uid: uid, token: token, apiBase: apiBase)
        PIBWidgets.reload()
        // 새 기기 토큰에 푸시 토큰을 붙인다(등록 결과가 오면 PIBPush.didRegister → 업로드)
        PIBPush.register()
        call.resolve()
    }

    @objc func clearSession(_ call: CAPPluginCall) {
        if let old = PIBStore.token {
            let oldBase = PIBStore.apiBase
            Task { await PIBAPI.revoke(token: old, base: oldBase) }
        }
        PIBStore.clearSession()
        // 서버의 푸시 토큰은 기기 토큰 문서와 함께 지워진다. 다음 로그인 때 다시 올리도록 표시만 지운다
        PIBPush.forget()
        PIBWidgets.reload()
        Task {
            if #available(iOS 16.2, *) { await PIBLiveActivity.endAll() }
            call.resolve()
        }
    }

    @objc func saveSummary(_ call: CAPPluginCall) {
        guard let json = call.getString("json"), PIBStore.save(json: json) else {
            call.reject("요약 형식이 올바르지 않아요")
            return
        }
        PIBWidgets.reload()
        Task {
            if #available(iOS 16.2, *) { await PIBLiveActivity.updateAll() }
            call.resolve()
            // 위젯에서 눌렀는데 아직 못 보낸 체크가 있으면 지금 보낸다
            if !PIBStore.pending().isEmpty, await PIBSync.flush() { PIBWidgets.reload() }
        }
    }

    @objc func startLiveActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("iOS 16.2 이상에서 쓸 수 있어요")
            return
        }
        guard let bagId = call.getString("bagId"), let packId = call.getString("packId") else {
            call.reject("bagId, packId가 필요해요")
            return
        }
        let theme = call.getString("theme") ?? "system"
        let font = call.getString("font") ?? "system"
        let size = call.getString("size") ?? "medium"
        Task {
            do {
                let id = try await PIBLiveActivity.start(bagId: bagId, packId: packId, theme: theme, font: font, size: size)
                call.resolve(["id": id])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func endLiveActivity(_ call: CAPPluginCall) {
        Task {
            if #available(iOS 16.2, *) { await PIBLiveActivity.endAll() }
            call.resolve()
        }
    }

    @objc func liveActivityState(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["supported": false, "enabled": false, "active": false])
            return
        }
        var result: [String: Any] = [
            "supported": true,
            "enabled": ActivityAuthorizationInfo().areActivitiesEnabled,
            "active": PIBLiveActivity.current != nil,
        ]
        if let current = PIBLiveActivity.current {
            result["bagId"] = current.bagId
            result["packId"] = current.packId
        }
        call.resolve(result)
    }
}

// ---- 푸시(APNs) 토큰(2026-10-11) -----------------------------------------------------------
// 로그인하면(setSession) · 앱을 켤 때 APNs에 등록하고, 받은 토큰을 기기 토큰으로 서버에 붙인다(/api/native/push-token).
// - 등록에는 알림 권한이 필요 없다. 권한이 없어도 조용한 푸시(위젯 갱신)는 온다. 권한 여부는 alerts로 함께 알린다
// - 기기 토큰 · 푸시 토큰 · 환경 · 권한이 마지막으로 보낸 것과 같으면 다시 보내지 않는다
// - 로그아웃하면 서버 쪽은 기기 토큰 문서째 지워지므로 여기서는 "보냈음" 표시만 지운다
enum PIBPush {
    private static let apnsKey = "pib.apnsToken"
    private static let sentKey = "pib.apnsSent"

    // Xcode에서 바로 설치(Debug) = 개발용 APNs, Archive(Release → TestFlight · App Store) = 운영 APNs
    static let environment = PIB.apnsEnvironment

    static func register() {
        DispatchQueue.main.async { UIApplication.shared.registerForRemoteNotifications() }
    }

    static func didRegister(_ deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        PIB.defaults.set(hex, forKey: apnsKey)
        Task { await upload() }
    }

    static func forget() {
        PIB.defaults.removeObject(forKey: sentKey)
    }

    static func upload() async {
        guard let session = PIBStore.token, let apns = PIB.defaults.string(forKey: apnsKey) else { return }
        let status = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        let alerts = status == .authorized || status == .provisional || status == .ephemeral
        let mark = "\(session.prefix(16))|\(apns)|\(environment)|\(alerts)"
        if PIB.defaults.string(forKey: sentKey) == mark { return }
        do {
            try await PIBAPI.registerPush(token: apns, environment: environment, alerts: alerts)
            PIB.defaults.set(mark, forKey: sentKey)
        } catch {
            // 다음에 앱으로 돌아올 때 다시 한다
            print("[팩인백] 푸시 토큰 업로드 실패:", error.localizedDescription)
        }
    }
}

// 단축어 앱에 바로 보이는 동작(앱만 깔면 됨). 자세한 동작은 Shared/PIBIntents.swift
@available(iOS 17.0, *)
struct PackInBagShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: QuickAddIntent(),
            phrases: ["\(.applicationName) 빠른팩에 입력", "\(.applicationName)에 적어 두기"],
            shortTitle: "빠른팩에 입력",
            systemImageName: "square.and.pencil"
        )
        AppShortcut(
            intent: AddToBagIntent(),
            phrases: ["\(.applicationName) 가방에 추가", "\(.applicationName) 가방에 넣기"],
            shortTitle: "가방에 추가",
            systemImageName: "bag.badge.plus"
        )
        AppShortcut(
            intent: RefreshIntent(),
            phrases: ["\(.applicationName) 새로고침"],
            shortTitle: "팩인백 새로고침",
            systemImageName: "arrow.clockwise"
        )
    }
}
