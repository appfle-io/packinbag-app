import UIKit
import Capacitor

// iOS 27 SDK(Xcode 27)부터 UIScene 생명주기를 쓰지 않는 앱은 실행되지 않는다(2026-10-10).
// 화면(window)은 SceneDelegate가 갖고, Info.plist의 UIApplicationSceneManifest가 Main 스토리보드로 첫 화면을 만든다.
// 앱 단위 일(푸시 등록 등)은 AppDelegate, 화면 단위 일(URL 열기·유니버설 링크)은 SceneDelegate가 받는다.
@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
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
