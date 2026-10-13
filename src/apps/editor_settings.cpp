#include "app.hpp"
namespace mig::app {
bool App::editor_settings(int id, int notification) {
    if (notification == EN_CHANGE && (id == InputName || id == ActionId || id == Key ||
                                      id == Duration || id == Cooldown || id == RepeatInterval)) {
        if (typing_control != id) {
            remember_edit(draft);
            typing_control = id;
        }
        if (id == InputName) {
            draft.name = text_value(edit_window, id);
        }
        if (id == ActionId) {
            draft.action = text_value(edit_window, id);
        }
        try {
            if (id == Key) {
                draft.keyboard = ui::parse_binding(text_value(edit_window, id));
            }
            if (id == Duration) {
                draft.max_duration_ms = integer_value(edit_window, id, 0, 10000);
            }
            if (id == Cooldown) {
                draft.cooldown_ms = integer_value(edit_window, id, 0, 10000);
            }
            if (id == RepeatInterval) {
                draft.repeat_interval_ms = integer_value(edit_window, id, 20, 60000);
            }
        } catch (const std::exception&) {
        }
        if (id == Key) {
            InvalidateRect(GetDlgItem(edit_window, KeyTokens), nullptr, TRUE);
        }
        return true;
    }
    if (notification == EN_KILLFOCUS) {
        typing_control = 0;
        return true;
    }
    if (id == ConstraintList && notification == LBN_SELCHANGE) {
        selected_constraint = int(SendDlgItemMessageW(edit_window, id, LB_GETCURSEL, 0, 0));
        region_selection.clear();
        if (selected_constraint >= 0 &&
            std::size_t(selected_constraint) < current_constraints().size()) {
            region_selection.ids.push_back(current_constraints()[selected_constraint].id);
        }
        refresh_editor();
        return true;
    }
    if (id == RecordLandmarks && notification == LBN_SELCHANGE) {
        std::vector<int> points;
        for (std::size_t index = 0; index < landmarks.size(); ++index) {
            if (SendDlgItemMessageW(edit_window, RecordLandmarks, LB_GETSEL, index, 0) > 0) {
                points.push_back(landmarks[index].index);
            }
        }
        std::lock_guard lock(state_mutex);
        recording_landmarks = std::move(points);
        return true;
    }
    if (id == FingerList && notification == LBN_SELCHANGE) {
        selected_finger = int(SendDlgItemMessageW(edit_window, id, LB_GETCURSEL, 0, 0));
        const auto& list = current_fingers();
        if (selected_finger >= 0 && std::size_t(selected_finger) < list.size()) {
            const auto& rule = list[selected_finger];
            SendDlgItemMessageW(edit_window, FingerHand, CB_SETCURSEL, int(rule.hand), 0);
            SendDlgItemMessageW(edit_window, FingerId, CB_SETCURSEL, int(rule.finger), 0);
            SendDlgItemMessageW(edit_window, FingerPoseId, CB_SETCURSEL, int(rule.pose), 0);
            SetDlgItemInt(edit_window, FingerStable, rule.stable_ms, FALSE);
            SetDlgItemInt(edit_window, FingerGrace, rule.grace_ms, FALSE);
        }
        return true;
    }
    if (notification == CBN_SELCHANGE) {
        if (id == ActionModeId) {
            remember_edit(draft);
            draft.action_mode = ActionMode(selection(edit_window, id));
            refresh_editor();
        } else if (id == StepList) {
            region_selection.clear();
            selected_finger = -1;
            scope = selection(edit_window, id);
            selected_constraint = -1;
            refresh_editor();
        } else if (id == FingerScope) {
            selected_finger = -1;
            refresh_editor();
        } else if (id == Space || id == StepModeId) {
            remember_edit(draft);
            if (id == Space) {
                draft.space = CoordinateSpace(selection(edit_window, id));
                std::lock_guard lock(state_mutex);
                recording_space = draft.space;
            } else if (scope > 0) {
                draft.steps[scope - 1].mode = StepMode(selection(edit_window, id));
                if (draft.steps[scope - 1].mode != StepMode::Ordered) {
                    for (auto& item : draft.steps[scope - 1].constraints) {
                        item.order = 0;
                    }
                }
            }
            refresh_editor();
        } else if (id == Members || id == BrushOrder || id == Tool || id == ConstraintTypeId ||
                   id == PriorityId) {
            if (id == Tool) {
                region_selection.clear();
            }
            if (selection(edit_window, Tool) != 0 || id == Tool) {
                selected_constraint = -1;
            }
            if (id == Members) {
                region_selection.clear();
                sync_interaction_hand();
            }
            refresh_layers();
            EnableWindow(GetDlgItem(edit_window, DrawBucket),
                         selection(edit_window, ConstraintTypeId) != int(ConstraintType::Trigger) ||
                             selection(edit_window, BrushOrder) > 0);
            layout_editor();
            RedrawWindow(edit_window, nullptr, nullptr, RDW_INVALIDATE | RDW_ALLCHILDREN);
        }
        return true;
    }
    return false;
}
bool App::editor_session_command(int id) {
    if (id == Commit) {
        apply();
        return true;
    }
    if (id == EditKeys) {
        open_keys();
        return true;
    }
    if (id == BindingSummary) {
        open_binding_details();
        return true;
    }
    if (id == TestInput) {
        show_studio_view(2);
        return true;
    }
    if (id == Start || id == Stop) {
        SendMessageW(window, WM_COMMAND, id, 0);
        return true;
    }
    if (id == RestartTest) {
        request_restart(false);
        return true;
    }
    if (id == Calibrate) {
        request_restart(true);
        return true;
    }
    if (id == Undo || id == Redo) {
        undo(id == Redo, true);
        return true;
    }
    if (id == RecordToggle) {
        request_record();
        return true;
    }
    if (id == DiscardRecording) {
        std::lock_guard lock(state_mutex);
        draft_history.commit({draft, reviewed_recording});
        reviewed_recording.discard();
        return true;
    }
    if (id == TrimRecording) {
        std::lock_guard lock(state_mutex);
        draft_history.commit({draft, reviewed_recording});
        reviewed_recording.trim(std::size_t(integer_value(edit_window, TrimBegin, 0, 2048)),
                                std::size_t(integer_value(edit_window, TrimEnd, 0, 2048)));
        return true;
    }
    return false;
}
} // namespace mig::app
