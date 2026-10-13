#include "app.hpp"

namespace mig::app {
bool App::send_key(int key, bool release) {
    if (key_sender) {
        return key_sender(key, release);
    }
    INPUT input{};
    input.type = INPUT_KEYBOARD;
    input.ki.wVk = WORD(key);
    const bool extended = key == VK_RCONTROL || key == VK_RMENU || key == VK_LWIN ||
                          key == VK_RWIN || key == VK_INSERT || key == VK_DELETE ||
                          key == VK_HOME || key == VK_END || key == VK_PRIOR || key == VK_NEXT ||
                          (key >= VK_LEFT && key <= VK_DOWN) || key == VK_DIVIDE;
    input.ki.dwFlags = (release ? KEYEVENTF_KEYUP : 0) | (extended ? KEYEVENTF_EXTENDEDKEY : 0);
    return SendInput(1, &input, sizeof(input)) == 1;
}
void App::release_keys() {
    keyboard_output.cancel([&](int key, bool release) { return send_key(key, release); },
                           [&](char16_t unit, bool release) { return send_text(unit, release); });
}
bool App::send_text(char16_t unit, bool release) {
    if (text_sender) {
        return text_sender(unit, release);
    }
    INPUT input{};
    input.type = INPUT_KEYBOARD;
    input.ki.wScan = WORD(unit);
    input.ki.dwFlags = KEYEVENTF_UNICODE | (release ? KEYEVENTF_KEYUP : 0);
    return SendInput(1, &input, sizeof(input)) == 1;
}
void App::advance_keyboard(std::int64_t now) {
    const bool fresh =
        running && snapshot && snapshot->grid.valid && now - snapshot->pose.timestamp_ms <= 250;
    const bool enabled = keyboard_enabled && !controller_verify && testing < 0 && !dialog_open &&
                         !key_window && snapshot && !snapshot->waiting;
    if (!fresh || !enabled) {
        release_keys();
        pending_events.clear();
    } else {
        for (const auto event : pending_events) {
            if (event.motion >= config.motions.size() || now - event.timestamp_ms > 250) {
                continue;
            }
            const auto& input = config.motions[event.motion];
            if (input.action_mode != ActionMode::SinglePress &&
                !snapshot->actions_active[event.motion]) {
                continue;
            }
            if (!keyboard_output.trigger(event.motion, input, now)) {
                status = "Keyboard sequence queue is full; action skipped.";
            }
        }
        pending_events.clear();
        if (!keyboard_output.advance(
                config.motions, snapshot->actions_active, now,
                [&](int key, bool release) { return send_key(key, release); },
                [&](char16_t unit, bool release) { return send_text(unit, release); })) {
            status = "Keyboard output failed; sequence cancelled. Check target permissions.";
        }
    }
}
#ifdef MIG_CONFIGURATOR
void App::refresh_diagnostics(const std::shared_ptr<const Snapshot>& displayed) {
    if (testing >= 0 && std::size_t(testing) < config.motions.size() &&
        config.motions[testing] == draft && displayed &&
        diagnosed_sequence != displayed->pose.sequence) {
        diagnosed_sequence = displayed->pose.sequence;
        const auto& normal = displayed->progress;
        const auto& mirrored = displayed->mirrored_progress;
        const auto& progress = ui::displayed_progress(normal, mirrored);
        std::size_t offset = 0;
        if (scope > 0) {
            offset = draft.constraints.size();
            for (int step = 1; step < scope; ++step) {
                offset += draft.steps[step - 1].constraints.size();
            }
        }
        const auto& constraints = current_constraints();
        const wchar_t* states[] = {L"Missing",
                                   L"Validated",
                                   L"Forbidden crossed",
                                   L"Trigger active",
                                   L"Finger rule invalid",
                                   L"Landmark lost",
                                   L"Hand/fingers not detected",
                                   L"Hand sign mismatch",
                                   L"Holding hand sign"};
        updating_controls = true;
        const auto list = GetDlgItem(edit_window, ConstraintList);
        const auto top = SendMessageW(list, LB_GETTOPINDEX, 0, 0);
        SendMessageW(list, WM_SETREDRAW, FALSE, 0);
        SendMessageW(list, LB_RESETCONTENT, 0, 0);
        for (std::size_t index = 0; index < constraints.size(); ++index) {
            const auto state = index + offset < progress.constraints.size()
                                   ? progress.constraints[index + offset]
                                   : ConstraintStatus::Missing;
            const int landmark = progress.mirrored ? mirrored_landmark(constraints[index].landmark)
                                                   : constraints[index].landmark;
            auto label = wide(ui::landmark_label(landmark)) + L" | " + states[int(state)];
            if (constraints[index].interaction) {
                const auto& interaction = *constraints[index].interaction;
                const int side =
                    progress.mirrored ? 1 - int(interaction.hand) : int(interaction.hand);
                label += side == 0 ? L" | Left " : L" | Right ";
                label += wide(gesture_names[int(interaction.gesture)]);
                if (state == ConstraintStatus::Holding &&
                    index + offset < progress.interaction_elapsed_ms.size()) {
                    label += L" " +
                             std::to_wstring(progress.interaction_elapsed_ms[index + offset]) +
                             L"/" + std::to_wstring(interaction.hold_ms) + L" ms";
                }
            }
            SendMessageW(list, LB_ADDSTRING, 0, reinterpret_cast<LPARAM>(label.c_str()));
        }
        SendMessageW(list, LB_SETCURSEL, selected_constraint, 0);
        SendMessageW(list, LB_SETTOPINDEX, top, 0);
        SendMessageW(list, WM_SETREDRAW, TRUE, 0);
        InvalidateRect(list, nullptr, FALSE);
        updating_controls = false;
    }
}
#endif
void App::refresh_logs(const std::vector<std::string>& entries, std::uint64_t version) {
    if (logs_visible && log_window && shown_log_version != version) {
        std::wstring text;
        for (const auto& item : entries) {
            text += wide(item) + L"\r\n";
        }
        const auto terminal = GetDlgItem(log_window, 1);
        DWORD start{}, end{};
        SendMessageW(terminal, EM_GETSEL, reinterpret_cast<WPARAM>(&start),
                     reinterpret_cast<LPARAM>(&end));
        const auto first_line = SendMessageW(terminal, EM_GETFIRSTVISIBLELINE, 0, 0);
        SCROLLINFO scroll{sizeof(scroll), SIF_ALL};
        const bool at_bottom = !GetScrollInfo(terminal, SB_VERT, &scroll) ||
                               scroll.nPos >= scroll.nMax - int(scroll.nPage) + 1;
        const bool follow = at_bottom && start == end;
        SendMessageW(terminal, WM_SETREDRAW, FALSE, 0);
        SetWindowTextW(terminal, text.c_str());
        if (follow) {
            SendMessageW(terminal, EM_SETSEL, text.size(), text.size());
            SendMessageW(terminal, EM_LINESCROLL, 0, SendMessageW(terminal, EM_GETLINECOUNT, 0, 0));
        } else {
            SendMessageW(terminal, EM_SETSEL, std::min<std::size_t>(start, text.size()),
                         std::min<std::size_t>(end, text.size()));
            const auto current_line = SendMessageW(terminal, EM_GETFIRSTVISIBLELINE, 0, 0);
            SendMessageW(terminal, EM_LINESCROLL, 0, first_line - current_line);
        }
        SendMessageW(terminal, WM_SETREDRAW, TRUE, 0);
        RedrawWindow(terminal, nullptr, nullptr, RDW_INVALIDATE | RDW_FRAME);
        shown_log_version = version;
    }
}
void App::tick() {
    std::shared_ptr<const Snapshot> displayed;
    std::vector<std::string> entries;
    std::uint64_t version{};
    std::size_t record_count{};
    bool preview_changed{}, highlights_changed{};
    const auto now = now_ms();
    {
        std::lock_guard lock(state_mutex);
        advance_keyboard(now);
        displayed = snapshot;
        const auto pose_sequence = displayed ? displayed->pose.sequence : 0;
        const bool fresh = running && displayed && now - displayed->pose.timestamp_ms <= 250;
        preview_changed =
            (editor || (controller_camera && !controller_compact && !IsIconic(window))) &&
                painted_pose_sequence != pose_sequence ||
            painted_status != status || painted_fresh != fresh;
        painted_pose_sequence = pose_sequence;
        painted_status = status;
        painted_fresh = fresh;
        std::array<bool, 64> highlights{};
        for (std::size_t input = 0; input < config.motions.size(); ++input) {
            const auto found = triggered_inputs.find(config.motions[input].id);
            const bool flashed = found != triggered_inputs.end() && now - found->second < 900;
            const bool held = fresh && !displayed->waiting && displayed->actions_active[input] &&
                              config.motions[input].action_mode != ActionMode::SinglePress;
            highlights[input] = flashed || held;
        }
        highlights_changed = highlights != painted_highlights;
        painted_highlights = highlights;
        const auto& traces = reviewed_recording.traces();
        record_count = traces.empty() ? 0 : traces[0].points.size();
        version = log_version;
        if (logs_visible && log_window && shown_log_version != version) {
            entries.assign(log.begin(), log.end());
        }
    }
    {
        std::lock_guard lock(capture_mutex);
        preview_changed |=
            (editor || (controller_camera && !controller_compact && !IsIconic(window))) &&
            painted_capture_sequence != latest_sequence;
        painted_capture_sequence = latest_sequence;
    }
    if (preview_changed) {
        InvalidateRect(window, nullptr, FALSE);
    }
    if (highlights_changed) {
        InvalidateRect(GetDlgItem(window, MotionList), nullptr, FALSE);
    }
    if (edit_window) {
        if (preview_changed) {
            InvalidateRect(edit_window, nullptr, FALSE);
        }
        if (record_count != shown_record_count) {
            SetDlgItemInt(edit_window, TrimEnd, UINT(record_count), FALSE);
            shown_record_count = record_count;
        }
#ifdef MIG_CONFIGURATOR
        refresh_diagnostics(displayed);
#endif
    }
    refresh_logs(entries, version);
}
} // namespace mig::app
