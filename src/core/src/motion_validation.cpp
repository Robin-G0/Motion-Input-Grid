#include "geometry.hpp"
#include <stdexcept>
#include <unordered_map>
#include <unordered_set>
namespace mig {
using namespace detail;
namespace {
void require(bool condition, const std::string& message) {
    if (!condition) {
        throw std::runtime_error(message);
    }
}
void text(const std::string& value) {
    require(value.find('\0') == std::string::npos, "Profile text cannot contain NUL");
}
void fingers(const std::vector<FingerConstraint>& list) {
    require(list.size() <= 10, "Too many finger constraints");
    std::array<bool, 10> used{};
    for (const auto& finger : list) {
        require(int(finger.hand) >= 0 && int(finger.hand) < 2 && int(finger.finger) >= 0 &&
                    int(finger.finger) < 5 && int(finger.pose) >= 0 && int(finger.pose) < 2 &&
                    finger.stable_ms >= 50 && finger.stable_ms <= 500 && finger.grace_ms >= 0 &&
                    finger.grace_ms <= 300,
                "Invalid finger constraint");
        const auto index = int(finger.hand) * 5 + int(finger.finger);
        require(!used[index], "Duplicate finger binding in one scope");
        used[index] = true;
    }
}
void constraints(const std::vector<SpatialConstraint>& list, std::unordered_set<std::string>& ids) {
    require(list.size() <= 1024, "Too many constraints");
    for (const auto& item : list) {
        text(item.id);
        text(item.tolerance_for);
        require(!item.id.empty() && item.id.size() <= 80 && ids.insert(item.id).second,
                "Constraint IDs must be unique within an input");
        landmark_name(item.landmark);
        const auto& cell = item.cell;
        require(cell.x >= Grid::min_cell && cell.y >= Grid::min_cell && cell.width > 0 &&
                    cell.height > 0 && cell.width <= Grid::cell_count &&
                    cell.height <= Grid::cell_count && cell.x <= Grid::max_cell - cell.width &&
                    cell.y <= Grid::max_cell - cell.height,
                "Constraint cell/zone outside the grid");
        require(int(item.type) >= 0 && int(item.type) < 4 && int(item.priority) >= 0 &&
                    int(item.priority) < 2,
                "Invalid type/priority");
        require(item.order >= 0 && item.order <= 1024 &&
                    (item.order == 0 ||
                     (item.priority == Priority::High && item.type != ConstraintType::Forbidden)),
                "Order groups require High Required/Trigger constraints");
        fingers(item.fingers);
        require(item.interaction.has_value() == (item.type == ConstraintType::Interaction),
                "Only Interaction cells require interaction settings");
        if (item.interaction) {
            const auto& interaction = *item.interaction;
            require(int(interaction.hand) >= 0 && int(interaction.hand) < 2 &&
                        int(interaction.gesture) >= 1 && int(interaction.gesture) <= 5 &&
                        interaction.hold_ms >= 0 &&
                        interaction.hold_ms <= maximum_interaction_hold_ms,
                    "Invalid Interaction hand, gesture or hold time");
        }
        if (item.priority == Priority::High) {
            require(item.tolerance_for.empty(),
                    "High priority cannot reference a tolerance target");
        } else if (item.type != ConstraintType::Forbidden) {
            require(!item.tolerance_for.empty(), "Low Required/Trigger needs tolerance_for");
        }
    }
    for (const auto& low : list) {
        if (low.tolerance_for.empty()) {
            continue;
        }
        require(std::any_of(list.begin(), list.end(),
                            [&](const auto& high) {
                                return high.id == low.tolerance_for &&
                                       high.priority == Priority::High &&
                                       high.landmark == low.landmark && high.type == low.type &&
                                       high.interaction == low.interaction;
                            }),
                "Tolerance target must match a High constraint in the same scope");
    }
}
} // namespace
void validate(const Configuration& config) {
    require(config.motions.size() <= 64, "Maximum 64 inputs");
    require(config.controls.post_gesture_delay_ms == 1000 && config.controls.validation_ms >= 100 &&
                config.controls.validation_ms <= 1000,
            "Invalid control timing");
    for (auto binding :
         {config.controls.restart, config.controls.recalibrate, config.controls.record_toggle}) {
        require(int(binding.gesture) >= 0 && int(binding.gesture) <= 5 && int(binding.hand) >= 0 &&
                    int(binding.hand) < 2,
                "Invalid control binding");
    }
    const std::array bindings{config.controls.restart, config.controls.recalibrate,
                              config.controls.record_toggle};
    for (std::size_t a = 0; a < bindings.size(); ++a) {
        for (std::size_t b = a + 1; b < bindings.size(); ++b) {
            require(bindings[a].gesture == Gesture::None || bindings[a] != bindings[b],
                    "Each hand gesture can control only one action; choose a different binding");
        }
    }
    std::unordered_set<std::string> input_ids;
    for (const auto& input : config.motions) {
        text(input.id);
        text(input.name);
        text(input.action);
        require(!input.id.empty() && input.id.size() <= 80 && input_ids.insert(input.id).second,
                "Input IDs must be nonempty and unique");
        require(input.name.size() <= 80 && input.action.size() <= 80 &&
                    input.max_duration_ms >= 0 && input.max_duration_ms <= 10000 &&
                    input.cooldown_ms >= 0 && input.cooldown_ms <= 10000 && int(input.space) >= 0 &&
                    int(input.space) < 2,
                "Invalid input parameters");
        try {
            validate_keyboard(input.keyboard);
        } catch (const std::exception& error) {
            throw std::runtime_error("Input " + input.id + ": " + error.what());
        }
        require(int(input.action_mode) >= 0 && int(input.action_mode) <= 2 &&
                    input.repeat_interval_ms >= 20 && input.repeat_interval_ms <= 60000,
                "Invalid action mode or repeat interval (20..60000 ms)");
        require(input.action_mode != ActionMode::Hold || input.keyboard.empty() ||
                    input.keyboard.back().type == KeyboardActionType::Chord,
                "Hold requires a final shortcut; preceding text/actions run once");
        require(!input.steps.empty() && input.steps.size() <= 64,
                "Generic inputs need 1..64 steps");
        fingers(input.fingers);
        std::unordered_set<std::string> constraint_ids, step_ids;
        constraints(input.constraints, constraint_ids);
        for (const auto& item : input.constraints) {
            require(!is_trigger(item.type) && item.order == 0,
                    "Triggers and order groups belong to steps");
        }
        int triggers = 0;
        for (const auto& step : input.steps) {
            text(step.id);
            require(!step.id.empty() && step.id.size() <= 80 && step_ids.insert(step.id).second &&
                        !step.constraints.empty() && int(step.mode) >= 0 && int(step.mode) < 3 &&
                        step.hold_ms >= 0 && step.hold_ms <= 1000,
                    "Invalid step");
            constraints(step.constraints, constraint_ids);
            fingers(step.fingers);
            std::array<int, 34> last_order{};
            std::array<bool, 34> implicit{};
            std::unordered_map<std::uint64_t, ConstraintType> groups;
            for (const auto& item : step.constraints) {
                if (item.priority != Priority::High || item.type == ConstraintType::Forbidden) {
                    continue;
                }
                if (item.order == 0) {
                    implicit[item.landmark] = true;
                } else {
                    require(step.mode == StepMode::Ordered, "Order groups require an ordered step");
                    const auto key = (std::uint64_t(item.landmark) << 32) | unsigned(item.order);
                    const auto group = groups.emplace(key, item.type).first;
                    require(group->second == item.type,
                            "Alternative regions must have the same constraint type");
                    last_order[item.landmark] = item.order;
                }
            }
            for (int landmark = 0; landmark < 34; ++landmark) {
                require(!implicit[landmark] || last_order[landmark] == 0,
                        "A landmark lane cannot mix automatic and explicit orders");
            }
            std::unordered_set<std::string> trigger_groups;
            bool actionable = false;
            for (const auto& item : step.constraints) {
                if (item.priority == Priority::High && item.type != ConstraintType::Forbidden) {
                    actionable = true;
                }
                if (item.priority == Priority::High && is_trigger(item.type)) {
                    if (item.order == 0 || trigger_groups
                                               .insert(std::to_string(item.landmark) + ":" +
                                                       std::to_string(item.order))
                                               .second) {
                        ++triggers;
                    }
                }
            }
            require(actionable, "Each step needs a High Required or Trigger");
        }
        require(triggers <= 1 && constraint_ids.size() <= 4096, "Too many triggers/constraints");
        require(input.recordings.size() <= 34, "Too many recordings");
        for (const auto& trace : input.recordings) {
            landmark_name(trace.landmark);
            require(trace.points.size() <= 2048, "Recorded trace too long");
            for (auto point : trace.points) {
                require(std::isfinite(point[0]) && std::isfinite(point[1]) &&
                            point[0] >= Grid::min_cell && point[0] < Grid::max_cell &&
                            point[1] >= Grid::min_cell && point[1] < Grid::max_cell,
                        "Recorded point outside grid");
            }
        }
    }
}
} // namespace mig
