#pragma once
#include <algorithm>
#include <deque>
#include <mig/core/engine.hpp>
#include <queue>
#include <stdexcept>
namespace mig::ui {
struct Layer {
    int landmark;
    std::array<std::size_t, 4> counts{};
};
inline std::vector<Layer> layers(const Motion& input) {
    std::vector<Layer> result;
    const auto add = [&](const auto& constraints) {
        for (const auto& item : constraints) {
            auto found = std::find_if(result.begin(), result.end(), [&](const auto& layer) {
                return layer.landmark == item.landmark;
            });
            if (found == result.end()) {
                result.push_back({item.landmark});
                found = result.end() - 1;
            }
            ++found->counts[int(item.type)];
        }
    };
    add(input.constraints);
    for (const auto& step : input.steps) {
        add(step.constraints);
    }
    return result;
}
// Layers are a view of spatial rules, not a second persisted model. Reassign
// their identity across every scope without rebuilding cells or tolerance links.
inline void reassign_layer(Motion& input, int source, int target) {
    if (source < 0 || source >= 34 || target < 0 || target >= 34) {
        throw std::runtime_error("Select a valid layer body part");
    }
    const auto stack = layers(input);
    if (std::none_of(stack.begin(), stack.end(),
                     [&](const auto& layer) { return layer.landmark == source; })) {
        throw std::runtime_error("Select a layer to save");
    }
    if (source == target) {
        return;
    }
    if (std::any_of(stack.begin(), stack.end(),
                    [&](const auto& layer) { return layer.landmark == target; })) {
        throw std::runtime_error("That body part already has a layer. Choose another body part.");
    }
    const auto reassign = [&](auto& constraints) {
        for (auto& item : constraints) {
            if (item.landmark == source) {
                item.landmark = target;
            }
        }
    };
    reassign(input.constraints);
    for (auto& step : input.steps) {
        reassign(step.constraints);
    }
}
inline bool needs_fingers(const Motion& input) {
    const auto local = [](const auto& constraints) {
        return std::any_of(constraints.begin(), constraints.end(), [](const auto& item) {
            return !item.fingers.empty() || item.interaction.has_value();
        });
    };
    if (!input.fingers.empty() || local(input.constraints)) {
        return true;
    }
    return std::any_of(input.steps.begin(), input.steps.end(), [&](const auto& step) {
        return !step.fingers.empty() || local(step.constraints);
    });
}
struct BindingCounts {
    std::size_t input{}, steps{}, cells{}, interactions{};
};
inline BindingCounts binding_counts(const Motion& input) {
    BindingCounts result{input.fingers.size()};
    const auto local = [&](const auto& constraints) {
        for (const auto& item : constraints) {
            result.cells += item.fingers.size();
            result.interactions += item.priority == Priority::High && item.interaction.has_value();
        }
    };
    local(input.constraints);
    for (const auto& step : input.steps) {
        result.steps += step.fingers.size();
        local(step.constraints);
    }
    return result;
}
inline std::string binding_summary(const Motion& input) {
    const auto c = binding_counts(input);
    return "Fingers: " + std::to_string(c.input + c.steps + c.cells) + " (" +
           std::to_string(c.input) + " input, " + std::to_string(c.steps) + " step, " +
           std::to_string(c.cells) + " cell) | Signs: " + std::to_string(c.interactions);
}
inline std::string binding_description(const Motion& input) {
    std::string result = binding_summary(input) + "\r\nAction mode: " +
                         std::string(action_mode_names[int(input.action_mode)]) +
                         (input.action_mode == ActionMode::Repeat
                              ? " / interval " + std::to_string(input.repeat_interval_ms) + " ms"
                              : "") +
                         "\r\n\r\n";
    constexpr std::string_view names[]{"Thumb", "Index", "Middle", "Ring", "Pinky"};
    const auto fingers = [&](const auto& rules, const std::string& scope) {
        for (const auto& rule : rules) {
            result += scope + ": " + (rule.hand == HandSide::Left ? "Left " : "Right ") +
                      std::string(names[int(rule.finger)]) +
                      (rule.pose == FingerPose::Extended ? " extended" : " closed") + " / stable " +
                      std::to_string(rule.stable_ms) + " ms / grace " +
                      std::to_string(rule.grace_ms) + " ms\r\n";
        }
    };
    const auto cells = [&](const auto& rules, const std::string& scope) {
        for (const auto& cell : rules) {
            const auto label =
                scope + " / " + cell.id + " (" + std::string(landmark_name(cell.landmark)) + " [" +
                std::to_string(cell.cell.x) + "," + std::to_string(cell.cell.y) + "])";
            fingers(cell.fingers, label);
            if (cell.interaction) {
                const auto& sign = *cell.interaction;
                result += label + ": " + (sign.hand == HandSide::Left ? "Left " : "Right ") +
                          std::string(gesture_names[int(sign.gesture)]) + " / hold " +
                          std::to_string(sign.hold_ms) + " ms\r\n";
            }
        }
    };
    fingers(input.fingers, "Whole input");
    cells(input.constraints, "Whole input guards");
    for (const auto& step : input.steps) {
        fingers(step.fingers, step.id);
        cells(step.constraints, step.id);
    }
    return result;
}
inline const InputProgress& displayed_progress(const InputProgress& normal,
                                               const InputProgress& mirror) {
    const auto rank = [](const InputProgress& progress) {
        return progress.triggered ? 3 : progress.active ? 2 : progress.failed ? 1 : 0;
    };
    return rank(mirror) > rank(normal) ? mirror : normal;
}
inline std::string landmark_label(int landmark) {
    auto label = std::string(landmark_name(landmark));
    std::replace(label.begin(), label.end(), '_', ' ');
    if (!label.empty() && label[0] >= 'a' && label[0] <= 'z') {
        label[0] += 'A' - 'a';
    }
    return label;
}
// Presentation labels follow independent landmark lanes, never vector indices.
inline std::vector<std::string> constraint_labels(const Motion& input) {
    std::vector<std::string> labels;
    const auto marker = [](const SpatialConstraint& item) {
        return item.priority == Priority::Low             ? ""
               : item.type == ConstraintType::Forbidden   ? "X"
               : item.type == ConstraintType::Trigger     ? "T"
               : item.type == ConstraintType::Interaction ? "I"
                                                          : "R";
    };
    for (const auto& item : input.constraints) {
        labels.emplace_back(marker(item));
    }
    for (std::size_t s = 0; s < input.steps.size(); ++s) {
        std::array<int, 34> order{};
        for (const auto& item : input.steps[s].constraints) {
            std::string label = marker(item);
            if (input.steps[s].mode == StepMode::Ordered && item.priority == Priority::High &&
                item.type != ConstraintType::Forbidden) {
                label = std::to_string(item.order > 0 ? item.order : ++order[item.landmark]);
                if (input.steps.size() > 1) {
                    label = std::to_string(s + 1) + "." + label;
                }
            }
            labels.push_back(std::move(label));
        }
    }
    return labels;
}
template <class T> class History {
public:
    void commit(const T& before) {
        undo_.push_back(before);
        if (undo_.size() > 64) {
            undo_.pop_front();
        }
        redo_.clear();
    }
    bool undo(T& current) {
        return transfer(undo_, redo_, current);
    }
    bool redo(T& current) {
        return transfer(redo_, undo_, current);
    }

private:
    static bool transfer(std::deque<T>& source, std::deque<T>& target, T& current) {
        if (source.empty()) {
            return false;
        }
        target.push_back(current);
        current = std::move(source.back());
        source.pop_back();
        return true;
    }
    std::deque<T> undo_, redo_;
};
inline bool same_layer(const SpatialConstraint& a, const SpatialConstraint& b) {
    return a.landmark == b.landmark && a.type == b.type && a.priority == b.priority;
}
// Fill pointer sampling gaps without changing the order of a drawn path.
template <class Paint> void line(int x, int y, int end_x, int end_y, Paint paint) {
    const int dx = std::abs(end_x - x), dy = -std::abs(end_y - y);
    const int sx = x < end_x ? 1 : -1, sy = y < end_y ? 1 : -1;
    int error = dx + dy;
    for (;;) {
        paint(x, y);
        if (x == end_x && y == end_y) {
            break;
        }
        const int twice = 2 * error;
        if (twice >= dy) {
            error += dy;
            x += sx;
        }
        if (twice <= dx) {
            error += dx;
            y += sy;
        }
    }
}
inline void number_lane(std::vector<SpatialConstraint>& list, int landmark) {
    int maximum = 0;
    for (const auto& item : list) {
        if (item.landmark == landmark) {
            maximum = std::max(maximum, item.order);
        }
    }
    for (auto& item : list) {
        if (item.landmark == landmark && item.order == 0 && item.priority == Priority::High &&
            item.type != ConstraintType::Forbidden) {
            item.order = ++maximum;
        }
    }
}
inline void set_route_mode(Step& step, StepMode mode) {
    if (step.mode == mode) {
        return;
    }
    step.mode = mode;
    for (auto& zone : step.constraints) {
        zone.order = 0;
    }
    if (mode == StepMode::Ordered) {
        for (const auto& zone : step.constraints) {
            number_lane(step.constraints, zone.landmark);
        }
    }
}

inline void pencil(std::vector<SpatialConstraint>& list, SpatialConstraint brush, int x, int y,
                   bool replace_order = false) {
    if (x < Grid::min_cell || x >= Grid::max_cell || y < Grid::min_cell || y >= Grid::max_cell) {
        return;
    }
    brush.cell = {x, y};
    if (replace_order && brush.order > 0) {
        const auto existing = std::find_if(list.begin(), list.end(), [&](const auto& item) {
            return same_layer(item, brush) && item.cell == brush.cell &&
                   item.tolerance_for == brush.tolerance_for;
        });
        if (existing != list.end()) {
            existing->order = brush.order;
            return;
        }
    }
    if (std::any_of(list.begin(), list.end(), [&](const auto& item) {
            return same_layer(item, brush) && item.cell == brush.cell &&
                   item.tolerance_for == brush.tolerance_for && item.order == brush.order;
        })) {
        return;
    }
    if (list.size() >= 1024) {
        throw std::runtime_error("Maximum 1024 constraints per scope");
    }
    const auto position =
        brush.order > 0
            ? std::find_if(list.begin(), list.end(),
                           [&](const auto& item) {
                               return item.landmark == brush.landmark && item.order > brush.order;
                           })
            : list.end();
    list.insert(position, std::move(brush));
}
inline void bucket(std::vector<SpatialConstraint>& list, SpatialConstraint brush, int x, int y,
                   const std::string& prefix, bool replace_order = false) {
    if (x < Grid::min_cell || x >= Grid::max_cell || y < Grid::min_cell || y >= Grid::max_cell) {
        return;
    }
    std::array<bool, Grid::cell_count * Grid::cell_count> occupied{}, visited{};
    for (const auto& item : list) {
        if (!same_layer(item, brush)) {
            continue;
        }
        for (int cy = item.cell.y; cy < item.cell.y + item.cell.height; ++cy) {
            for (int cx = item.cell.x; cx < item.cell.x + item.cell.width; ++cx) {
                if (cx >= Grid::min_cell && cx < Grid::max_cell && cy >= Grid::min_cell &&
                    cy < Grid::max_cell) {
                    occupied[(cy - Grid::min_cell) * Grid::cell_count + cx - Grid::min_cell] = true;
                }
            }
        }
    }
    const bool target = occupied[(y - Grid::min_cell) * Grid::cell_count + x - Grid::min_cell];
    std::queue<std::array<int, 2>> pending;
    pending.push({x, y});
    int serial = 0;
    while (!pending.empty()) {
        auto point = pending.front();
        pending.pop();
        const int cx = point[0], cy = point[1];
        if (cx < Grid::min_cell || cx >= Grid::max_cell || cy < Grid::min_cell ||
            cy >= Grid::max_cell) {
            continue;
        }
        const auto index = (cy - Grid::min_cell) * Grid::cell_count + cx - Grid::min_cell;
        if (visited[index] || occupied[index] != target) {
            continue;
        }
        visited[index] = true;
        brush.id = prefix + std::to_string(serial++);
        pencil(list, brush, cx, cy, replace_order);
        for (const auto offset :
             {std::array{1, 0}, std::array{-1, 0}, std::array{0, 1}, std::array{0, -1}}) {
            pending.push({cx + offset[0], cy + offset[1]});
        }
    }
}
inline void contour(std::vector<SpatialConstraint>& list, const std::string& high_id,
                    const std::string& prefix) {
    const auto found = std::find_if(list.begin(), list.end(), [&](const auto& item) {
        return item.id == high_id && item.priority == Priority::High;
    });
    if (found == list.end()) {
        throw std::runtime_error("Select a High constraint");
    }
    const auto high = *found;
    auto brush = high;
    brush.priority = Priority::Low;
    brush.order = 0;
    brush.tolerance_for = high.id;
    int serial = 0;
    for (int y = high.cell.y - 1; y <= high.cell.y + high.cell.height; ++y) {
        for (int x = high.cell.x - 1; x <= high.cell.x + high.cell.width; ++x) {
            if (x >= high.cell.x && x < high.cell.x + high.cell.width && y >= high.cell.y &&
                y < high.cell.y + high.cell.height) {
                continue;
            }
            brush.id = prefix + std::to_string(serial++);
            pencil(list, brush, x, y);
        }
    }
}
} // namespace mig::ui
