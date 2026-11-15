#include "geometry.hpp"
#include "scopes.hpp"
#include <limits>
namespace mig {
using namespace detail;
Point body_point(const Frame& frame, int landmark) noexcept {
    if (landmark >= 0 && landmark < 33) {
        return frame.points[landmark];
    }
    if (landmark == 33) {
        if (usable(frame.points[7]) && usable(frame.points[8])) {
            const auto& a = frame.points[7];
            const auto& b = frame.points[8];
            Point head{(a.position + b.position) * .5f, std::min(a.confidence, b.confidence)};
            head.depth_valid = a.depth_valid && b.depth_valid;
            head.depth = head.depth_valid ? (a.depth + b.depth) * .5f : 0;
            head.world_valid = a.world_valid && b.world_valid;
            if (head.world_valid) {
                for (int axis = 0; axis < 3; ++axis) {
                    head.world[axis] = (a.world[axis] + b.world[axis]) * .5f;
                }
            }
            return head;
        }
        return frame.points[0];
    }
    return {};
}
const Engine::Projection& Engine::project_frame(const Frame& frame, const Grid& basis, bool body,
                                                bool mirror) noexcept {
    const auto index = std::size_t(body) * 2 + std::size_t(mirror);
    if (!projection_ready_[index]) {
        auto& projection = projections_[index];
        for (int landmark = 0; landmark < 34; ++landmark) {
            const auto point = body_point(frame, mirror ? mirrored_landmark(landmark) : landmark);
            projection.visible[landmark] = usable(point);
            projection.metric[landmark] = {point.position.x * frame.aspect, point.position.y};
            projection.local[landmark] = basis.local(projection.metric[landmark]);
            if (mirror) {
                projection.local[landmark].x = 9.f - projection.local[landmark].x;
            }
        }
        projection_ready_[index] = true;
    }
    return projections_[index];
}
namespace {
bool inside(Vec2 point, const Cell& cell) {
    return point.x >= cell.x && point.x < cell.x + cell.width && point.y >= cell.y &&
           point.y < cell.y + cell.height;
}
float crossing(Vec2 start, Vec2 end, const Cell& cell) {
    float lower = 0, upper = 1;
    const auto slab = [&](float origin, float delta, float minimum, float maximum) {
        if (std::abs(delta) < 1e-6f) {
            return origin >= minimum && origin < maximum;
        }
        float a = (minimum - origin) / delta, b = (maximum - origin) / delta;
        if (a > b) {
            std::swap(a, b);
        }
        lower = std::max(lower, a);
        upper = std::min(upper, b);
        return lower <= upper;
    };
    if (!slab(start.x, end.x - start.x, float(cell.x), float(cell.x + cell.width)) ||
        !slab(start.y, end.y - start.y, float(cell.y), float(cell.y + cell.height))) {
        return -1;
    }
    return lower;
}
} // namespace
void Engine::recognise_constraints(const Frame& frame, bool sweep_continuous,
                                   bool contact_continuous) noexcept {
    const auto time = frame.timestamp_ms;
    projection_ready_.fill(false);
    for (std::size_t motion_index = 0; motion_index < config_.motions.size(); ++motion_index) {
        const auto& input = config_.motions[motion_index];
        bool emitted = false;
        for (int variant = 0; variant < (input.mirror ? 2 : 1); ++variant) {
            auto& candidate = generic_[motion_index][variant];
            const bool continuous =
                candidate.interaction_only ? contact_continuous : sweep_continuous;
            auto& progress = candidate.progress;
            if (!candidate.locked) {
                std::fill(progress.interaction_elapsed_ms.begin(),
                          progress.interaction_elapsed_ms.end(), 0);
            }
            if (!continuous) {
                std::fill(candidate.interaction_since.begin(), candidate.interaction_since.end(),
                          -1);
            }
            const bool mirror = variant != 0;
            const auto& basis = input.space == CoordinateSpace::Body ? grid_ : reference_grid_;
            const auto& projection =
                project_frame(frame, basis, input.space == CoordinateSpace::Body, mirror);
            const auto& local = projection.local;
            const auto& metric = projection.metric;
            const auto& visible = projection.visible;
            for (auto& timer : candidate.finger_timers) {
                const auto& rule = timer.rule;
                const auto observation =
                    frame.fingers[mirror ? 1 - int(rule.hand) : int(rule.hand)][int(rule.finger)];
                const bool match =
                    std::isfinite(observation.confidence) && observation.confidence >= 0.6f &&
                    observation.confidence <= 1 && std::isfinite(observation.extension) &&
                    observation.extension >= 0 && observation.extension <= 1 &&
                    (rule.pose == FingerPose::Extended ? observation.extension >= 0.7f
                                                       : observation.extension <= 0.3f);
                if (match) {
                    if (timer.since < 0 || !continuous) {
                        timer.since = time;
                    }
                    if (time - timer.since >= rule.stable_ms) {
                        timer.last_valid = time;
                    }
                } else {
                    timer.since = -1;
                }
            }
            const auto finger_match = [&](const std::vector<FingerConstraint>& fingers) {
                if (fingers.empty()) {
                    return true;
                }
                const auto found = candidate.finger_scopes.find(&fingers);
                if (found == candidate.finger_scopes.end()) {
                    return false;
                }
                for (auto index : found->second) {
                    const auto& timer = candidate.finger_timers[index];
                    const bool stable =
                        timer.since >= 0 && time - timer.since >= timer.rule.stable_ms;
                    const bool grace = (progress.active || progress.output_active) &&
                                       timer.last_valid >= candidate.started &&
                                       time - timer.last_valid <= timer.rule.grace_ms;
                    if (!stable && !grace) {
                        return false;
                    }
                }
                return true;
            };
            const auto hit = [&](const SpatialConstraint& constraint, bool sweep) {
                const auto landmark = constraint.landmark;
                if (!visible[landmark]) {
                    return -1.f;
                }
                if (inside(local[landmark], constraint.cell)) {
                    return 1.f;
                }
                if (!sweep || !sweep_continuous || !candidate.previous_valid[landmark]) {
                    return -1.f;
                }
                auto previous = basis.local(candidate.previous[landmark]);
                if (mirror) {
                    previous.x = 9.f - previous.x;
                }
                const float travel = distance(previous, local[landmark]);
                const float physical =
                    distance(candidate.previous[landmark], metric[landmark]) / basis.scale;
                if (physical < 0.025f || travel > 2.8f || physical > 2.8f) {
                    return -1.f;
                }
                return crossing(previous, local[landmark], constraint.cell);
            };
            // Reservation is based on current occupancy/sign, not on command debounce.
            // Keep it while latched so a global V command cannot recalibrate a held input.
            for (std::size_t index = 0; index < candidate.constraints.size(); ++index) {
                const auto& region = *candidate.constraints[index];
                if (!region.interaction || region.priority != Priority::High) {
                    continue;
                }
                const auto& settings = *region.interaction;
                const auto side = mirror ? 1 - int(settings.hand) : int(settings.hand);
                bool occupied = hit(region, false) >= 0;
                for (auto alternate : candidate.alternatives[index]) {
                    occupied |= hit(*candidate.constraints[alternate], false) >= 0;
                }
                if (occupied && gesture_matches(frame.fingers[side], settings.gesture,
                                                frame.hand_contacts[side])) {
                    interaction_hands_ |= 1u << side;
                }
            }
            const auto first_reached = [&] {
                for (const auto& constraint : input.steps[0].constraints) {
                    if (constraint.priority == Priority::High &&
                        constraint.type != ConstraintType::Forbidden &&
                        hit(constraint, false) >= 0) {
                        return true;
                    }
                    if (constraint.priority == Priority::Low &&
                        constraint.type != ConstraintType::Forbidden &&
                        hit(constraint, false) >= 0 && finger_match(constraint.fingers)) {
                        return true;
                    }
                }
                return false;
            };
            const auto sustaining = [&] {
                const auto step = progress.step;
                bool sustained = continuous && finger_match(input.fingers) &&
                                 finger_match(input.steps[step].fingers);
                for (std::size_t index = 0; index < candidate.constraints.size(); ++index) {
                    const auto& guard = *candidate.constraints[index];
                    if (guard.type == ConstraintType::Forbidden &&
                        (index < candidate.offsets[0] || (index >= candidate.offsets[step] &&
                                                          index < candidate.offsets[step + 1])) &&
                        (!visible[guard.landmark] || hit(guard, true) >= 0)) {
                        sustained = false;
                    }
                }
                for (auto root : candidate.sustain_groups[step]) {
                    bool occupied = false;
                    for (auto index : candidate.groups[root]) {
                        const auto& region = *candidate.constraints[index];
                        if (!finger_match(region.fingers)) {
                            continue;
                        }
                        bool contact = hit(region, false) >= 0;
                        for (auto low : candidate.alternatives[index]) {
                            contact |= hit(*candidate.constraints[low], false) >= 0 &&
                                       finger_match(candidate.constraints[low]->fingers);
                        }
                        if (region.interaction) {
                            const auto& sign = *region.interaction;
                            const int side = mirror ? 1 - int(sign.hand) : int(sign.hand);
                            contact &= gesture_matches(frame.fingers[side], sign.gesture,
                                                       frame.hand_contacts[side]);
                        }
                        occupied |= contact;
                    }
                    sustained &= occupied;
                }
                return sustained;
            };
            if (progress.output_active) {
                progress.output_active = sustaining();
            }
            const auto terminal_released = [&] {
                if (candidate.completed_step < 0) {
                    return false;
                }
                const auto& groups = candidate.sustain_groups[candidate.completed_step];
                if (groups.empty()) {
                    return false;
                }
                for (auto root : groups) {
                    for (auto index : candidate.groups[root]) {
                        const auto& region = *candidate.constraints[index];
                        // A lost landmark or sign is not proof of leaving the finish.
                        if (!visible[region.landmark] || hit(region, false) >= 0) {
                            return false;
                        }
                        for (auto alternative : candidate.alternatives[index]) {
                            const auto& low = *candidate.constraints[alternative];
                            if (!visible[low.landmark] || hit(low, false) >= 0) {
                                return false;
                            }
                        }
                    }
                }
                return true;
            };
            if (!continuous && progress.active) {
                progress.failed = true;
                progress.active = false;
                candidate.locked = true;
            }
            if (candidate.locked && !progress.output_active && !test_mode_ &&
                (!first_reached() || terminal_released())) {
                std::fill(progress.constraints.begin(), progress.constraints.end(),
                          ConstraintStatus::Missing);
                progress.step = 0;
                progress.failed = progress.triggered = progress.active = false;
                candidate.locked = false;
                candidate.completed_step = -1;
                candidate.held_since = -1;
                std::fill(candidate.interaction_since.begin(), candidate.interaction_since.end(),
                          -1);
            }
            // Observe release during cooldown, but never retain or emit its path.
            if (time < candidate.ready_after) {
                candidate.previous_valid.fill(false);
                continue;
            }
            if (!candidate.locked && !progress.active && first_reached() &&
                finger_match(input.fingers)) {
                progress.active = true;
                candidate.started = time;
            }
            if (progress.active) {
                progress.fingers_valid = finger_match(input.fingers);
                if ((!progress.fingers_valid && !candidate.interaction_only) ||
                    (input.max_duration_ms > 0 &&
                     time - candidate.started > input.max_duration_ms)) {
                    progress.failed = true;
                }

                const bool globals = evaluate_scope(candidate, visible, hit, finger_match, 0,
                                                    candidate.offsets[0], StepMode::Visited);
                const auto step_index = progress.step;
                const auto& step = input.steps[step_index];
                const auto begin = candidate.offsets[step_index],
                           end = candidate.offsets[step_index + 1];
                const bool step_fingers = finger_match(step.fingers);
                progress.fingers_valid = progress.fingers_valid && step_fingers;
                const bool ready =
                    evaluate_scope(candidate, visible, hit, finger_match, begin, end, step.mode) &&
                    globals && step_fingers && progress.fingers_valid;
                if (ready) {
                    if (candidate.held_since < 0) {
                        candidate.held_since = time;
                    }
                } else {
                    candidate.held_since = -1;
                }
                const bool held = ready && time - candidate.held_since >= step.hold_ms;
                bool has_trigger = false, trigger = false;
                for (std::size_t index = begin; index < end; ++index) {
                    const auto& constraint = *candidate.constraints[index];
                    if (!is_trigger(constraint.type) || constraint.priority != Priority::High) {
                        continue;
                    }
                    has_trigger = true;
                    const bool interaction = constraint.type == ConstraintType::Interaction;
                    const bool sweep = !interaction && step.mode != StepMode::Simultaneous;
                    bool reached = hit(constraint, sweep) >= 0;
                    const auto settings = constraint.interaction.value_or(Interaction{});
                    const auto side = mirror ? 1 - int(settings.hand) : int(settings.hand);
                    const bool sign =
                        !interaction || gesture_matches(frame.fingers[side], settings.gesture,
                                                        frame.hand_contacts[side]);
                    bool tolerance_fired = false;
                    for (const auto alternative : candidate.alternatives[index]) {
                        const auto& low = *candidate.constraints[alternative];
                        if (low.priority == Priority::Low && low.tolerance_for == constraint.id &&
                            hit(low, sweep) >= 0 && finger_match(low.fingers)) {
                            reached = true;
                            if (held && sign && finger_match(constraint.fingers) && !interaction) {
                                progress.constraints[alternative] = ConstraintStatus::Triggered;
                            }
                            tolerance_fired = true;
                        }
                    }
                    const bool eligible = held && reached && sign &&
                                          finger_match(constraint.fingers) && !progress.failed;
                    auto& since = candidate.interaction_since[index];
                    if (!eligible) {
                        since = -1;
                        if (interaction) {
                            progress.constraints[index] =
                                !visible[constraint.landmark] ? ConstraintStatus::LandmarkLost
                                : reached && !gesture_observations_known(frame.fingers[side],
                                                                         settings.gesture,
                                                                         frame.hand_contacts[side])
                                    ? ConstraintStatus::HandMissing
                                : reached && !sign ? ConstraintStatus::SignMismatch
                                : reached && !finger_match(constraint.fingers)
                                    ? ConstraintStatus::FingerInvalid
                                    : ConstraintStatus::Missing;
                        }
                    } else if (since < 0) {
                        since = time;
                    }
                    if (eligible && interaction) {
                        progress.interaction_elapsed_ms[index] =
                            int(std::min<std::int64_t>(time - since, settings.hold_ms));
                        progress.constraints[index] = ConstraintStatus::Holding;
                    }
                    if (eligible && (!interaction || time - since >= settings.hold_ms)) {
                        progress.constraints[index] = ConstraintStatus::Triggered;
                        if (interaction && tolerance_fired) {
                            for (auto alternative : candidate.alternatives[index]) {
                                const auto& low = *candidate.constraints[alternative];
                                if (hit(low, false) >= 0 && finger_match(low.fingers)) {
                                    progress.constraints[alternative] = ConstraintStatus::Triggered;
                                }
                            }
                        }
                        trigger = true;
                    }
                }
                if (progress.failed) {
                    candidate.locked = true;
                    progress.active = false;
                } else if (trigger ||
                           (held && !has_trigger && step_index + 1 == input.steps.size())) {
                    progress.triggered = true;
                    progress.output_active = sustaining();
                    progress.active = false;
                    candidate.locked = true;
                    if (!emitted) {
                        events_.push_back({motion_index, time});
                        emitted = true;
                        for (auto& paired : generic_[motion_index]) {
                            paired.ready_after = time + input.cooldown_ms;
                            paired.completed_step = int(step_index);
                        }
                    }
                    // Lock the opposite variant too; one configured input emits once.
                    generic_[motion_index][1 - variant].locked = true;
                } else if (held && !has_trigger) {
                    ++progress.step;
                    candidate.held_since = -1;
                }
            }
            for (int landmark = 0; landmark < 34; ++landmark) {
                candidate.previous[landmark] = metric[landmark];
                candidate.previous_valid[landmark] = visible[landmark];
            }
        }
    }
}
} // namespace mig
