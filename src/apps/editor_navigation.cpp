#include "app.hpp"
namespace mig::app {
bool App::editor_layer_selection(int id, int notification) {
    if (id == Members && notification == CBN_SELCHANGE && layer_change_pending()) {
        for (std::size_t i = 0; i < landmarks.size(); ++i) {
            if (landmarks[i].index == editing_layer) {
                SendDlgItemMessageW(edit_window, Members, CB_SETCURSEL, i, 0);
                break;
            }
        }
        throw std::runtime_error("Save layer before changing the drawing body part.");
    }
    if (id == LayerList && notification == LBN_SELCHANGE) {
        region_selection.clear();
        selected_finger = -1;
        if (layer_change_pending()) {
            const auto found = std::find(layer_members.begin(), layer_members.end(), editing_layer);
            SendDlgItemMessageW(edit_window, LayerList, LB_SETCURSEL, found - layer_members.begin(),
                                0);
            throw std::runtime_error(
                "Save layer before switching layers, or restore its body part.");
        }
        const auto row = SendDlgItemMessageW(edit_window, LayerList, LB_GETCURSEL, 0, 0);
        if (row >= 0 && std::size_t(row) < layer_members.size()) {
            const auto landmark = layer_members[row];
            for (std::size_t i = 0; i < landmarks.size(); ++i) {
                if (landmarks[i].index == landmark) {
                    SendDlgItemMessageW(edit_window, Members, CB_SETCURSEL, i, 0);
                    break;
                }
            }
            selected_constraint = -1;
            sync_interaction_hand();
            refresh_layers();
            RedrawWindow(edit_window, nullptr, nullptr, RDW_INVALIDATE | RDW_ALLCHILDREN);
        }
        return true;
    }
    if (id == LayerBodyPart && notification == CBN_SELCHANGE) {
        refresh_layers();
        return true;
    }
    if (id == SaveLayer && notification == BN_CLICKED) {
        region_selection.clear();
        const auto target = landmarks[selection(edit_window, LayerBodyPart)].index;
        const auto before = draft;
        ui::reassign_layer(draft, editing_layer, target);
        if (draft != before) {
            remember_edit(before);
            layer_visible[target] = layer_visible[editing_layer];
        }
        SendDlgItemMessageW(edit_window, Members, CB_SETCURSEL,
                            selection(edit_window, LayerBodyPart), 0);
        editing_layer = target;
        selected_constraint = -1;
        sync_interaction_hand();
        refresh_editor();
        message("Layer saved in this input. Apply input, then save the document to persist it.");
        return true;
    }
    if (id == ToggleLayer && notification == BN_CLICKED) {
        const auto landmark = landmarks[selection(edit_window, Members)].index;
        layer_visible[landmark] = !layer_visible[landmark];
        RedrawWindow(edit_window, nullptr, nullptr, RDW_INVALIDATE | RDW_ALLCHILDREN);
        return true;
    }
    return false;
}
bool App::editor_drawing_tools(int id, int notification) {
    if (id == TraceMove || id == TraceDelete) {
        SendDlgItemMessageW(edit_window, Tool, CB_SETCURSEL, id == TraceMove ? 5 : 6, 0);
        RedrawWindow(edit_window, nullptr, nullptr, RDW_INVALIDATE | RDW_ALLCHILDREN);
        return true;
    }
    if (notification == BN_CLICKED && (id == DrawPencil || id == DrawBucket || id == DrawContour)) {
        return true; // Retired authoring tools: imported rules remain supported.
    }
    if (notification == BN_CLICKED &&
        ((id >= PaintRequired && id <= PaintInteraction) || id == DrawSelect || id == DrawEraser)) {
        if (id <= PaintInteraction) {
            SendDlgItemMessageW(edit_window, Tool, CB_SETCURSEL, 1, 0);
            SendDlgItemMessageW(edit_window, BrushOrder, CB_SETCURSEL, 0, 0);
            region_selection.clear();
            selected_constraint = -1;
            SendDlgItemMessageW(edit_window, ConstraintTypeId, CB_SETCURSEL, id - PaintRequired, 0);
            SendDlgItemMessageW(edit_window, PriorityId, CB_SETCURSEL, 0, 0);
            inspector_tab = 0;
            editor_help = false;
            if (id == PaintInteraction) {
                sync_interaction_hand();
                if (scope == 0) {
                    scope = 1;
                }
                inspector_tab = 4;
                refresh_editor();
            }
        } else {
            SendDlgItemMessageW(edit_window, Tool, CB_SETCURSEL, id == DrawSelect ? 0 : 3, 0);
        }
        layout_editor();
        RedrawWindow(edit_window, nullptr, nullptr, RDW_INVALIDATE | RDW_ALLCHILDREN);
        return true;
    }
    return false;
}
bool App::editor_views(int id, int notification) {
    if (id == EditorHelp && notification == BN_CLICKED) {
        editor_help = !editor_help;
        layout_editor();
        return true;
    }
    if (notification == BN_CLICKED &&
        (id == ConstraintsTab || id == FingersTab || id == RecordingTab || id == LayersTab ||
         id == InteractionTab || id == MovementTab)) {
        inspector_tab = id == MovementTab      ? 5
                        : id == InteractionTab ? 4
                        : id == LayersTab      ? 3
                        : id == ConstraintsTab ? 0
                        : id == FingersTab     ? 1
                                               : 2;
        editor_help = false;
        layout_editor();
        return true;
    }
    if (id == GridViewMode && notification == BN_CLICKED) {
        body_view = !body_view;
        SetDlgItemTextW(edit_window, GridViewMode, body_view ? L"View: Body" : L"View: Full grid");
        std::shared_ptr<const Snapshot> result;
        {
            std::lock_guard lock(state_mutex);
            result = snapshot;
        }
        update_grid_view(result);
        InvalidateRect(edit_window, nullptr, FALSE);
        return true;
    }
    return false;
}
bool App::editor_navigation(int id, int notification) {
    if (editor_layer_selection(id, notification) || editor_drawing_tools(id, notification) ||
        editor_views(id, notification)) {
        return true;
    }
    if (id == TrackHands && notification == BN_CLICKED) {
        SendMessageW(window, WM_COMMAND, TrackHands, 0);
        return true;
    }
    if (id == RecordAll && notification == BN_CLICKED) {
        const auto list = GetDlgItem(edit_window, RecordLandmarks);
        SendMessageW(list, LB_SETSEL, TRUE, LPARAM(-1));
        editor_command(RecordLandmarks, LBN_SELCHANGE);
        return true;
    }
    return false;
}
} // namespace mig::app
