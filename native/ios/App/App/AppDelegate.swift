import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        installNotificationSounds()
        return true
    }

    /// The soft tones that reminders play (cue_half, cue_warn, cue_finish) ship
    /// inside the web folder as public/sounds/*.wav. iOS only plays a
    /// notification sound from the app's main bundle or from Library/Sounds,
    /// so they are copied there on each launch; the copy is cheap and keeps the
    /// sounds current after an update.
    private func installNotificationSounds() {
        let fm = FileManager.default
        guard let resources = Bundle.main.resourceURL,
              let library = fm.urls(for: .libraryDirectory, in: .userDomainMask).first else { return }
        let source = resources.appendingPathComponent("public/sounds", isDirectory: true)
        let target = library.appendingPathComponent("Sounds", isDirectory: true)
        guard let files = try? fm.contentsOfDirectory(at: source, includingPropertiesForKeys: nil) else { return }
        try? fm.createDirectory(at: target, withIntermediateDirectories: true)
        for file in files where file.pathExtension == "wav" {
            let copy = target.appendingPathComponent(file.lastPathComponent)
            if fm.fileExists(atPath: copy.path) { try? fm.removeItem(at: copy) }
            try? fm.copyItem(at: file, to: copy)
        }
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
