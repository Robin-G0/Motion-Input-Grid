#pragma once
#include <mig/core/engine.hpp>
namespace mig {
enum class ControlAction : unsigned { None = 0, Restart = 1, Recalibrate = 2, RecordToggle = 4 };
// Global commands use their own pose tolerance; input finger rules remain strict.
class GestureControls {
public:
    explicit GestureControls(Controls controls = {}) : controls_(controls) {}
    unsigned update(const Frame& frame, unsigned reserved_hands = 0) noexcept;
    bool suppressed(std::int64_t time) const noexcept {
        return time < resume_at_;
    }
    void pause(std::int64_t time) noexcept {
        resume_at_ = time + 1000;
    }

private:
    struct Latch {
        std::int64_t since{-1}, release_since{-1};
        bool held{};
    };
    Controls controls_;
    std::array<Latch, 3> latches_{};
    std::int64_t previous_{-1}, resume_at_{};
};
class Recorder {
public:
    // Invalid selections preserve the current recording and its active state.
    void begin(std::vector<int> landmarks);
    void sample(const Frame& frame, const Grid& grid);
    void stop() noexcept {
        active_ = false;
    }
    void discard() {
        active_ = false;
        traces_.clear();
    }
    bool active() const noexcept {
        return active_;
    }
    const std::vector<RecordedTrace>& traces() const noexcept {
        return traces_;
    }
    void trim(std::size_t begin, std::size_t end);
    void edit_point(std::size_t trace, std::size_t sample, Vec2 point);
    void remove_sample(std::size_t sample);
    Motion convert(Motion input) const;

private:
    bool active_{};
    std::int64_t last_{-1}, began_{-1};
    std::vector<RecordedTrace> traces_;
};
} // namespace mig
