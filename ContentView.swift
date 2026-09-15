import SwiftUI
import CoreMotion


class MotionManager: ObservableObject {
    private let motion = CMMotionManager()

    @Published var x: CGFloat = 0
    @Published var y: CGFloat = 0

    init() {
        startMotionUpdates()
    }

    func startMotionUpdates() {
        guard motion.isDeviceMotionAvailable else { return }
        motion.deviceMotionUpdateInterval = 1.0 / 60.0

        motion.startDeviceMotionUpdates(to: .main) { [weak self] data, _ in
            guard let self, let d = data else { return }

            let pitch = d.attitude.pitch
            let yaw   = d.attitude.yaw

            let screenWidth  = UIScreen.main.bounds.width
            let screenHeight = UIScreen.main.bounds.height

            let limitedYaw = max(min(yaw, .pi/2), -(.pi/2))
            var normYaw = (limitedYaw / .pi) + 0.5
            normYaw = 1.0 - normYaw

            self.x = normYaw * screenWidth

            let normalizedPitch = (pitch + (.pi / 2)) / .pi
            self.y = (1.0 - normalizedPitch) * screenHeight
        }
    }

    func stopMotionUpdates() {
        motion.stopDeviceMotionUpdates()
    }
}


struct ContentView: View {
    @StateObject var motion = MotionManager()
    @State private var points: [CGPoint] = []
    @Environment(\.scenePhase) private var scenePhase


    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            // DRAWN PATH
            Path { path in
                guard points.count > 1 else { return }
                path.addLines(points)
            }
            .stroke(Color.white, lineWidth: 3)

            // CURRENT PEN DOT
            Circle()
                .fill(Color.white)
                .frame(width: 20, height: 20)
                .position(x: motion.x, y: motion.y)

            // CLEAN BUTTON
            VStack {
                HStack {
                    Spacer()

                    Button(action: {
                        points.removeAll()
                    }) {
                        Text("Clean")
                            .font(.headline)
                            .padding(10)
                            .background(Color.white.opacity(0.8))
                            .foregroundColor(.black)
                            .cornerRadius(8)
                    }
                    .padding()
                }
                Spacer()
            }
        }
        .onChange(of: motion.x) { _, _ in appendPoint() }
        .onChange(of: scenePhase) {
            if scenePhase == .active {
                motion.startMotionUpdates()
            } else {
                motion.stopMotionUpdates()
            }
        }

    }

    func appendPoint() {
        let p = CGPoint(x: motion.x, y: motion.y)
        points.append(p)
    }
}
