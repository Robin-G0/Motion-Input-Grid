#include <cmath>
#include <cstring>
#include <memory>
#include <mig/c/api.h>
#include <mig/core/coordinates.hpp>
#include <mig/format/configuration.hpp>
#ifdef MIG_C_HANDS
#include <mig/hands/coordinates.hpp>
#include <mig/hands/fingers.hpp>
#endif
#ifdef MIG_C_NATIVE
#include "camera.hpp"
#include "pose.hpp"
#include "runtime.hpp"
#endif

struct mig_tracker {
    std::unique_ptr<mig::Engine> engine;
    mig::Frame frame{};
    std::span<const mig::Event> events{};
#ifdef MIG_C_HANDS
    mig::hands::Frame hands{};
    std::array<int, 2> hand_indices{-1, -1};
#endif
#ifdef MIG_C_NATIVE
    std::unique_ptr<mig::native::CaptureRuntime> capture_runtime;
    std::unique_ptr<mig::native::Pose> pose;
    std::unique_ptr<mig::native::Camera> camera;
    mig::native::VideoFrame video;
    bool preview_ready{};
    std::uint64_t sequence{};
#endif
};
namespace {
thread_local std::string last_error;
template <class Function> int guarded(Function function) noexcept {
    try {
        return function();
    } catch (const std::exception& error) {
        last_error = error.what();
    } catch (...) {
        last_error = "Unknown native failure";
    }
    return -1;
}
void require(bool condition, const char* message) {
    if (!condition) {
        throw std::invalid_argument(message);
    }
}
void clear_observations(mig_tracker& tracker) {
    tracker.frame = {};
    tracker.events = {};
#ifdef MIG_C_HANDS
    tracker.hands = {};
    tracker.hand_indices = {-1, -1};
#endif
}
void copy_body(const mig_packet& packet, mig::Frame& frame) {
    frame = {};
    frame.timestamp_ms = packet.timestamp_ms;
    frame.sequence = packet.sequence;
    frame.aspect = packet.aspect;
    for (unsigned joint = 0; joint < 33; ++joint) {
        const float* source = packet.body + joint * 8;
        auto& point = frame.points[joint];
        if (!std::isfinite(source[0]) || !std::isfinite(source[1]) || source[0] < 0 ||
            source[0] > 1 || source[1] < 0 || source[1] > 1 || !std::isfinite(source[3]) ||
            source[3] < 0 || source[3] > 1) {
            continue;
        }
        point.position = {source[0], source[1]};
        point.confidence = source[3];
        point.depth_valid = std::isfinite(source[2]);
        point.depth = point.depth_valid ? source[2] : 0;
        point.world_valid = source[7] == 1 && std::isfinite(source[4]) &&
                            std::isfinite(source[5]) && std::isfinite(source[6]);
        if (point.world_valid) {
            point.world = {source[4], source[5], source[6]};
        }
    }
}
#ifdef MIG_C_HANDS
void copy_hands(const mig_packet& packet, mig_tracker& tracker) {
    auto& hands = tracker.hands;
    hands = {};
    hands.timestamp_ms = packet.timestamp_ms;
    hands.sequence = packet.sequence;
    hands.aspect = packet.aspect;
    for (unsigned index = 0; index < packet.hand_count; ++index) {
        auto& hand = hands.hands[hands.count];
        hand = {};
        hand.world_valid = (packet.hand_world_mask & (1u << index)) != 0;
        for (unsigned joint = 0; joint < 21; ++joint) {
            const float* point = packet.hands + (index * 21 + joint) * 6;
            hand.points[joint] = {point[0], point[1], point[2]};
            hand.world_points[joint] = {point[3], point[4], point[5]};
        }
        if (mig::hands::valid(hand)) {
            ++hands.count;
        }
    }
    const auto observations = mig::hands::hand_observations(hands, tracker.frame);
    tracker.frame.fingers = observations.fingers;
    tracker.frame.hand_contacts = observations.contacts;
    tracker.hand_indices = observations.hand_indices;
}
#endif
int update_packet(mig_tracker* tracker, const mig_packet* packet, std::int64_t now) {
    require(tracker, "Tracker is null");
    if (!packet || packet->timestamp_ms < 0 || !std::isfinite(packet->aspect) ||
        packet->aspect <= 0 || packet->hand_count > 2 || packet->hand_world_mask > 3) {
        mig_reset(tracker, 0);
        throw std::invalid_argument("Invalid frame metadata");
    }
#ifndef MIG_C_HANDS
    if (packet->hand_count) {
        mig_reset(tracker, 0);
        throw std::invalid_argument("Library built without hands support");
    }
#endif
    copy_body(*packet, tracker->frame);
#ifdef MIG_C_HANDS
    copy_hands(*packet, *tracker);
#endif
    tracker->events = tracker->engine->update(tracker->frame, now);
    return int(tracker->events.size());
}
} // namespace
extern "C" {
unsigned mig_abi_version() {
    return 1;
}
size_t mig_packet_size() {
    return sizeof(mig_packet);
}
const char* mig_last_error() {
    return last_error.c_str();
}
mig_tracker* mig_create(const char* json) {
    std::unique_ptr<mig_tracker> result;
    guarded([&] {
        require(json, "JSON is null");
        result = std::make_unique<mig_tracker>();
        result->engine = std::make_unique<mig::Engine>(mig::parse_configuration(json));
        return 0;
    });
    if (!result || !result->engine) {
        return nullptr;
    }
    return result.release();
}
void mig_destroy(mig_tracker* tracker) {
    delete tracker;
}
int mig_load(mig_tracker* tracker, const char* json) {
    return guarded([&] {
        require(tracker && json, "Tracker or JSON is null");
        auto engine = std::make_unique<mig::Engine>(mig::parse_configuration(json));
        mig_camera_stop(tracker);
        tracker->engine = std::move(engine);
        clear_observations(*tracker);
        return 0;
    });
}
size_t mig_export(mig_tracker* tracker, char* buffer, size_t capacity) {
    size_t required = 0;
    guarded([&] {
        require(tracker, "Tracker is null");
        const auto json = mig::serialize_configuration(tracker->engine->configuration());
        required = json.size() + 1;
        if (buffer && capacity >= required) {
            std::memcpy(buffer, json.c_str(), required);
        }
        return 0;
    });
    return required;
}
int mig_update(mig_tracker* tracker, const mig_packet* packet) {
    return guarded(
        [&] { return update_packet(tracker, packet, packet ? packet->timestamp_ms : 0); });
}
const char* mig_event_action(mig_tracker* tracker, unsigned index) {
    return tracker && index < tracker->events.size() ? tracker->engine->configuration()
                                                           .motions[tracker->events[index].motion]
                                                           .action.c_str()
                                                     : nullptr;
}
const char* mig_event_id(mig_tracker* tracker, unsigned index) {
    return tracker && index < tracker->events.size()
               ? tracker->engine->configuration().motions[tracker->events[index].motion].id.c_str()
               : nullptr;
}
unsigned mig_event_count(mig_tracker* tracker) {
    return tracker ? unsigned(tracker->events.size()) : 0;
}
int mig_active(mig_tracker* tracker, unsigned input) {
    return tracker && input < tracker->engine->configuration().motions.size() &&
           tracker->engine->action_active(input);
}
int mig_coordinate(mig_tracker* tracker, int landmark, int system, float* result) {
    if (!tracker || !result || system < 0 || system > 2) {
        return 0;
    }
    const auto point =
        mig::body_coordinate(tracker->frame, landmark, mig::CoordinateSystem(system));
    if (!point) {
        return 0;
    }
    result[0] = point->x;
    result[1] = point->y;
    result[2] = point->z;
    result[3] = point->confidence;
    return 1;
}
int mig_hand_coordinate(mig_tracker* tracker, int side, int joint, int system, float* result) {
#ifdef MIG_C_HANDS
    if (!tracker || !result || side < 0 || side > 1 || joint < 0 || joint >= 21 || system < 0 ||
        system > 2 || tracker->hand_indices[side] < 0) {
        return 0;
    }
    const auto point =
        mig::hands::hand_coordinate(tracker->hands.hands[tracker->hand_indices[side]],
                                    mig::hands::Landmark(joint), mig::CoordinateSystem(system));
    if (!point) {
        return 0;
    }
    result[0] = point->x;
    result[1] = point->y;
    result[2] = point->z;
    result[3] = 1;
    return 1;
#else
    return 0;
#endif
}
void mig_reset(mig_tracker* tracker, int recalibrate) {
    if (!tracker) {
        return;
    }
    if (recalibrate) {
        tracker->engine->recalibrate();
    } else {
        tracker->engine->restart();
    }
    clear_observations(*tracker);
}
int mig_camera_start(mig_tracker* tracker, const char* runtime, unsigned index) {
    return mig_camera_start_model(tracker, runtime, index, nullptr);
}
int mig_camera_start_model(mig_tracker* tracker, const char* runtime,
                           [[maybe_unused]] unsigned index, const char* model) {
    return guarded([&]() -> int {
        require(tracker && runtime, "Tracker or runtime is null");
#ifdef MIG_C_NATIVE
        auto variant = mig::native::PoseModel::Lite;
        if (model && *model) {
            const auto parsed = mig::native::parse_pose_model(model);
            require(parsed.has_value(), "Pose model must be lite, full or heavy");
            variant = *parsed;
        }
        mig_camera_stop(tracker);
        auto capture_runtime = std::make_unique<mig::native::CaptureRuntime>();
        auto pose = std::make_unique<mig::native::Pose>(
            runtime, tracker->engine->configuration().track_hands, variant);
        auto camera = std::make_unique<mig::native::Camera>(index);
        tracker->capture_runtime = std::move(capture_runtime);
        tracker->pose = std::move(pose);
        tracker->camera = std::move(camera);
        tracker->sequence = 0;
        mig_reset(tracker, 1);
        return 0;
#else
        throw std::runtime_error("Native capture was not enabled in this build");
#endif
    });
}
void mig_camera_stop(mig_tracker* tracker) {
    if (!tracker) {
        return;
    }
#ifdef MIG_C_NATIVE
    tracker->preview_ready = false;
    tracker->camera.reset();
    tracker->pose.reset();
    tracker->capture_runtime.reset();
#endif
    mig_reset(tracker, 0);
}
int mig_camera_poll(mig_tracker* tracker, mig_packet* packet) {
#ifdef MIG_C_NATIVE
    if (tracker) {
        tracker->preview_ready = false;
    }
#endif
    const auto result = guarded([&]() -> int {
        require(tracker && packet, "Tracker or packet is null");
#ifdef MIG_C_NATIVE
        require(bool(tracker->camera), "Camera is not started");
        if (!tracker->camera->read(tracker->video, false)) {
            mig_reset(tracker, 0);
            return 0;
        }
        const auto& video = tracker->video;
        const auto frame = tracker->pose->infer(video.rgb, video.width, video.height,
                                                video.capture_ms, ++tracker->sequence);
        *packet = {};
        packet->timestamp_ms = frame.timestamp_ms;
        packet->sequence = frame.sequence;
        packet->aspect = frame.aspect;
        for (unsigned joint = 0; joint < 33; ++joint) {
            const auto& point = frame.points[joint];
            float* target = packet->body + joint * 8;
            target[0] = point.position.x;
            target[1] = point.position.y;
            target[2] = point.depth_valid ? point.depth : NAN;
            target[3] = point.confidence;
            std::copy(point.world.begin(), point.world.end(), target + 4);
            target[7] = point.world_valid ? 1.f : 0.f;
        }
#if defined(MIG_NATIVE_HANDS) && defined(MIG_C_HANDS)
        const auto& hands = tracker->pose->hand_frame();
        packet->hand_count = unsigned(hands.count);
        for (unsigned index = 0; index < hands.count; ++index) {
            const auto& hand = hands.hands[index];
            if (hand.world_valid) {
                packet->hand_world_mask |= 1u << index;
            }
            for (unsigned joint = 0; joint < 21; ++joint) {
                float* target = packet->hands + (index * 21 + joint) * 6;
                const auto& image = hand.points[joint];
                const auto& world = hand.world_points[joint];
                target[0] = image.x;
                target[1] = image.y;
                target[2] = image.z;
                target[3] = world.x;
                target[4] = world.y;
                target[5] = world.z;
            }
        }
#endif
        if (update_packet(tracker, packet, mig::native::now_ms()) < 0) {
            return -1;
        }
        tracker->preview_ready = true;
        return 1;
#else
        throw std::runtime_error("Native capture was not enabled in this build");
#endif
    });
    if (result < 0 && tracker) {
        mig_reset(tracker, 0);
    }
    return result;
}
int mig_camera_image([[maybe_unused]] mig_tracker* tracker, const uint8_t** rgb, unsigned* width,
                     unsigned* height) {
    if (!rgb || !width || !height) {
        return 0;
    }
    *rgb = nullptr;
    *width = *height = 0;
#ifdef MIG_C_NATIVE
    if (tracker && tracker->preview_ready) {
        *rgb = tracker->video.rgb.data();
        *width = unsigned(tracker->video.width);
        *height = unsigned(tracker->video.height);
        return 1;
    }
#endif
    return 0;
}
}
