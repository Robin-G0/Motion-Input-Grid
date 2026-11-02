#include "geometry.hpp"
#include <algorithm>
#include <cmath>
#include <mig/core/engine.hpp>
#include <stdexcept>

namespace mig {
using namespace detail;
Engine::Engine(Configuration c) : config_(std::move(c)) {
    validate(config_);
    events_.reserve(config_.motions.size());
    generic_.resize(config_.motions.size());
    for (std::size_t i = 0; i < config_.motions.size(); ++i) {
        for (int mirrored = 0; mirrored < 2; ++mirrored) {
            auto& candidate = generic_[i][mirrored];
            candidate.progress.mirrored = mirrored != 0;
            compile_constraints(candidate, config_.motions[i]);
            compile_groups(candidate);
            compile_sustain(candidate, config_.motions[i]);
            compile_fingers(candidate, config_.motions[i]);
        }
    }
    restart();
}
void Engine::compile_constraints(GenericCandidate& candidate, const Motion& input) {
    for (const auto& constraint : input.constraints) {
        candidate.constraints.push_back(&constraint);
    }
    for (const auto& step : input.steps) {
        candidate.offsets.push_back(candidate.constraints.size());
        for (const auto& constraint : step.constraints) {
            candidate.constraints.push_back(&constraint);
        }
    }
    candidate.offsets.push_back(candidate.constraints.size());
    candidate.progress.constraints.resize(candidate.constraints.size());
    candidate.progress.interaction_elapsed_ms.resize(candidate.constraints.size());
    candidate.interaction_only = std::all_of(
        candidate.constraints.begin(), candidate.constraints.end(), [](const auto* region) {
            return region->type == ConstraintType::Interaction ||
                   region->type == ConstraintType::Forbidden;
        });
    candidate.interaction_since.resize(candidate.constraints.size(), -1);
    candidate.alternatives.resize(candidate.constraints.size());
    std::unordered_map<std::string, std::size_t> ids;
    for (std::size_t index = 0; index < candidate.constraints.size(); ++index) {
        ids.emplace(candidate.constraints[index]->id, index);
    }
    for (std::size_t index = 0; index < candidate.constraints.size(); ++index) {
        const auto& target = candidate.constraints[index]->tolerance_for;
        if (!target.empty()) {
            candidate.alternatives[ids.at(target)].push_back(index);
        }
    }
}
void Engine::compile_groups(GenericCandidate& candidate) {
    candidate.groups.resize(candidate.constraints.size());
    candidate.group_root.resize(candidate.constraints.size());
    candidate.evaluation_order.resize(candidate.constraints.size());
    for (std::size_t scope = 0; scope < candidate.offsets.size(); ++scope) {
        const auto begin = scope == 0 ? 0 : candidate.offsets[scope - 1];
        const auto end = candidate.offsets[scope];
        std::unordered_map<std::uint64_t, std::size_t> roots;
        std::array<std::vector<std::size_t>, 34> lanes, slots;
        for (auto index = begin; index < end; ++index) {
            const auto& item = *candidate.constraints[index];
            auto root = index;
            if (item.order > 0) {
                const auto key = (std::uint64_t(item.landmark) << 32) | unsigned(item.order);
                root = roots.emplace(key, index).first->second;
                if (root == index) {
                    lanes[item.landmark].push_back(index);
                    slots[item.landmark].push_back(index);
                }
            }
            candidate.group_root[index] = root;
            candidate.groups[root].push_back(index);
            candidate.evaluation_order[index] = index;
        }
        for (int landmark = 0; landmark < 34; ++landmark) {
            auto& lane = lanes[landmark];
            std::sort(lane.begin(), lane.end(), [&](auto a, auto b) {
                return candidate.constraints[a]->order < candidate.constraints[b]->order;
            });
            for (std::size_t slot = 0; slot < lane.size(); ++slot) {
                candidate.evaluation_order[slots[landmark][slot]] = lane[slot];
            }
        }
    }
}
void Engine::compile_sustain(GenericCandidate& candidate, const Motion& input) {
    candidate.sustain_groups.resize(input.steps.size());
    for (std::size_t step = 0; step < candidate.sustain_groups.size(); ++step) {
        auto& targets = candidate.sustain_groups[step];
        std::array<std::size_t, 34> terminal{};
        terminal.fill(candidate.constraints.size());
        bool firing = false;
        for (auto slot = candidate.offsets[step]; slot < candidate.offsets[step + 1]; ++slot) {
            const auto index = candidate.evaluation_order[slot];
            const auto& region = *candidate.constraints[index];
            if (region.priority != Priority::High || region.type == ConstraintType::Forbidden ||
                candidate.group_root[index] != index) {
                continue;
            }
            if (is_trigger(region.type)) {
                if (!firing) {
                    targets.clear();
                }
                firing = true;
                targets.push_back(index);
            } else if (!firing) {
                terminal[region.landmark] = index;
                if (input.steps[step].mode != StepMode::Ordered) {
                    targets.push_back(index);
                }
            }
        }
        if (!firing && input.steps[step].mode == StepMode::Ordered) {
            for (auto index : terminal) {
                if (index < candidate.constraints.size()) {
                    targets.push_back(index);
                }
            }
        }
    }
}
void Engine::compile_fingers(GenericCandidate& candidate, const Motion& input) {
    const auto compile_fingers = [&](const std::vector<FingerConstraint>& fingers) {
        if (fingers.empty()) {
            return;
        }
        auto& indices = candidate.finger_scopes[&fingers];
        for (const auto& rule : fingers) {
            const auto found =
                std::find_if(candidate.finger_timers.begin(), candidate.finger_timers.end(),
                             [&](const auto& timer) { return timer.rule == rule; });
            const auto index = std::size_t(found - candidate.finger_timers.begin());
            if (found == candidate.finger_timers.end()) {
                candidate.finger_timers.push_back({rule});
            }
            indices.push_back(index);
        }
    };
    compile_fingers(input.fingers);
    for (const auto& step : input.steps) {
        compile_fingers(step.fingers);
    }
    for (const auto* constraint : candidate.constraints) {
        compile_fingers(constraint->fingers);
    }
}
void Engine::recalibrate() noexcept {
    grid_ = {};
    reference_grid_ = {};
    sample_count_ = 0;
    width_cursor_ = 0;
    stable_since_ = -1;
    last_time_ = -1;
    sequence_ = 0;
    restart();
}
void Engine::restart() noexcept {
    interaction_hands_ = 0;
    events_.clear();
    for (auto& variants : generic_) {
        for (auto& candidate : variants) {
            std::fill(candidate.progress.constraints.begin(), candidate.progress.constraints.end(),
                      ConstraintStatus::Missing);
            candidate.progress.step = 0;
            candidate.progress.active = candidate.progress.failed = candidate.progress.triggered =
                false;
            candidate.progress.fingers_valid = true;
            candidate.progress.output_active = false;
            std::fill(candidate.progress.interaction_elapsed_ms.begin(),
                      candidate.progress.interaction_elapsed_ms.end(), 0);
            candidate.previous_valid.fill(false);
            std::fill(candidate.interaction_since.begin(), candidate.interaction_since.end(), -1);
            for (auto& timer : candidate.finger_timers) {
                timer.since = timer.last_valid = -1;
            }
            candidate.started = candidate.held_since = -1;
            candidate.ready_after = 0;
            candidate.locked = false;
            candidate.completed_step = -1;
        }
    }
}
void Engine::lose_tracking() noexcept {
    for (auto& variants : generic_) {
        for (auto& candidate : variants) {
            candidate.progress.output_active = false;
            std::fill(candidate.interaction_since.begin(), candidate.interaction_since.end(), -1);
        }
    }
    grid_.valid = false;
    reference_grid_.valid = false;
    sample_count_ = 0;
    width_cursor_ = 0;
    stable_since_ = -1;
}
std::span<const Event> Engine::update(const Frame& f, std::int64_t now) noexcept {
    interaction_hands_ = 0;
    events_.clear();
    // A future or stale packet must not poison the monotonic source watermark.
    if (f.timestamp_ms < 0 || now < f.timestamp_ms || now - f.timestamp_ms > 250) {
        lose_tracking();
        return events_;
    }
    if (f.timestamp_ms <= last_time_ || (last_time_ >= 0 && f.sequence <= sequence_)) {
        return events_;
    }
    const auto previous_time = last_time_;
    last_time_ = f.timestamp_ms;
    sequence_ = f.sequence;
    if (!std::isfinite(f.aspect) || f.aspect < 0.2f || f.aspect > 5 || !usable(f.points[11]) ||
        !usable(f.points[12])) {
        lose_tracking();
        return events_;
    }
    const bool contact_continuity =
        grid_.valid && previous_time >= 0 && f.timestamp_ms - previous_time <= 500;
    const bool continuity =
        grid_.valid && previous_time >= 0 && f.timestamp_ms - previous_time <= 180;
    if (!update_grid(f, previous_time)) {
        return events_;
    }
    recognise_constraints(f, continuity, contact_continuity);
    return events_;
}
} // namespace mig
