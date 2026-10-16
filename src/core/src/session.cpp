#include <algorithm>
#include <cmath>
#include <mig/core/session.hpp>
#include <stdexcept>
namespace mig {
namespace {
bool known(const std::array<FingerObservation, 5>& hand) {
    return std::all_of(hand.begin(), hand.end(), [](auto finger) {
        return std::isfinite(finger.confidence) && finger.confidence >= 0.6f &&
               finger.confidence <= 1 && std::isfinite(finger.extension) && finger.extension >= 0 &&
               finger.extension <= 1;
    });
}
} // namespace
bool gesture_observations_known(const std::array<FingerObservation, 5>& hand, Gesture gesture,
                                HandContact contact) noexcept {
    return known(hand) && (gesture != Gesture::OK ||
                           (std::isfinite(contact.confidence) && contact.confidence >= .6f &&
                            contact.confidence <= 1 && std::isfinite(contact.thumb_index_ratio) &&
                            contact.thumb_index_ratio >= 0));
}
bool gesture_matches(const std::array<FingerObservation, 5>& hand, Gesture gesture,
                     HandContact contact) noexcept {
    if (!gesture_observations_known(hand, gesture, contact) || gesture == Gesture::None) {
        return false;
    }
    if (gesture == Gesture::OK) {
        return std::isfinite(contact.confidence) && contact.confidence >= .6f &&
               contact.confidence <= 1 && std::isfinite(contact.thumb_index_ratio) &&
               contact.thumb_index_ratio >= 0 && contact.thumb_index_ratio <= .25f &&
               hand[2].extension >= .7f && hand[3].extension >= .7f && hand[4].extension >= .7f;
    }
    if (gesture != Gesture::Thumb && gesture != Gesture::V && gesture != Gesture::OpenPalm &&
        gesture != Gesture::Fist) {
        return false;
    }
    for (int finger = 0; finger < 5; ++finger) {
        const bool extended =
            gesture == Gesture::OpenPalm ||
            (gesture == Gesture::Thumb ? finger == 0
                                       : gesture == Gesture::V && (finger == 1 || finger == 2));
        const float closed = gesture == Gesture::V ? (finger == 0 ? .55f : .4f) : .3f;
        if (extended ? hand[finger].extension < 0.7f : hand[finger].extension > closed) {
            return false;
        }
    }
    return true;
}
Gesture observed_gesture(const std::array<FingerObservation, 5>& hand,
                         HandContact contact) noexcept {
    for (auto gesture :
         {Gesture::OK, Gesture::Thumb, Gesture::V, Gesture::OpenPalm, Gesture::Fist}) {
        if (gesture_matches(hand, gesture, contact)) {
            return gesture;
        }
    }
    return Gesture::None;
}
unsigned GestureControls::update(const Frame& frame, unsigned reserved_hands) noexcept {
    if (frame.timestamp_ms <= previous_) {
        return 0;
    }
    const bool gap = previous_ < 0 || frame.timestamp_ms - previous_ > 500;
    previous_ = frame.timestamp_ms;
    const auto bindings =
        std::array{controls_.restart, controls_.recalibrate, controls_.record_toggle};
    unsigned actions = 0;
    const bool cooldown = suppressed(frame.timestamp_ms);
    for (std::size_t index = 0; index < bindings.size(); ++index) {
        const auto binding = bindings[index];
        auto& latch = latches_[index];
        if (reserved_hands & (1u << int(binding.hand))) {
            latch.since = latch.release_since = -1;
            continue; // A spatial Interaction owns this sign while occupied, including its latch.
        }
        const auto& hand = frame.fingers[int(binding.hand)];
        const auto contact = frame.hand_contacts[int(binding.hand)];
        if (gap) {
            latch.since = latch.release_since = -1;
        }
        if (!known(hand) || (binding.gesture == Gesture::OK &&
                             (!std::isfinite(contact.confidence) || contact.confidence < .6f ||
                              contact.confidence > 1 || !std::isfinite(contact.thumb_index_ratio) ||
                              contact.thumb_index_ratio < 0))) {
            latch.since = latch.release_since = -1;
            continue; // Occlusion is not a deliberate release.
        }
        const bool matched =
            gesture_matches(hand, binding.gesture, frame.hand_contacts[int(binding.hand)]);
        if (!matched) {
            latch.since = -1;
            if (latch.release_since < 0) {
                latch.release_since = frame.timestamp_ms;
            }
            if (frame.timestamp_ms - latch.release_since >= 150) {
                latch.held = false;
            }
            continue;
        }
        latch.release_since = -1;
        if (latch.held || cooldown) {
            latch.since = -1;
            continue;
        }
        if (latch.since < 0) {
            latch.since = frame.timestamp_ms;
        }
        if (frame.timestamp_ms - latch.since >= controls_.validation_ms) {
            latch.held = true;
            actions |= 1u << index;
        }
    }
    if (actions) {
        pause(frame.timestamp_ms);
    }
    return actions;
}
void Recorder::begin(std::vector<int> selected) {
    std::sort(selected.begin(), selected.end());
    selected.erase(std::unique(selected.begin(), selected.end()), selected.end());
    if (selected.empty() || selected.size() > 34) {
        throw std::runtime_error("Select recording landmarks");
    }
    std::vector<RecordedTrace> traces;
    traces.reserve(selected.size());
    for (int landmark : selected) {
        landmark_name(landmark);
        traces.push_back({landmark, {}});
        traces.back().points.reserve(2048);
    }
    traces_.swap(traces);
    last_ = began_ = -1;
    active_ = true;
}
void Recorder::sample(const Frame& frame, const Grid& grid) {
    if (!active_ || !grid.valid || frame.timestamp_ms <= last_ ||
        (last_ >= 0 && frame.timestamp_ms - last_ < 50)) {
        return;
    }
    if (began_ < 0) {
        began_ = frame.timestamp_ms;
    }
    if (frame.timestamp_ms - began_ > 60000 || traces_[0].points.size() >= 2048) {
        stop();
        return;
    }
    std::array<Vec2, 34> points{};
    for (std::size_t index = 0; index < traces_.size(); ++index) {
        const auto point = body_point(frame, traces_[index].landmark);
        if (point.confidence < 0.6f) {
            return; // Keep selected tracks synchronised.
        }
        points[index] = grid.local({point.position.x * frame.aspect, point.position.y});
        if (!std::isfinite(points[index].x) || !std::isfinite(points[index].y) ||
            points[index].x < Grid::min_cell || points[index].x >= Grid::max_cell ||
            points[index].y < Grid::min_cell || points[index].y >= Grid::max_cell) {
            return;
        }
    }
    for (std::size_t index = 0; index < traces_.size(); ++index) {
        traces_[index].points.push_back({points[index].x, points[index].y});
    }
    last_ = frame.timestamp_ms;
}
void Recorder::trim(std::size_t begin, std::size_t end) {
    stop();
    for (auto& trace : traces_) {
        if (begin > end || end > trace.points.size()) {
            throw std::runtime_error("Invalid trace range");
        }
        trace.points = {trace.points.begin() + begin, trace.points.begin() + end};
    }
}
Motion Recorder::convert(Motion input) const {
    if (traces_.empty() || traces_[0].points.empty()) {
        throw std::runtime_error("No recorded samples");
    }
    input.constraints.clear();
    input.steps.clear();
    input.recordings = traces_;
    std::vector<Cell> previous(traces_.size(), {-100, -100});
    for (std::size_t sample = 0; sample < traces_[0].points.size(); ++sample) {
        std::vector<Cell> cells;
        for (const auto& trace : traces_) {
            const auto point = trace.points[sample];
            cells.push_back({int(std::floor(point[0])), int(std::floor(point[1]))});
        }
        if (cells == previous) {
            continue;
        }
        if (input.steps.size() == 64) {
            throw std::runtime_error("More than 64 transitions; trim recording");
        }
        Step step;
        step.id = "recorded_step_" + std::to_string(input.steps.size());
        step.mode = StepMode::Simultaneous;
        for (std::size_t index = 0; index < traces_.size(); ++index) {
            step.constraints.push_back(
                {step.id + "_" + std::to_string(index), traces_[index].landmark, cells[index]});
        }
        input.steps.push_back(std::move(step));
        previous = std::move(cells);
    }
    return input;
}
void Recorder::edit_point(std::size_t trace, std::size_t sample, Vec2 point) {
    stop();
    if (trace >= traces_.size() || sample >= traces_[trace].points.size() ||
        !std::isfinite(point.x) || !std::isfinite(point.y) || point.x < Grid::min_cell ||
        point.x >= Grid::max_cell || point.y < Grid::min_cell || point.y >= Grid::max_cell) {
        throw std::runtime_error("Invalid recorded point edit");
    }
    traces_[trace].points[sample] = {point.x, point.y};
}
void Recorder::remove_sample(std::size_t sample) {
    stop();
    for (auto& trace : traces_) {
        if (sample >= trace.points.size()) {
            throw std::runtime_error("Invalid recorded sample");
        }
        trace.points.erase(trace.points.begin() + sample);
    }
}
} // namespace mig
