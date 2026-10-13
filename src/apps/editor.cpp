#include "app.hpp"
#include <cmath>
namespace mig::app {
void App::select_motion() {
    if (config.motions.empty()) {
        selected = 0;
        return;
    }
    selected = std::min(selected, config.motions.size() - 1);
}
void App::refresh_list() {
    const bool hands = config.track_hands;
    SetDlgItemTextW(window, TrackHands, hands ? L"Hands: On" : L"Hands: Off");
    if (edit_window) {
        SetDlgItemTextW(edit_window, TrackHands, hands ? L"Hands: On" : L"Hands: Off");
    }
    const auto list = GetDlgItem(window, MotionList);
    SendMessageW(list, LB_RESETCONTENT, 0, 0);
    for (const auto& input : config.motions) {
        const auto name = wide(input.name.empty() ? input.id : input.name);
        SendMessageW(list, LB_ADDSTRING, 0, reinterpret_cast<LPARAM>(name.c_str()));
    }
    select_motion();
    if (!config.motions.empty()) {
        SendMessageW(list, LB_SETCURSEL, selected, 0);
    }
    InvalidateRect(window, nullptr, FALSE);
}
void App::change_document(Configuration proposed) {
    validate(proposed);
    if (proposed == config) {
        return;
    }
#ifndef MIG_NATIVE_HANDS
    if (!editor && proposed.track_hands) {
        throw std::runtime_error("This controller was built without hand inference");
    }
#endif
    release_keys();
    {
        std::lock_guard lock(state_mutex);
        document_history.commit(config);
        config = std::move(proposed);
        testing = -1;
        pending_events.clear();
        triggered_inputs.clear();
        ++profile_revision;
        reload = true;
    }
    refresh_list();
}
void App::undo(bool redo, bool draft_scope) {
    if (studio_view == 2) {
        return;
    }
    if (draft_scope && edit_window) {
        bool changed;
        {
            std::lock_guard lock(state_mutex);
            EditorDocument value{draft, reviewed_recording};
            changed = redo ? draft_history.redo(value) : draft_history.undo(value);
            if (changed) {
                draft = std::move(value.input);
                reviewed_recording = std::move(value.recording);
            }
        }
        if (changed) {
            typing_control = 0;
            selected_constraint = selected_finger = -1;
            region_selection.clear();
            editing_layer = -1;
            const auto stack = ui::layers(draft);
            const auto brush = landmarks[selection(edit_window, Members)].index;
            if (!stack.empty() && std::none_of(stack.begin(), stack.end(), [&](const auto& layer) {
                    return layer.landmark == brush;
                })) {
                for (std::size_t i = 0; i < landmarks.size(); ++i) {
                    if (landmarks[i].index == stack.front().landmark) {
                        SendDlgItemMessageW(edit_window, Members, CB_SETCURSEL, i, 0);
                        break;
                    }
                }
            }
            refresh_editor();
        }
    } else {
        release_keys();
        {
            std::lock_guard lock(state_mutex);
            const bool changed =
                redo ? document_history.redo(config) : document_history.undo(config);
            if (!changed) {
                return;
            }
            testing = -1;
            pending_events.clear();
            triggered_inputs.clear();
            ++profile_revision;
            reload = true;
        }
        refresh_list();
    }
}
void App::open_editor(bool creating, bool test) {
    if (edit_window) {
        DestroyWindow(edit_window);
    }
    {
        std::lock_guard lock(state_mutex);
        recording_allowed = true;
        reviewed_recording.discard();
    }
    region_selection.clear();
    stroke = trace_stroke = false;
    new_input = creating;
    if (creating) {
        draft = {};
        draft.id = "input_" + std::to_string(now_ms()) + "_" + std::to_string(++serial);
        draft.name = "New movement";
        draft.action = "action";
        draft.steps.push_back({"step_1"});
        draft.steps.back().mode = StepMode::Ordered;
    } else {
        if (config.motions.empty()) {
            message("Add an input first.");
            return;
        }
        select_motion();
        draft = config.motions[selected];
        if (draft.name.empty()) {
            draft.name = draft.id;
        }
        if (draft.action.empty()) {
            draft.action = draft.id;
        }
    }
    draft_history = {};
    scope = 1;
    editor_help = false;
    layer_visible.fill(true);
    editing_layer = -1;
    inspector_tab = creating ? 5 : 3;
    selected_constraint = selected_finger = -1;
    WNDCLASSW klass{};
    klass.lpfnWndProc = editor_procedure;
    klass.hInstance = GetModuleHandleW(nullptr);
    klass.lpszClassName = L"MIGInputEditor";
    klass.hCursor = LoadCursor(nullptr, IDC_ARROW);
    RegisterClassW(&klass);
    RECT client{};
    GetClientRect(window, &client);
    edit_window = CreateWindowExW(WS_EX_CONTROLPARENT, klass.lpszClassName,
                                  L"Motion Input Grid Studio workspace", WS_CHILD | WS_CLIPCHILDREN,
                                  0, 96, client.right, client.bottom - 128, window, nullptr,
                                  klass.hInstance, nullptr);
    if (!edit_window) {
        throw std::runtime_error("Cannot open input editor");
    }
    refresh_editor();
    update_theme();
    {
        std::lock_guard lock(state_mutex);
        recording_landmarks = {15, 16};
        recording_space = draft.space;
    }
    show_studio_view(test ? 2 : 1);
}
std::vector<SpatialConstraint>& App::current_constraints() {
    if (scope == 0) {
        return draft.constraints;
    }
    if (draft.steps.empty()) {
        throw std::runtime_error("Add a step");
    }
    return draft.steps[std::min(std::size_t(scope - 1), draft.steps.size() - 1)].constraints;
}
std::vector<FingerConstraint>& App::current_fingers() {
    const int selected_scope = selection(edit_window, FingerScope);
    if (selected_scope == 0) {
        return draft.fingers;
    }
    if (selected_scope == 1) {
        if (scope == 0 || draft.steps.empty()) {
            SendDlgItemMessageW(edit_window, FingerScope, CB_SETCURSEL, 0, 0);
            return draft.fingers;
        }
        return draft.steps[scope - 1].fingers;
    }
    auto& constraints = current_constraints();
    if (selected_constraint < 0 || std::size_t(selected_constraint) >= constraints.size()) {
        SendDlgItemMessageW(edit_window, FingerScope, CB_SETCURSEL, 0, 0);
        return draft.fingers;
    }
    return constraints[selected_constraint].fingers;
}
void App::sync_interaction_hand() {
    if (selected_constraint >= 0) {
        return; // Preserve explicit settings when inspecting an existing region.
    }
    const int landmark = landmarks[selection(edit_window, Members)].index;
    if (landmark == 15 || landmark == 16) {
        SendDlgItemMessageW(edit_window, InteractionHand, CB_SETCURSEL, landmark - 15, 0);
    }
}
void App::refresh_editor() {
    if (!edit_window) {
        return;
    }
    updating_controls = true;
    SetDlgItemTextW(edit_window, InputName, wide(draft.name).c_str());
    SetDlgItemTextW(edit_window, ActionId, wide(draft.action).c_str());
    SetDlgItemTextW(edit_window, Key, wide(ui::binding_label(draft.keyboard)).c_str());
    SendDlgItemMessageW(edit_window, ActionModeId, CB_SETCURSEL, int(draft.action_mode), 0);
    SetDlgItemInt(edit_window, RepeatInterval, draft.repeat_interval_ms, FALSE);
    const auto counts = ui::binding_counts(draft);
    SetDlgItemTextW(edit_window, BindingSummary,
                    wide(std::to_string(counts.input + counts.steps + counts.cells) +
                         " fingers / " + std::to_string(counts.interactions) + " signs / Details")
                        .c_str());
    if (details_window) {
        SetDlgItemTextW(details_window, 1,
                        wide(ui::binding_description(draft) +
                             "\r\nKeyboard: " + ui::binding_label(draft.keyboard))
                            .c_str());
    }
    SetDlgItemInt(edit_window, Duration, UINT(draft.max_duration_ms), FALSE);
    SetDlgItemInt(edit_window, Cooldown, UINT(draft.cooldown_ms), FALSE);
    SetDlgItemTextW(edit_window, Mirror, draft.mirror ? L"Mirror: On" : L"Mirror: Off");
    SendDlgItemMessageW(edit_window, Space, CB_SETCURSEL, int(draft.space), 0);
    SendDlgItemMessageW(edit_window, StepList, CB_RESETCONTENT, 0, 0);
    SendDlgItemMessageW(edit_window, StepList, CB_ADDSTRING, 0,
                        reinterpret_cast<LPARAM>(L"Whole movement guards"));
    for (const auto& step : draft.steps) {
        const auto text = wide(step.id);
        SendDlgItemMessageW(edit_window, StepList, CB_ADDSTRING, 0,
                            reinterpret_cast<LPARAM>(text.c_str()));
    }
    scope = std::clamp(scope, 0, int(draft.steps.size()));
    SendDlgItemMessageW(edit_window, StepList, CB_SETCURSEL, scope, 0);
    if (scope > 0) {
        SendDlgItemMessageW(edit_window, StepModeId, CB_SETCURSEL, int(draft.steps[scope - 1].mode),
                            0);
        SetDlgItemInt(edit_window, HoldTime, draft.steps[scope - 1].hold_ms, FALSE);
    }
    auto& constraints = current_constraints();
    std::erase_if(region_selection.ids, [&](const auto& id) {
        return std::none_of(constraints.begin(), constraints.end(),
                            [&](const auto& item) { return item.id == id; });
    });
    if (selected_constraint >= int(constraints.size())) {
        selected_constraint = -1;
    }
    const int finger_scope = selection(edit_window, FingerScope);
    const auto scope_label = [&](const wchar_t* label, std::size_t count) {
        const auto text = std::wstring(label) + L" (" + std::to_wstring(count) + L")";
        SendDlgItemMessageW(edit_window, FingerScope, CB_ADDSTRING, 0,
                            reinterpret_cast<LPARAM>(text.c_str()));
    };
    SendDlgItemMessageW(edit_window, FingerScope, CB_RESETCONTENT, 0, 0);
    scope_label(L"Whole input fingers", counts.input);
    scope_label(L"Current step fingers", scope > 0 ? draft.steps[scope - 1].fingers.size() : 0);
    scope_label(L"Selected region fingers",
                selected_constraint >= 0 ? constraints[selected_constraint].fingers.size() : 0);
    SendDlgItemMessageW(edit_window, FingerScope, CB_SETCURSEL,
                        finger_scope == 2 && selected_constraint < 0 ? 0 : finger_scope, 0);
    EnableWindow(GetDlgItem(edit_window, ClearFingers),
                 counts.input + counts.steps + counts.cells > 0);
    const auto order_labels = ui::constraint_labels(draft);
    std::size_t offset = scope > 0 ? draft.constraints.size() : 0;
    for (int s = 0; s < scope - 1; ++s) {
        offset += draft.steps[s].constraints.size();
    }
    SendDlgItemMessageW(edit_window, ConstraintList, LB_RESETCONTENT, 0, 0);
    for (std::size_t i = 0; i < constraints.size(); ++i) {
        const auto& item = constraints[i];
        const auto text =
            wide(ui::landmark_label(item.landmark) + " | " + (order_labels[offset + i] + " | ") +
                 (item.type == ConstraintType::Required      ? "Required"
                  : item.type == ConstraintType::Forbidden   ? "Forbidden"
                  : item.type == ConstraintType::Interaction ? "Interaction"
                                                             : "Trigger") +
                 ((item.priority == Priority::High ? " High " : " Low ") + std::string("[") +
                  std::to_string(item.cell.x) + "," + std::to_string(item.cell.y) + "]"));
        SendDlgItemMessageW(edit_window, ConstraintList, LB_ADDSTRING, 0,
                            reinterpret_cast<LPARAM>(text.c_str()));
    }
    if (selected_constraint >= 0 && std::size_t(selected_constraint) < constraints.size()) {
        const auto& item = constraints[selected_constraint];
        SendDlgItemMessageW(edit_window, ConstraintList, LB_SETCURSEL, selected_constraint, 0);
        for (std::size_t i = 0; i < landmarks.size(); ++i) {
            if (landmarks[i].index == item.landmark) {
                SendDlgItemMessageW(edit_window, Members, CB_SETCURSEL, i, 0);
                break;
            }
        }
        SendDlgItemMessageW(edit_window, ConstraintTypeId, CB_SETCURSEL, int(item.type), 0);
        SendDlgItemMessageW(edit_window, PriorityId, CB_SETCURSEL, int(item.priority), 0);
        SendDlgItemMessageW(edit_window, BrushOrder, CB_SETCURSEL, item.order, 0);
        SetDlgItemInt(edit_window, CellX, item.cell.x, TRUE);
        SetDlgItemInt(edit_window, CellY, item.cell.y, TRUE);
        SetDlgItemInt(edit_window, CellWidth, item.cell.width, FALSE);
        SetDlgItemInt(edit_window, CellHeight, item.cell.height, FALSE);
        if (item.interaction) {
            SendDlgItemMessageW(edit_window, InteractionHand, CB_SETCURSEL,
                                int(item.interaction->hand), 0);
            SendDlgItemMessageW(edit_window, InteractionGesture, CB_SETCURSEL,
                                int(item.interaction->gesture) - 1, 0);
            SetDlgItemInt(edit_window, InteractionHold, item.interaction->hold_ms, FALSE);
        }
    }
    SendDlgItemMessageW(edit_window, FingerList, LB_RESETCONTENT, 0, 0);
    try {
        const auto& fingers = current_fingers();
        for (const auto& item : fingers) {
            constexpr const wchar_t* names[]{L"Thumb", L"Index", L"Middle", L"Ring", L"Pinky"};
            const auto text = std::wstring(item.hand == HandSide::Left ? L"Left " : L"Right ") +
                              names[int(item.finger)] +
                              (item.pose == FingerPose::Extended ? L" Extended" : L" Closed") +
                              L" / " + std::to_wstring(item.stable_ms) + L"ms, grace " +
                              std::to_wstring(item.grace_ms) + L"ms";
            SendDlgItemMessageW(edit_window, FingerList, LB_ADDSTRING, 0,
                                reinterpret_cast<LPARAM>(text.c_str()));
        }
    } catch (const std::exception&) {
    }
    updating_controls = false;
    refresh_layers();
    layout_editor();
    EnableWindow(GetDlgItem(edit_window, DrawBucket),
                 selection(edit_window, ConstraintTypeId) != int(ConstraintType::Trigger) ||
                     selection(edit_window, BrushOrder) > 0);
    SetDlgItemTextW(edit_window, Clear, L"Clear step");
    RedrawWindow(edit_window, nullptr, nullptr, RDW_INVALIDATE | RDW_ALLCHILDREN);
    {
        std::lock_guard lock(state_mutex);
        recording_space = draft.space;
    }
    InvalidateRect(edit_window, nullptr, FALSE);
}
void App::refresh_layers() {
    const int source = landmarks[selection(edit_window, Members)].index;
    const bool same_layer = editing_layer == source;
    layer_members.clear();
    const auto list = GetDlgItem(edit_window, LayerList);
    SendMessageW(list, LB_RESETCONTENT, 0, 0);
    for (const auto& layer : ui::layers(draft)) {
        layer_members.push_back(layer.landmark);
        const auto label = wide(ui::landmark_label(layer.landmark));
        SendMessageW(list, LB_ADDSTRING, 0, reinterpret_cast<LPARAM>(label.c_str()));
        if (layer.landmark == source) {
            SendMessageW(list, LB_SETCURSEL, layer_members.size() - 1, 0);
        }
    }
    editing_layer =
        std::find(layer_members.begin(), layer_members.end(), source) != layer_members.end()
            ? source
            : -1;
    if (!same_layer || editing_layer < 0) {
        SendDlgItemMessageW(edit_window, LayerBodyPart, CB_SETCURSEL,
                            selection(edit_window, Members), 0);
    }
    EnableWindow(GetDlgItem(edit_window, LayerBodyPart), editing_layer >= 0);
    EnableWindow(GetDlgItem(edit_window, SaveLayer), editing_layer >= 0);
    const auto caption = editing_layer < 0        ? L"Select a layer to edit its body part"
                         : layer_change_pending() ? L"Body part changed - Save layer to keep it"
                                                  : L"Layer body part (drawing is kept)";
    SetDlgItemTextW(edit_window, LayerCaption, caption);
}
bool App::layer_change_pending() const {
    return editing_layer >= 0 &&
           landmarks[selection(edit_window, LayerBodyPart)].index != editing_layer;
}
void App::apply() {
    if (!edit_window) {
        return;
    }
    if (layer_change_pending()) {
        throw std::runtime_error("Save layer before applying or testing the input.");
    }
    draft.name = text_value(edit_window, InputName);
    draft.action = text_value(edit_window, ActionId);
    draft.keyboard = ui::parse_binding(text_value(edit_window, Key));
    draft.action_mode = ActionMode(selection(edit_window, ActionModeId));
    draft.repeat_interval_ms = integer_value(edit_window, RepeatInterval, 20, 60000);
    draft.max_duration_ms = integer_value(edit_window, Duration, 0, 10000);
    draft.cooldown_ms = integer_value(edit_window, Cooldown, 0, 10000);
    if (draft.name.empty() || draft.action.empty()) {
        throw std::runtime_error("Name and action are required");
    }
    auto proposed = config;
#ifdef MIG_NATIVE_HANDS
    if (ui::needs_fingers(draft)) {
        proposed.track_hands = true;
    }
#endif
    if (new_input) {
        if (proposed.motions.size() == 64) {
            throw std::runtime_error("Maximum 64 inputs");
        }
        proposed.motions.push_back(draft);
        selected = proposed.motions.size() - 1;
    } else {
        const auto found = std::find_if(proposed.motions.begin(), proposed.motions.end(),
                                        [&](const auto& input) { return input.id == draft.id; });
        if (found == proposed.motions.end()) {
            throw std::runtime_error("The edited input no longer exists");
        }
        selected = std::size_t(found - proposed.motions.begin());
        *found = draft;
    }
    change_document(std::move(proposed));
#ifdef MIG_NATIVE_HANDS
    if (ui::needs_fingers(draft)) {
        set_preview_hands(true);
    }
#endif
    new_input = false;
    message("Input applied. Save the document to persist it.");
}
void App::set_test(bool enabled) {
    if (enabled) {
        apply();
    }
    release_keys();
    std::lock_guard lock(state_mutex);
    testing = enabled ? int(selected) : -1;
    ++profile_revision;
    reload = true;
    pending_events.clear();
    status =
        enabled ? "Test mode: no keyboard output. Restart preserves calibration." : "Test stopped.";
}
void App::request_restart(bool calibration) {
    release_keys();
    std::lock_guard lock(state_mutex);
    if (calibration) {
        recalibrate = true;
    } else {
        restart_requested = true;
    }
    pending_events.clear();
    ++profile_revision;
}
void App::request_record() {
    if (!edit_window) {
        message("Open an input editor to record.");
        return;
    }
    std::vector<int> selected_points;
    const auto list = GetDlgItem(edit_window, RecordLandmarks);
    for (std::size_t i = 0; i < landmarks.size(); ++i) {
        if (SendMessageW(list, LB_GETSEL, i, 0) > 0) {
            selected_points.push_back(landmarks[i].index);
        }
    }
    if (selected_points.empty()) {
        throw std::runtime_error("Select recording landmarks");
    }
    std::lock_guard lock(state_mutex);
    recording_landmarks = std::move(selected_points);
    recording_space = draft.space;
    record_requested = true;
}
void App::editor_command(int id, int notification) {
    if (studio_view == 2 && id != Start && id != Stop && id != RestartTest && id != Calibrate &&
        id != GridViewMode) {
        return;
    }
    if (editor_navigation(id, notification) || updating_controls ||
        editor_settings(id, notification)) {
        return;
    }
    if (notification != BN_CLICKED || editor_session_command(id)) {
        return;
    }
    edit_authoring(id);
}

void App::editor_click(int x, int y, bool begin) {
    if (layer_change_pending()) {
        message("Save layer before editing the grid, or restore its body part.");
        return;
    }
    const int chosen_tool = selection(edit_window, Tool);
    const int tool = chosen_tool == 2 &&
                             is_trigger(ConstraintType(selection(edit_window, ConstraintTypeId))) &&
                             selection(edit_window, BrushOrder) == 0
                         ? 1
                         : chosen_tool;
    if (!PtInRect(&editor_grid, {x, y})) {
        return;
    }
    const auto point = grid_view.local({float(x), float(y)});
    if (!std::isfinite(point.x) || !std::isfinite(point.y) || point.x < Grid::min_cell ||
        point.x >= Grid::max_cell || point.y < Grid::min_cell || point.y >= Grid::max_cell) {
        return;
    }
    const int cell_x = int(std::floor(point.x));
    const int cell_y = int(std::floor(point.y));
    if (tool == 1 || tool == 2 || tool == 4) {
        layer_visible[landmarks[selection(edit_window, Members)].index] = true;
    }
    auto& list = current_constraints();
    if (tool >= 5) {
        std::lock_guard lock(state_mutex);
        if (begin) {
            float nearest = 1.5f;
            bool found = false;
            const int landmark = landmarks[selection(edit_window, Members)].index;
            const auto& traces = reviewed_recording.traces();
            for (std::size_t trace = 0; trace < traces.size(); ++trace) {
                if (traces[trace].landmark != landmark) {
                    continue;
                }
                for (std::size_t sample = 0; sample < traces[trace].points.size(); ++sample) {
                    const auto observed = traces[trace].points[sample];
                    const float separation = distance(point, {observed[0], observed[1]});
                    if (separation < nearest) {
                        nearest = separation;
                        picked_trace = trace;
                        picked_sample = sample;
                        found = true;
                    }
                }
            }
            if (!found) {
                throw std::runtime_error("Choose a recorded landmark and click near its trace");
            }
            trace_before = reviewed_recording;
            trace_stroke = true;
            stroke = true;
            if (tool == 6) {
                reviewed_recording.remove_sample(picked_sample);
                draft_history.commit({draft, trace_before});
                trace_stroke = stroke = false;
            }
        }
        if (tool == 5 && trace_stroke) {
            reviewed_recording.edit_point(picked_trace, picked_sample, point);
        }
        InvalidateRect(edit_window, nullptr, FALSE);
        return;
    }
    if (tool == 0) {
        select_regions(point, begin);
        return;
    }
    if (begin) {
        stroke_before = draft;
        stroke = true;
        last_brush_cell = {cell_x, cell_y};
    }
    if (tool == 3 || tool == 4) {
        if (tool == 3) {
            erase_at(cell_x, cell_y);
        } else if (begin) {
            add_contour(point);
        }
        last_brush_cell = {cell_x, cell_y};
        InvalidateRect(edit_window, nullptr, FALSE);
        return;
    }
    SpatialConstraint brush;
    brush.id = "constraint_" + std::to_string(++serial) + "_" + std::to_string(now_ms());
    brush.landmark = landmarks[selection(edit_window, Members)].index;
    brush.type = ConstraintType(selection(edit_window, ConstraintTypeId));
    if (brush.type == ConstraintType::Interaction) {
        if (scope == 0) {
            throw std::runtime_error("Interaction cells belong to a step");
        }
        brush.interaction = Interaction{
            HandSide(selection(edit_window, InteractionHand)),
            Gesture(selection(edit_window, InteractionGesture) + 1),
            integer_value(edit_window, InteractionHold, 0, maximum_interaction_hold_ms)};
    }
    brush.priority = Priority(selection(edit_window, PriorityId));
    if (brush.type == ConstraintType::Interaction && scope > 0 &&
        draft.steps[scope - 1].mode == StepMode::Ordered &&
        selection(edit_window, BrushOrder) == 0 && brush.priority == Priority::High) {
        // A purple patch is one firing choice, not several independent terminal events.
        ui::number_lane(list, brush.landmark);
    }
    if (brush.priority == Priority::High && brush.type != ConstraintType::Forbidden && scope > 0 &&
        draft.steps[scope - 1].mode == StepMode::Ordered) {
        const int chosen_order = selection(edit_window, BrushOrder);
        const bool explicit_lane = std::any_of(list.begin(), list.end(), [&](const auto& item) {
            return item.landmark == brush.landmark && item.order > 0;
        });
        if (chosen_order > 0 && !explicit_lane) {
            ui::number_lane(list, brush.landmark);
        }
        if (chosen_order > 0 || explicit_lane || brush.type == ConstraintType::Interaction) {
            int maximum = 0;
            for (const auto& item : list) {
                if (item.landmark == brush.landmark) {
                    maximum = std::max(maximum, item.order);
                    if (chosen_order > 0 && item.order == chosen_order && item.type != brush.type) {
                        throw std::runtime_error(
                            "Choose a different number: this order uses another colour");
                    }
                }
            }
            brush.order = chosen_order > 0 ? chosen_order : maximum + 1;
            if (chosen_order == 0 && is_trigger(brush.type)) {
                const auto finish = std::find_if(list.begin(), list.end(), [&](const auto& item) {
                    return item.landmark == brush.landmark && is_trigger(item.type) &&
                           item.priority == Priority::High;
                });
                if (finish != list.end()) {
                    brush.order = finish->order;
                }
            }
        }
    }
    if (brush.priority == Priority::Low && brush.type != ConstraintType::Forbidden) {
        brush.tolerance_for = ui::tolerance_target(list, brush, point);
        if (brush.tolerance_for.empty()) {
            message("Draw a main region of this colour before adding tolerance.");
            return;
        }
        const auto target = std::find_if(list.begin(), list.end(), [&](const auto& region) {
            return region.id == brush.tolerance_for;
        });
        brush.interaction = target->interaction;
    }
    if (tool == 1) {
        if (is_trigger(brush.type) && selection(edit_window, BrushOrder) == 0) {
            // The finish is one movable cell; remove linked tolerance with it.
            std::vector<std::string> removed;
            for (auto& step : draft.steps) {
                for (const auto& item : step.constraints) {
                    if (is_trigger(item.type) && item.priority == Priority::High) {
                        removed.push_back(item.id);
                    }
                }
                std::erase_if(step.constraints, [&](const auto& item) {
                    return std::find(removed.begin(), removed.end(), item.id) != removed.end() ||
                           std::find(removed.begin(), removed.end(), item.tolerance_for) !=
                               removed.end();
                });
            }
        }
        const auto old_size = list.size();
        if (brush.type == ConstraintType::Trigger && selection(edit_window, BrushOrder) == 0) {
            ui::pencil(list, brush, cell_x, cell_y, selection(edit_window, BrushOrder) > 0);
        } else {
            ui::line(last_brush_cell.first, last_brush_cell.second, cell_x, cell_y,
                     [&](int cx, int cy) {
                         auto sampled = brush;
                         sampled.id += "_" + std::to_string(cx) + "_" + std::to_string(cy);
                         ui::pencil(list, sampled, cx, cy, selection(edit_window, BrushOrder) > 0);
                     });
        }
        if (brush.order == 0 && brush.type == ConstraintType::Required && list.size() > old_size) {
            const auto finish = std::find_if(list.begin(), list.end(), [](const auto& item) {
                return is_trigger(item.type) && item.priority == Priority::High;
            });
            if (finish != list.end()) {
                std::rotate(finish, list.begin() + old_size, list.end());
            }
        }
    }
    if (tool == 2 && begin) {
        ui::bucket(list, brush, cell_x, cell_y, brush.id + "_",
                   selection(edit_window, BrushOrder) > 0);
    }
    last_brush_cell = {cell_x, cell_y};
    if (!list.empty()) {
        editor_help = false;
    }
    InvalidateRect(edit_window, nullptr, FALSE);
}
void App::click(int, int) {}
void App::file_dialog(bool saving) {
    release_keys();
    dialog_open = true;
    struct Guard {
        App& app;
        ~Guard() {
            app.finish_dialog();
        }
    } guard{*this};
    wchar_t file[32768]{};
    wcsncpy_s(file, config_path.wstring().c_str(), _TRUNCATE);
    OPENFILENAMEW options{};
    options.lStructSize = sizeof(options);
    options.hwndOwner = window;
    options.lpstrFilter = L"MIG JSON profiles\0*.json\0\0";
    options.lpstrFile = file;
    options.nMaxFile = 32768;
    options.lpstrDefExt = L"json";
    options.Flags =
        OFN_NOCHANGEDIR | OFN_PATHMUSTEXIST | (saving ? OFN_OVERWRITEPROMPT : OFN_FILEMUSTEXIST);
    if (!(saving ? GetSaveFileNameW(&options) : GetOpenFileNameW(&options))) {
        return;
    }
    if (saving) {
        if (edit_window && studio_view != 0) {
            apply();
        }
        save_configuration(config, file);
        message("Saved schema-v2 configuration.");
    } else {
        auto loaded = load_configuration(file);
        if (!review_import(loaded)) {
            return;
        }
        change_document(std::move(loaded));
        if (edit_window) {
            DestroyWindow(edit_window);
        }
        message("Loaded schema-v2 configuration.");
    }
    config_path = file;
}
void App::finish_dialog() {
    std::lock_guard lock(state_mutex);
    dialog_open = false;
    pending_events.clear();
    snapshot.reset();
    ++profile_revision;
    restart_requested = true;
}
void App::open_controls() {
    if (control_window) {
        ShowWindow(control_window, SW_SHOW);
        return;
    }
    WNDCLASSW klass{};
    klass.lpfnWndProc = controls_procedure;
    klass.hInstance = GetModuleHandleW(nullptr);
    klass.lpszClassName = L"MIGControls";
    klass.hCursor = LoadCursor(nullptr, IDC_ARROW);
    RegisterClassW(&klass);
    RECT client{};
    GetClientRect(window, &client);
    control_window =
        CreateWindowExW(WS_EX_CONTROLPARENT, klass.lpszClassName, L"MIG - Remote controls",
                        WS_CHILD | WS_CLIPCHILDREN, 0, 96, client.right, client.bottom - 128,
                        window, nullptr, klass.hInstance, nullptr);
    const auto index = [](ControlBinding binding) {
        return binding.gesture == Gesture::None
                   ? 0
                   : (int(binding.gesture) - 1) * 2 + 1 + int(binding.hand);
    };
    SendDlgItemMessageW(control_window, RestartBinding, CB_SETCURSEL,
                        index(config.controls.restart), 0);
    SendDlgItemMessageW(control_window, RecalibrateBinding, CB_SETCURSEL,
                        index(config.controls.recalibrate), 0);
    SendDlgItemMessageW(control_window, RecordBinding, CB_SETCURSEL,
                        index(config.controls.record_toggle), 0);
    if (!diagnostic_mode) {
        ShowWindow(control_window, SW_SHOW);
    }
}
void App::apply_controls() {
    auto proposed = config;
    const auto binding = [&](int id) {
        const int index = selection(control_window, id);
        return ControlBinding{index == 0 ? Gesture::None : Gesture((index - 1) / 2 + 1),
                              index == 0 ? HandSide::Left : HandSide((index - 1) % 2)};
    };
    proposed.controls.restart = binding(RestartBinding);
    proposed.controls.recalibrate = binding(RecalibrateBinding);
    proposed.controls.record_toggle = binding(RecordBinding);
#ifdef MIG_NATIVE_HANDS
    const bool enabled = proposed.controls.restart.gesture != Gesture::None ||
                         proposed.controls.recalibrate.gesture != Gesture::None ||
                         proposed.controls.record_toggle.gesture != Gesture::None;
    if (enabled) {
        proposed.track_hands = true;
    }
#endif
    change_document(std::move(proposed));
#ifdef MIG_NATIVE_HANDS
    if (enabled) {
        set_preview_hands(true);
    }
    refresh_list();
    message("Remote controls applied; hand tracking enabled. Recovery: 1 second.");
#else
    message("Bindings saved; this build has no hand inference. Use the hands-enabled build.");
#endif
}
} // namespace mig::app

namespace mig::app {
void App::remember_edit(const Motion& before) {
    std::lock_guard lock(state_mutex);
    draft_history.commit({before, reviewed_recording});
}
} // namespace mig::app
