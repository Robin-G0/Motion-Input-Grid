#include "capture.hpp"
#include <mig/core/session.hpp>
namespace mig::linux_ui {
Capture::~Capture() {
    stop();
}
void Capture::start(Configuration config, std::string runtime, unsigned camera,
                    CaptureOptions options) {
    stop();
    stopping_ = false;
    worker_ = std::jthread([this, config = std::move(config), runtime = std::move(runtime), camera,
                            options] { run(config, runtime, camera, options); });
}
void Capture::stop() {
    stopping_ = true;
    if (worker_.joinable()) {
        worker_.join();
    }
    std::lock_guard lock(mutex_);
    latest_ = {};
    pending_ = false;
}
bool Capture::take(Snapshot& snapshot) {
    std::lock_guard lock(mutex_);
    if (!pending_) {
        return false;
    }
    snapshot = std::move(latest_);
    pending_ = false;
    return true;
}
void Capture::run(Configuration config, const std::string& runtime, unsigned index,
                  CaptureOptions options) {
    try {
        native::Pose pose(runtime, options.hands, options.model);
        native::Camera camera(index);
        Engine engine(config);
        GestureControls controls(config.controls);
        native::VideoFrame video;
        std::uint64_t sequence = 0;
        while (!stopping_) {
            Snapshot snapshot;
            if (!camera.read(video, false)) {
                engine.restart();
            } else {
                snapshot.body =
                    pose.infer(video.rgb, video.width, video.height, video.capture_ms, ++sequence);
#ifdef MIG_NATIVE_HANDS
                snapshot.hands = pose.hand_frame();
#endif
                const auto now = native::now_ms();
                const auto events = engine.update(snapshot.body, now);
                const auto command =
                    now - snapshot.body.timestamp_ms <= 500
                        ? controls.update(snapshot.body, engine.interaction_hands())
                        : 0;
                if (command & unsigned(ControlAction::Recalibrate)) {
                    engine.recalibrate();
                }
                if (command & unsigned(ControlAction::Restart)) {
                    engine.restart();
                }
                snapshot.paused = controls.suppressed(snapshot.body.timestamp_ms);
                if (snapshot.paused) {
                    engine.restart();
                } else {
                    for (const auto& event : events) {
                        snapshot.events.push_back(event);
                    }
                    for (std::size_t input = 0; input < config.motions.size(); ++input) {
                        snapshot.active[input] = engine.action_active(input);
                    }
                }
                snapshot.grid = engine.grid();
                snapshot.reference_grid = engine.reference_grid();
                snapshot.inspected = verification.load();
                if (snapshot.inspected >= 0 &&
                    std::size_t(snapshot.inspected) < config.motions.size()) {
                    snapshot.progress = engine.progress(std::size_t(snapshot.inspected));
                    snapshot.mirrored_progress =
                        engine.progress(std::size_t(snapshot.inspected), true);
                }
                if (preview_enabled) {
                    snapshot.image = QImage(video.rgb.data(), video.width, video.height,
                                            video.width * 3, QImage::Format_RGB888)
                                         .copy();
                }
            }
            std::lock_guard lock(mutex_);
            // Events cannot disappear when a newer image overwrites the mailbox.
            if (pending_ && !snapshot.paused && snapshot.grid.valid) {
                snapshot.events.insert(snapshot.events.begin(), latest_.events.begin(),
                                       latest_.events.end());
                if (snapshot.events.size() > 64) {
                    snapshot.events.erase(snapshot.events.begin(), snapshot.events.end() - 64);
                }
            }
            latest_ = std::move(snapshot);
            pending_ = true;
        }
    } catch (const std::exception& error) {
        std::lock_guard lock(mutex_);
        latest_ = {};
        latest_.error = error.what();
        pending_ = true;
    }
}
} // namespace mig::linux_ui
