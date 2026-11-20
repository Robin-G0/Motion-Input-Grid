#pragma once

#include <array>
#include <cstdint>
#include <mig/core/input.hpp>
#include <span>
#include <string>
#include <unordered_map>
#include <vector>

namespace mig {
struct Vec2 {
    float x{}, y{};
    bool operator==(const Vec2&) const = default;
    Vec2 operator+(Vec2 b) const {
        return {x + b.x, y + b.y};
    }
    Vec2 operator-(Vec2 b) const {
        return {x - b.x, y - b.y};
    }
    Vec2 operator*(float s) const {
        return {x * s, y * s};
    }
};
float distance(Vec2 a, Vec2 b);
struct Point {
    Vec2 position{};
    float confidence{};
    float depth{}; // Image-relative z (hip origin); not camera distance in metres.
    bool depth_valid{};
    std::array<float, 3> world{}; // Metres relative to hip midpoint, when available.
    bool world_valid{};
};
struct Frame {
    std::int64_t timestamp_ms{};
    std::uint64_t sequence{};
    float aspect{16.f / 9.f};
    std::array<Point, 33> points{}; // Anatomical MediaPipe pose indices, unmirrored.
    FingerObservations fingers{};
    std::array<HandContact, 2> hand_contacts{};
};
struct Motion {
    std::string id;
    std::int64_t max_duration_ms{}; // 0: no time limit
    std::int64_t cooldown_ms{};
    std::vector<KeyboardAction> keyboard; // Ordered text/chord actions; empty = event only.
    ActionMode action_mode{ActionMode::SinglePress};
    int repeat_interval_ms{200};
    std::string name, action;
    bool mirror{};
    CoordinateSpace space{CoordinateSpace::Calibrated};
    std::vector<SpatialConstraint> constraints;
    std::vector<Step> steps;
    std::vector<FingerConstraint> fingers;
    std::vector<RecordedTrace> recordings;
    bool operator==(const Motion&) const = default;
};
struct Configuration {
    std::vector<Motion> motions;
    // Capability request, not a recognition rule. Defaults to body-only.
    bool track_hands{false};
    Controls controls;
    bool operator==(const Configuration&) const = default;
};
struct Grid {
    // Cell side in aspect-corrected image space, relative to current shoulders.
    static constexpr float cell_shoulder_ratio = 0.2f;
    // Extend the original 0..9 editor area without changing saved coordinates.
    static constexpr int min_cell = -9, max_cell = 18;
    static constexpr int cell_count = max_cell - min_cell;
    bool valid{}, calibrated{};
    Vec2 center{}, axis{1, 0};
    float scale{}, baseline_width{}, approach{};
    Vec2 local(Vec2 metric) const;
    Vec2 metric(Vec2 local) const;
};
struct Event {
    std::size_t motion{};
    std::int64_t timestamp_ms{};
};
enum class ConstraintStatus {
    Missing,
    Validated,
    Forbidden,
    Triggered,
    FingerInvalid,
    LandmarkLost,
    HandMissing,
    SignMismatch,
    Holding
};
struct InputProgress {
    std::vector<ConstraintStatus> constraints;
    std::vector<int> interaction_elapsed_ms;
    std::size_t step{};
    bool active{}, failed{}, triggered{}, mirrored{}, fingers_valid{true};
    bool output_active{}; // Live terminal conditions after firing, separate from Test's latch.
};
Point body_point(const Frame& frame, int landmark) noexcept;
class Engine {
public:
    explicit Engine(Configuration config);
    Engine(const Engine&) = delete;
    Engine& operator=(const Engine&) = delete;
    Engine(Engine&&) noexcept = default;
    Engine& operator=(Engine&&) noexcept = default;
    void recalibrate() noexcept;
    void restart() noexcept;
    void set_test_mode(bool enabled) noexcept {
        test_mode_ = enabled;
    }
    const Grid& reference_grid() const noexcept {
        return reference_grid_;
    }
    const InputProgress& progress(std::size_t motion, bool mirrored = false) const {
        return generic_[motion][mirrored ? 1 : 0].progress;
    }
    std::span<const Event> update(const Frame& frame, std::int64_t now_ms) noexcept;
    const Grid& grid() const noexcept {
        return grid_;
    }
    const Configuration& configuration() const noexcept {
        return config_;
    }
    unsigned interaction_hands() const noexcept {
        return interaction_hands_;
    }
    bool action_active(std::size_t motion) const noexcept {
        return generic_[motion][0].progress.output_active ||
               generic_[motion][1].progress.output_active;
    }

private:
    Configuration config_;
    struct Projection {
        std::array<Vec2, 34> local{}, metric{};
        std::array<bool, 34> visible{};
    };
    std::array<Projection, 4> projections_;
    std::array<bool, 4> projection_ready_{};
    const Projection& project_frame(const Frame& frame, const Grid& basis, bool body,
                                    bool mirror) noexcept;
    std::vector<Event> events_;
    Grid grid_;
    Grid reference_grid_;
    struct GenericCandidate {
        InputProgress progress;
        std::vector<const SpatialConstraint*> constraints;
        std::vector<std::size_t> offsets;
        std::array<Vec2, 34> previous{};
        std::array<bool, 34> previous_valid{};
        struct FingerTimer {
            FingerConstraint rule;
            std::int64_t since{-1}, last_valid{-1};
        };
        std::vector<FingerTimer> finger_timers;
        std::unordered_map<const std::vector<FingerConstraint>*, std::vector<std::size_t>>
            finger_scopes;
        std::vector<std::vector<std::size_t>> alternatives;
        std::vector<std::vector<std::size_t>> groups;
        std::vector<std::size_t> group_root;
        std::vector<std::size_t> evaluation_order;
        std::vector<std::vector<std::size_t>> sustain_groups;
        std::vector<std::int64_t> interaction_since;
        std::int64_t started{-1}, held_since{-1}, ready_after{};
        bool locked{};
        int completed_step{-1};
        bool interaction_only{};
    };
    void compile_constraints(GenericCandidate& candidate, const Motion& input);
    void compile_groups(GenericCandidate& candidate);
    void compile_sustain(GenericCandidate& candidate, const Motion& input);
    void compile_fingers(GenericCandidate& candidate, const Motion& input);
    std::vector<std::array<GenericCandidate, 2>> generic_;
    bool test_mode_{};
    unsigned interaction_hands_{};
    std::array<float, 90> widths_{};
    std::size_t sample_count_{};
    std::size_t width_cursor_{};
    float calibration_reference_width_{};
    Vec2 anchor_{};
    std::int64_t stable_since_{-1}, last_time_{-1};
    std::uint64_t sequence_{};
    void lose_tracking() noexcept;
    bool update_grid(const Frame& frame, std::int64_t previous_time) noexcept;
    void recognise_constraints(const Frame& frame, bool continuous,
                               bool contact_continuous) noexcept;
};
void validate(const Configuration& config);
// True when a finger rule, interaction cell or hand command binding needs hand
// observations. Hosts can skip hand inference for profiles that only track the body.
bool uses_hand_observations(const Configuration& config) noexcept;
} // namespace mig
