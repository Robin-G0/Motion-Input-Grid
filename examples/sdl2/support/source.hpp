#pragma once
#include "options.hpp"
#include "synthetic.hpp"
#include <cmath>
#include <iostream>
#include <memory>
#include <mig/core/coordinates.hpp>
#include <mig/format/configuration.hpp>
#include <mig/hands/fingers.hpp>
#include <mig/native/camera.hpp>
#include <mig/native/pose.hpp>
#include <mig/native/runtime.hpp>

namespace demo {
class Source {
    std::unique_ptr<mig::native::CaptureRuntime> capture_runtime_;
    std::unique_ptr<mig::native::Camera> camera_;
    std::unique_ptr<mig::native::Pose> pose_;
    mig::native::VideoFrame video_;
    std::uint64_t sequence_{};

public:
    mig::Frame body;
    mig::hands::Frame hands;
    const mig::native::VideoFrame& video() const noexcept {
        return video_;
    }
    explicit Source(const Options& options, bool track_hands, bool hand_preview = true) {
        if (!options.synthetic) {
            capture_runtime_ = std::make_unique<mig::native::CaptureRuntime>();
            const auto model = mig::native::parse_pose_model(options.pose_model);
            if (!model) {
                throw std::runtime_error("--pose must be lite, full or heavy");
            }
            pose_ = std::make_unique<mig::native::Pose>(
                options.runtime, track_hands || (hand_preview && options.hands), *model);
            camera_ = std::make_unique<mig::native::Camera>(options.camera);
        } else {
            video_.width = 320;
            video_.height = 240;
            video_.rgb.resize(320 * 240 * 3, 30);
        }
    }
    void set_hands_enabled(bool enabled) {
        if (pose_) {
            pose_->set_hands_enabled(enabled);
        }
    }
    bool sample() {
        if (camera_) {
            if (!camera_->read(video_, false)) {
                return false;
            }
            body = pose_->infer(video_.rgb, video_.width, video_.height, video_.capture_ms,
                                ++sequence_);
#ifdef MIG_NATIVE_HANDS
            hands = pose_->hand_frame();
#endif
            return true;
        }
        synthetic_frame(++sequence_, body, hands);
        return true;
    }
};
} // namespace demo
