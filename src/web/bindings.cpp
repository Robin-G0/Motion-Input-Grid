#include <emscripten/bind.h>
#include <memory>
#include <mig/core/coordinates.hpp>
#include <mig/format/configuration.hpp>
#include <mig/hands/coordinates.hpp>
#include <mig/hands/fingers.hpp>

namespace {
class WebTracker {
    std::unique_ptr<mig::Engine> engine_{std::make_unique<mig::Engine>(mig::Configuration{})};
    mig::Frame frame_{};
    std::array<float, 33 * 8> body_{};
    std::array<float, 2 * 21 * 6> hands_{};
    std::span<const mig::Event> events_{};
    mig::hands::Frame detected_hands_{};
    std::array<int, 2> hand_indices_{-1, -1};

public:
    std::string load(const std::string& json) {
        try {
            auto proposed = std::make_unique<mig::Engine>(mig::parse_configuration(json));
            engine_ = std::move(proposed);
            events_ = {};
            frame_ = {};
            detected_hands_ = {};
            hand_indices_ = {-1, -1};
            return {};
        } catch (const std::exception& error) {
            return error.what(); // Failed imports leave the current engine intact.
        }
    }
    std::string export_config() const {
        return mig::serialize_configuration(engine_->configuration());
    }
    emscripten::val body_buffer() {
        return emscripten::val(emscripten::typed_memory_view(body_.size(), body_.data()));
    }
    emscripten::val hand_buffer() {
        return emscripten::val(emscripten::typed_memory_view(hands_.size(), hands_.data()));
    }
    int update(double time, double sequence, float aspect, int hand_count, unsigned world_mask) {
        if (!std::isfinite(time) || time < 0 || time > 9007199254740991.0 ||
            !std::isfinite(sequence) || sequence < 0 || sequence > 9007199254740991.0 ||
            std::floor(time) != time || std::floor(sequence) != sequence ||
            !std::isfinite(aspect) || aspect <= 0 || hand_count < 0 || hand_count > 2 ||
            world_mask > 3) {
            events_ = {};
            engine_->restart();
            frame_ = {};
            detected_hands_ = {};
            hand_indices_ = {-1, -1};
            return -1;
        }
        frame_ = {};
        frame_.timestamp_ms = std::int64_t(time);
        frame_.sequence = std::uint64_t(sequence);
        frame_.aspect = aspect;
        for (std::size_t i = 0; i < 33; ++i) {
            const auto* p = body_.data() + i * 8;
            auto& target = frame_.points[i];
            if (std::isfinite(p[0]) && std::isfinite(p[1]) && p[0] >= 0 && p[0] <= 1 && p[1] >= 0 &&
                p[1] <= 1 && std::isfinite(p[3]) && p[3] >= 0 && p[3] <= 1) {
                target = {{p[0], p[1]}, p[3]};
                target.depth_valid = std::isfinite(p[2]);
                target.depth = target.depth_valid ? p[2] : 0;
                target.world_valid =
                    p[7] == 1 && std::isfinite(p[4]) && std::isfinite(p[5]) && std::isfinite(p[6]);
                if (target.world_valid) {
                    target.world = {p[4], p[5], p[6]};
                }
            }
        }
        detected_hands_ = {};
        hand_indices_ = {-1, -1};
        auto& hands = detected_hands_;
        hands.timestamp_ms = frame_.timestamp_ms;
        hands.sequence = frame_.sequence;
        hands.aspect = aspect;
        // Like the portable core, accept observations supplied explicitly by the
        // host. tracking.hands is a capability request for capture adapters.
        if (hand_count > 0) {
            for (int i = 0; i < hand_count; ++i) {
                auto& hand = hands.hands[hands.count];
                hand = {};
                hand.world_valid = (world_mask & (1u << i)) != 0;
                for (std::size_t joint = 0; joint < 21; ++joint) {
                    const auto* p = hands_.data() + (i * 21 + joint) * 6;
                    hand.points[joint] = {p[0], p[1], p[2]};
                    hand.world_points[joint] = {p[3], p[4], p[5]};
                }
                if (mig::hands::valid(hand)) {
                    ++hands.count;
                }
            }
            const auto observations = mig::hands::hand_observations(hands, frame_);
            frame_.fingers = observations.fingers;
            frame_.hand_contacts = observations.contacts;
            hand_indices_ = observations.hand_indices;
        }
        events_ = engine_->update(frame_, frame_.timestamp_ms);
        return int(events_.size());
    }
    std::string event_action(unsigned index) const {
        if (index >= events_.size()) {
            return {};
        }
        return engine_->configuration().motions[events_[index].motion].action;
    }
    std::string event_id(unsigned index) const {
        if (index >= events_.size()) {
            return {};
        }
        return engine_->configuration().motions[events_[index].motion].id;
    }
    bool active(unsigned index) const {
        return index < engine_->configuration().motions.size() && engine_->action_active(index);
    }
    bool track_hands() const {
        return engine_->configuration().track_hands;
    }
    emscripten::val grid(bool reference) const {
        const auto& grid = reference ? engine_->reference_grid() : engine_->grid();
        if (!grid.valid) {
            return emscripten::val::null();
        }
        auto result = emscripten::val::object();
        result.set("centerX", grid.center.x);
        result.set("centerY", grid.center.y);
        result.set("axisX", grid.axis.x);
        result.set("axisY", grid.axis.y);
        result.set("scale", grid.scale);
        result.set("aspect", frame_.aspect);
        return result;
    }
    int gesture(int side) const {
        return side >= 0 && side < 2
                   ? int(mig::observed_gesture(frame_.fingers[side], frame_.hand_contacts[side]))
                   : 0;
    }
    emscripten::val coordinate(int landmark, int system) const {
        const auto point = mig::body_coordinate(frame_, landmark, mig::CoordinateSystem(system));
        if (!point) {
            return emscripten::val::null();
        }
        auto result = emscripten::val::object();
        result.set("x", point->x);
        result.set("y", point->y);
        result.set("z", point->z);
        result.set("confidence", point->confidence);
        return result;
    }
    void restart() {
        engine_->restart();
        events_ = {};
    }
    emscripten::val hand_coordinate(int side, int joint, int system) const {
        if (side < 0 || side >= 2 || joint < 0 || joint >= 21 || hand_indices_[side] < 0) {
            return emscripten::val::null();
        }
        const auto point =
            mig::hands::hand_coordinate(detected_hands_.hands[hand_indices_[side]],
                                        mig::hands::Landmark(joint), mig::CoordinateSystem(system));
        if (!point) {
            return emscripten::val::null();
        }
        auto result = emscripten::val::object();
        result.set("x", point->x);
        result.set("y", point->y);
        result.set("z", point->z);
        return result;
    }
    void recalibrate() {
        engine_->recalibrate();
        events_ = {};
    }
};
} // namespace
EMSCRIPTEN_BINDINGS(mig) {
    emscripten::class_<WebTracker>("Tracker")
        .constructor<>()
        .function("load", &WebTracker::load)
        .function("exportConfig", &WebTracker::export_config)
        .function("bodyBuffer", &WebTracker::body_buffer)
        .function("handBuffer", &WebTracker::hand_buffer)
        .function("update", &WebTracker::update)
        .function("eventAction", &WebTracker::event_action)
        .function("eventId", &WebTracker::event_id)
        .function("active", &WebTracker::active)
        .function("trackHands", &WebTracker::track_hands)
        .function("grid", &WebTracker::grid)
        .function("gesture", &WebTracker::gesture)
        .function("coordinate", &WebTracker::coordinate)
        .function("handCoordinate", &WebTracker::hand_coordinate)
        .function("restart", &WebTracker::restart)
        .function("recalibrate", &WebTracker::recalibrate);
}
