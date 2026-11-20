#pragma once
#include "models.hpp"
#include <filesystem>
#include <memory>
#include <mig/core/engine.hpp>
#include <span>
#ifdef MIG_NATIVE_HANDS
#include <mig/hands/frame.hpp>
#endif
namespace mig::native {
class Pose {
public:
    // Loads libmediapipe from `directory` and the pose model through
    // locate_pose_model(); every model file is checked against its pinned digest.
    explicit Pose(const std::filesystem::path& directory, bool enable_hands = false,
                  PoseModel model = PoseModel::Full);
    PoseModel model() const noexcept;
    ~Pose();
    // Call only from the inference owner thread. Disable releases the hand task immediately.
    void set_hands_enabled(bool enabled);
    bool hands_enabled() const noexcept;
    Pose(const Pose&) = delete;
    Pose& operator=(const Pose&) = delete;
    Frame infer(std::span<const std::uint8_t> rgb, int width, int height, std::int64_t capture_ms,
                std::uint64_t sequence);
#ifdef MIG_NATIVE_HANDS
    const hands::Frame& hand_frame() const noexcept;
#endif
private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};
} // namespace mig::native
