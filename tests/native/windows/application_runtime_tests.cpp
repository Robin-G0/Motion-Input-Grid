#include "app.hpp"
#include "diagnostics.hpp"
#include <fstream>

namespace mig::app {
int run_inference_test(const std::filesystem::path& directory, bool track_hands, PoseModel model) {
    for (int cycle = 0; cycle < 3; ++cycle) {
        Pose pose(directory, track_hands, model);
        std::vector<std::uint8_t> blank(640 * 480 * 3);
        for (int i = 0; i < 3; ++i) {
            pose.infer(blank, 640, 480, i + 1, i + 1);
#ifdef MIG_NATIVE_HANDS
            const auto& hands = pose.hand_frame();
            if (hands.timestamp_ms != i + 1 || hands.sequence != std::uint64_t(i + 1) ||
                hands.count != 0) {
                throw std::runtime_error("Invalid blank-frame hand result");
            }
#endif
        }
#ifdef MIG_NATIVE_HANDS
        pose.set_hands_enabled(false);
        if (pose.hands_enabled() || pose.hand_frame().count) {
            throw std::runtime_error("Disabled hands task retained observations");
        }
        pose.set_hands_enabled(track_hands);
        if (pose.hands_enabled() != track_hands) {
            throw std::runtime_error("Hands task toggle failed");
        }
#endif
    }
    std::cout << "Native MediaPipe: " << pose_model_info(model).label << ", "
              << (track_hands ? "body + hands" : "body only")
              << ", 9 blank-frame inferences and 3 create/close cycles passed. No Python.\n";
    return 0;
}

int run_camera_test(const std::filesystem::path& directory, unsigned index, bool track_hands,
                    PoseModel model) {
    Camera camera(index);
    Pose pose(directory, track_hands, model);
    std::atomic<bool> done{};
    std::jthread watchdog([&](std::stop_token token) {
        const auto deadline = now_ms() + 10000;
        while (!token.stop_requested() && !done && now_ms() < deadline) {
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }
        if (!done && !token.stop_requested()) {
            done = true;
            camera.shutdown();
        }
    });
    VideoFrame frame;
    for (int i = 0; i < 5;) {
        if (done) {
            throw std::runtime_error("Camera diagnostic timed out");
        }
        if (camera.read(frame)) {
            const auto started = now_ms();
            const auto result =
                pose.infer(frame.rgb, frame.width, frame.height, frame.capture_ms, ++i);
            std::cout << "Camera frame " << i << ": " << frame.width << 'x' << frame.height
                      << ", nose confidence=" << result.points[0].confidence << ", "
                      << pose_model_info(model).label << " inference " << now_ms() - started
                      << " ms\n";
#ifdef MIG_NATIVE_HANDS
            if (track_hands) {
                std::cout << "Hands detected: " << pose.hand_frame().count << '\n';
            }
#endif
        }
    }
    done = true;
    std::cout << "Camera + native inference smoke passed; camera released.\n";
    return 0;
}
} // namespace mig::app
