#include "../../src/apps/authoring.hpp"
#include <iostream>
#include <mig/core/session.hpp>
#include <stdexcept>
using namespace mig;
void check(bool ok, const char* message) {
    if (!ok) {
        throw std::runtime_error(message);
    }
}
Frame frame(int time, bool thumb) {
    Frame result;
    result.timestamp_ms = result.sequence = time;
    for (int finger = 0; finger < 5; ++finger) {
        result.fingers[0][finger] = {thumb && finger == 0 ? 1.f : 0.f, 1};
    }
    return result;
}
int main() {
    try {
        Controls config;
        config.restart = {Gesture::Thumb, HandSide::Left};
        GestureControls controls(config);
        for (int t = 0; t <= 250; t += 50) {
            check(controls.update(frame(t, true)) == (t == 250 ? 1u : 0u),
                  "Gesture validates after debounce");
        }
        check(controls.suppressed(1249) && !controls.suppressed(1250),
              "Exactly one second from validation");
        for (int t = 300; t <= 2500; t += 50) {
            check(!controls.update(frame(t, true)), "Held gesture remains latched");
        }
        for (int t = 2550; t <= 2750; t += 50) {
            controls.update(frame(t, false));
        }
        for (int t = 2800; t <= 3050; t += 50) {
            check(controls.update(frame(t, true)) == (t == 3050 ? 1u : 0u), "Release and repeat");
        }
        ui::History<Configuration> history;
        Controls record_binding;
        record_binding.record_toggle = {Gesture::V, HandSide::Right};
        GestureControls slower(record_binding);
        for (int t : {0, 200, 400}) {
            Frame sign;
            sign.timestamp_ms = sign.sequence = t;
            for (int finger = 0; finger < 5; ++finger) {
                sign.fingers[1][finger] = {finger == 1 || finger == 2 ? .9f
                                           : finger == 0              ? .5f
                                                                      : .35f,
                                           1};
            }
            check(observed_gesture(sign.fingers[1]) == Gesture::V,
                  "Natural V accepts a partially curled thumb and closed ring/pinky");
            check(slower.update(sign) == (t == 400 ? unsigned(ControlAction::RecordToggle) : 0),
                  "Recording gesture validates at 5 fps instead of resetting every frame");
            if (t == 400) {
                sign.timestamp_ms = sign.sequence = 1600;
                check(slower.update(sign) == 0,
                      "Held V remains latched across a long interruption");
            }
        }
        Configuration document;
        history.commit(document);
        Motion input;
        input.id = "new";
        document.motions.push_back(input);
        check(history.undo(document) && document.motions.empty(), "Document Undo");
        check(history.redo(document) && document.motions.size() == 1, "Document Redo");
        std::vector<SpatialConstraint> list{{"high", 33, {4, 1}},
                                            {"other", 16, {4, 1}, ConstraintType::Forbidden}};
        const auto original = list;
        ui::contour(list, "high", "outline_");
        check(list.size() == 10 && list[1] == original[1],
              "Contour preserves overlapping landmark");
        for (std::size_t i = 2; i < list.size(); ++i) {
            check(list[i].tolerance_for == "high" && list[i].priority == Priority::Low,
                  "Low outline");
        }
        std::vector<SpatialConstraint> fill;
        SpatialConstraint brush{"brush", 15, {}};
        ui::bucket(fill, brush, 0, 0, "fill_");
        check(fill.size() == Grid::cell_count * Grid::cell_count, "Bucket fills connected grid");
        Recorder recorder;
        std::vector<int> entire_body;
        for (const auto& point : landmarks) {
            entire_body.push_back(point.index);
        }
        recorder.begin(entire_body);
        check(
            recorder.traces().size() == 34,
            "Full-body recording normalizes hand/wrist aliases before applying the landmark limit");
        recorder.begin({0, 15, 16});
        Grid grid;
        grid.valid = grid.calibrated = true;
        grid.scale = 0.05f;
        grid.center = {0.5f, 0.4f};
        for (int t = 0; t <= 100; t += 50) {
            auto observed = frame(t, false);
            observed.aspect = 1;
            for (int landmark : {0, 15, 16}) {
                observed.points[landmark] = {grid.metric({4.5f, 3.5f + t / 100.f}), 1};
            }
            recorder.sample(observed, grid);
        }
        for (const auto& selected :
             {std::vector<int>{-1}, std::vector<int>{15, 99}, std::vector<int>{}}) {
            bool rejected = false;
            try {
                recorder.begin(selected);
            } catch (const std::exception&) {
                rejected = true;
            }
            check(rejected && recorder.active() && recorder.traces().size() == 3 &&
                      recorder.traces()[0].landmark == 0 && recorder.traces()[0].points.size() == 3,
                  "Invalid recording selection preserves the active traces");
        }
        auto next = frame(150, false);
        next.aspect = 1;
        for (int landmark : {0, 15, 16}) {
            next.points[landmark] = {grid.metric({4.5f, 4.5f}), 1};
        }
        recorder.sample(next, grid);
        check(recorder.traces()[0].points.size() == 4,
              "Recording safely continues after a failed begin");
        recorder.remove_sample(3);
        recorder.stop();
        recorder.edit_point(0, 0, {3.5f, 3.5f});
        check(recorder.traces()[0].points[0][0] == 3.5f, "Manual raw trace editing");
        recorder.edit_point(0, 0, {4.5f, 3.5f});
        check(recorder.traces().size() == 3 && recorder.traces()[0].points.size() == 3,
              "Multi-landmark recording");
        auto converted = recorder.convert(input);
        check(converted.steps.size() == 2 && converted.steps[0].constraints.size() == 3,
              "Explicit conversion");
        recorder.trim(1, 3);
        check(recorder.traces()[0].points.size() == 2, "Temporary trace trim");
        recorder.discard();
        check(recorder.traces().empty(), "Discard temporary recording");
        Motion numbered;
        numbered.steps = {{"path", StepMode::Ordered}};
        numbered.steps[0].constraints = {
            {"left_start", 15, {6, 5}},
            {"right_start", 16, {2, 5}},
            {"avoid", 33, {4, 0}, ConstraintType::Forbidden},
            {"left_next", 15, {6, 4}},
            {"tolerance", 15, {7, 4}, ConstraintType::Required, Priority::Low, "left_next"},
            {"finish", 15, {6, 3}, ConstraintType::Trigger}};
        check(ui::constraint_labels(numbered) ==
                  std::vector<std::string>{"1", "1", "X", "2", "", "3"},
              "Centered order labels must follow each landmark lane and skip tolerance/guards");
        const auto stacked = ui::layers(numbered);
        check(stacked.size() == 3 && stacked[0].landmark == 15 && stacked[0].counts[0] == 3 &&
                  stacked[0].counts[2] == 1,
              "Layers group physical landmarks including tolerance");
        InputProgress successful, failed_mirror;
        successful.triggered = true;
        failed_mirror.failed = true;
        check(&ui::displayed_progress(successful, failed_mirror) == &successful,
              "A failed mirror attempt cannot hide a successful normal event");
        std::vector<std::pair<int, int>> sampled;
        ui::line(2, 5, 2, 2, [&](int x, int y) { sampled.emplace_back(x, y); });
        check(sampled == std::vector<std::pair<int, int>>{{2, 5}, {2, 4}, {2, 3}, {2, 2}},
              "Fast pointer strokes must preserve contiguous path order");
        std::cout << "Gestures, delay, latch, recording, tools and history passed\n";
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
