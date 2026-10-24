import AppKit
import Foundation

// This requests the app's ordinary Quit path. It never dismisses a save dialog
// or uses forceTerminate, process signals, Accessibility, or screen coordinates.
let identifier = "com.aivis-project.aivisspeech"
func applications() -> [NSRunningApplication] {
    NSRunningApplication.runningApplications(withBundleIdentifier: identifier)
}
func finish(_ status: String, _ code: Int32) -> Never {
    let data = try! JSONSerialization.data(withJSONObject: ["status": status])
    print(String(decoding: data, as: UTF8.self))
    exit(code)
}
let targets = applications()
if targets.isEmpty { finish("not_running", 0) }
for app in targets {
    guard app.bundleURL?.lastPathComponent == "AivisSpeech.app" else {
        finish("unexpected_bundle", 3)
    }
    guard app.terminate() else { finish("quit_refused", 3) }
}
let deadline = Date().addingTimeInterval(15)
while Date() < deadline {
    // AppKit's changing properties update on the main run loop.
    RunLoop.current.run(until: Date().addingTimeInterval(0.1))
    if targets.allSatisfy({ $0.isTerminated }) { finish("quit_requested_and_exited", 0) }
}
finish("awaiting_app_confirmation", 3)
