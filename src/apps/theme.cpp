#include "app.hpp"
#include "design_tokens.hpp"
#include "scrollbars.hpp"
#include <dwmapi.h>
#include <uxtheme.h>
namespace mig::app {
Palette App::palette() const noexcept {
    const auto colors = ui::design::palette(dark);
    const auto rgb = [](std::uint32_t value) { return RGB(value >> 16, value >> 8, value); };
    return {rgb(colors.paper),   rgb(colors.surface), rgb(colors.ink),
            rgb(colors.muted),   rgb(colors.accent),  rgb(colors.border),
            rgb(colors.primary), rgb(colors.hover),   rgb(colors.selected)};
}
void App::update_theme() {
    if (background_brush) {
        DeleteObject(background_brush);
    }
    if (surface_brush) {
        DeleteObject(surface_brush);
    }
    const auto colors = palette();
    background_brush = CreateSolidBrush(colors.background);
    surface_brush = CreateSolidBrush(colors.surface);
    if (window) {
        SetDlgItemTextW(window, Theme, dark ? L"Theme: Dark" : L"Theme: Light");
    }
    for (auto handle :
         {window, edit_window, log_window, control_window, key_window, details_window}) {
        if (!handle) {
            continue;
        }
        const BOOL enabled = dark;
        DwmSetWindowAttribute(handle, 20, &enabled, sizeof(enabled));
        EnumChildWindows(
            handle,
            [](HWND child, LPARAM) -> BOOL {
                SetWindowTheme(child, L"", L"");
                const auto colors = application->palette();
                const ScrollbarColors scroll{colors.surface, colors.border, colors.muted};
                theme_scrollbars(child, scroll);
                COMBOBOXINFO info{sizeof(info)};
                if (GetComboBoxInfo(child, &info) && info.hwndList) {
                    SetWindowTheme(info.hwndList, L"", L"");
                    theme_scrollbars(info.hwndList, scroll);
                }
                return TRUE;
            },
            0);
        RedrawWindow(handle, nullptr, nullptr,
                     RDW_INVALIDATE | RDW_ALLCHILDREN | RDW_ERASE | RDW_FRAME);
    }
}
void App::draw_control(const DRAWITEMSTRUCT& item) {
    const auto colors = palette();
    const auto dc = item.hDC;
    const int saved = SaveDC(dc);
    SelectObject(dc, font);
    SetBkMode(dc, TRANSPARENT);
    SetTextColor(dc, colors.text);
    const auto border = [&](RECT rect) {
        InflateRect(&rect, -2, -2);
        auto pen = CreatePen(PS_SOLID, 1, colors.border);
        const auto previous = SelectObject(dc, pen);
        const auto brush = SelectObject(dc, GetStockObject(NULL_BRUSH));
        RoundRect(dc, rect.left, rect.top, rect.right, rect.bottom, 6, 6);
        SelectObject(dc, brush);
        SelectObject(dc, previous);
        DeleteObject(pen);
    };
    const auto tokens = [&](const std::vector<std::string>& values, RECT rect) {
        int x = rect.left + 6;
        for (const auto& value : values) {
            const auto label = wide(value);
            const bool separator = value == "+" || value == "_";
            SIZE size{};
            GetTextExtentPoint32W(dc, label.data(), int(label.size()), &size);
            const int width =
                std::min(int(size.cx) + (separator ? 10 : 20), int(rect.right) - x - 6);
            if (width < (separator ? 10 : 24)) {
                break;
            }
            RECT cap{x, rect.top + 3, x + width, rect.bottom - 3};
            if (!separator) {
                const auto pen = CreatePen(PS_SOLID, 1, colors.accent);
                const auto old = SelectObject(dc, pen);
                const auto brush = SelectObject(dc, GetStockObject(NULL_BRUSH));
                RoundRect(dc, cap.left, cap.top, cap.right, cap.bottom, 5, 5);
                SelectObject(dc, brush);
                SelectObject(dc, old);
                DeleteObject(pen);
            }
            DrawTextW(dc, label.c_str(), int(label.size()), &cap,
                      DT_SINGLELINE | DT_CENTER | DT_VCENTER | DT_END_ELLIPSIS);
            x += width + 4;
            if (x >= rect.right - 24) {
                break;
            }
        }
    };
    if (item.CtlID == KeyTokens || item.CtlID == KeySequenceList) {
        FillRect(dc, &item.rcItem, surface_brush);
        if (item.CtlID == KeyTokens) {
            try {
                const auto sequence = ui::parse_binding(text_value(edit_window, Key));
                tokens(ui::binding_tokens(sequence), item.rcItem);
            } catch (const std::exception& e) {
                SetTextColor(dc, RGB(242, 87, 105));
                auto rect = item.rcItem;
                const auto error = wide(e.what());
                DrawTextW(dc, error.c_str(), -1, &rect,
                          DT_SINGLELINE | DT_VCENTER | DT_END_ELLIPSIS);
            }
        } else if (item.itemID < key_preview_rows.size()) {
            border(item.rcItem);
            tokens(key_preview_rows[item.itemID], item.rcItem);
        }
    } else if (item.CtlType == ODT_MENU) {
        const auto brush =
            CreateSolidBrush((item.itemState & ODS_SELECTED) ? colors.primary : colors.surface);
        FillRect(dc, &item.rcItem, brush);
        DeleteObject(brush);
        auto rect = item.rcItem;
        rect.left += 12;
        SetTextColor(dc, (item.itemState & ODS_SELECTED) ? RGB(255, 255, 255) : colors.text);
        DrawTextW(dc, reinterpret_cast<const wchar_t*>(item.itemData), -1, &rect,
                  DT_SINGLELINE | DT_VCENTER);
    } else if (item.CtlType == ODT_COMBOBOX) {
        const auto brush =
            CreateSolidBrush((item.itemState & ODS_SELECTED) ? colors.primary : colors.surface);
        FillRect(dc, &item.rcItem, brush);
        DeleteObject(brush);
        SetTextColor(dc, (item.itemState & ODS_SELECTED) ? RGB(255, 255, 255) : colors.text);
        std::wstring value;
        if (item.itemID != UINT(-1)) {
            const auto length = SendMessageW(item.hwndItem, CB_GETLBTEXTLEN, item.itemID, 0);
            if (length >= 0 && length <= 65536) {
                value.resize(std::size_t(length) + 1);
                SendMessageW(item.hwndItem, CB_GETLBTEXT, item.itemID,
                             reinterpret_cast<LPARAM>(value.data()));
            }
        }
        auto rect = item.rcItem;
        rect.left += 8;
        DrawTextW(dc, value.c_str(), -1, &rect, DT_SINGLELINE | DT_VCENTER | DT_END_ELLIPSIS);
    } else if (item.CtlID == LayerList) {
        const auto layers = ui::layers(draft);
        if (item.itemID < layers.size()) {
            const auto& layer = layers[item.itemID];
            const auto brush = CreateSolidBrush((item.itemState & ODS_SELECTED) ? colors.selected
                                                                                : colors.surface);
            FillRect(dc, &item.rcItem, brush);
            DeleteObject(brush);
            border(item.rcItem);
            auto rect = item.rcItem;
            rect.left += 12;
            rect.top += 8;
            rect.bottom = rect.top + 22;
            auto text = wide(ui::landmark_label(layer.landmark)) +
                        (layer_visible[layer.landmark] ? L"  /  Visible" : L"  /  Hidden");
            DrawTextW(dc, text.c_str(), -1, &rect, DT_SINGLELINE | DT_END_ELLIPSIS);
            rect.top += 25;
            rect.bottom += 25;
            SetTextColor(dc, colors.muted);
            text = L"Required " + std::to_wstring(layer.counts[0]) + L"  |  Forbidden " +
                   std::to_wstring(layer.counts[1]) + L"  |  Trigger " +
                   std::to_wstring(layer.counts[2]) + L"  |  Interaction " +
                   std::to_wstring(layer.counts[3]);
            DrawTextW(dc, text.c_str(), -1, &rect, DT_SINGLELINE | DT_END_ELLIPSIS);
        }
    } else if (item.CtlID == MotionList) {
        if (item.itemID == UINT(-1) || item.itemID >= config.motions.size()) {
            RestoreDC(dc, saved);
            return;
        }
        const auto& input = config.motions[item.itemID];
        bool triggered = false;
        bool sustaining = false;
        {
            std::lock_guard lock(state_mutex);
            const auto found = triggered_inputs.find(input.id);
            triggered = found != triggered_inputs.end() && now_ms() - found->second < 900;
            sustaining = running && snapshot && !snapshot->waiting &&
                         now_ms() - snapshot->pose.timestamp_ms <= 250 &&
                         snapshot->actions_active[item.itemID] &&
                         input.action_mode != ActionMode::SinglePress;
        }
        const auto brush =
            CreateSolidBrush(triggered || sustaining ? (dark ? RGB(25, 90, 65) : RGB(200, 245, 218))
                             : (item.itemState & ODS_SELECTED) ? colors.selected
                                                               : colors.surface);
        FillRect(dc, &item.rcItem, brush);
        DeleteObject(brush);
        border(item.rcItem);
        auto text =
            wide(input.name.empty() ? input.id : input.name) +
            (sustaining ? (input.action_mode == ActionMode::Hold ? L"  /  Held" : L"  /  Repeating")
             : triggered ? L"  /  Triggered"
                         : L"");
        RECT line = item.rcItem;
        line.left += 12;
        line.right -= 8;
        line.top += 7;
        line.bottom = line.top + 22;
        DrawTextW(dc, text.c_str(), -1, &line, DT_SINGLELINE | DT_END_ELLIPSIS);
        line.top += 23;
        line.bottom += 23;
        SetTextColor(dc, colors.muted);
        text = wide((input.action.empty() ? input.id : input.action) +
                    (input.mirror ? " | Mirror" : "") +
                    (" | " + std::string(action_mode_names[int(input.action_mode)])) +
                    (input.action_mode == ActionMode::Repeat
                         ? " " + std::to_string(input.repeat_interval_ms) + " ms"
                         : ""));
        DrawTextW(dc, text.c_str(), -1, &line, DT_SINGLELINE | DT_END_ELLIPSIS);
        SetTextColor(dc, colors.accent);
        line.top += 21;
        line.bottom += 21;
        const auto counts = ui::binding_counts(input);
        text = wide("Fingers: " + std::to_string(counts.input + counts.steps + counts.cells) +
                    " | Interaction signs: " + std::to_string(counts.interactions));
        DrawTextW(dc, text.c_str(), -1, &line, DT_SINGLELINE | DT_END_ELLIPSIS);
        line.top += 21;
        line.bottom += 21;
        text = wide("Keys: " + ui::binding_label(input.keyboard));
        SetTextColor(dc, colors.muted);
        DrawTextW(dc, text.c_str(), -1, &line, DT_SINGLELINE | DT_END_ELLIPSIS);
        SetTextColor(dc, colors.accent);
        if constexpr (editor) {
            int button_index = 0;
            for (const auto label : {L"Edit", L"Test", L"Delete"}) {
                SetTextColor(dc, button_index == 2 ? (dark ? RGB(255, 170, 166) : RGB(163, 39, 38))
                                                   : colors.accent);
                RECT action = motion_button_rect(item.rcItem, button_index++);
                const auto pen = CreatePen(PS_SOLID, 1, colors.border);
                SelectObject(dc, pen);
                SelectObject(dc, surface_brush);
                RoundRect(dc, action.left, action.top, action.right, action.bottom, 6, 6);
                DrawTextW(dc, label, -1, &action, DT_CENTER | DT_SINGLELINE | DT_VCENTER);
                SelectObject(dc, GetStockObject(BLACK_PEN));
                DeleteObject(pen);
            }
        }
    } else if (item.CtlType == ODT_LISTBOX) {
        FillRect(dc, &item.rcItem,
                 (item.itemState & ODS_SELECTED) ? background_brush : surface_brush);
        border(item.rcItem);
        if (item.itemID != UINT(-1)) {
            const auto count = SendMessageW(item.hwndItem, LB_GETTEXTLEN, item.itemID, 0);
            if (count >= 0) {
                std::wstring label(std::size_t(count) + 1, 0);
                SendMessageW(item.hwndItem, LB_GETTEXT, item.itemID,
                             reinterpret_cast<LPARAM>(label.data()));
                auto rect = item.rcItem;
                rect.left += 10;
                rect.right -= 10;
                DrawTextW(dc, label.c_str(), -1, &rect,
                          DT_SINGLELINE | DT_VCENTER | DT_END_ELLIPSIS);
            }
        }
    } else {
        FillRect(dc, &item.rcItem, background_brush);
        auto rect = item.rcItem;
        InflateRect(&rect, -1, -1);
        const bool tool_active = item.CtlID >= DrawSelect && item.CtlID <= DrawContour &&
                                 selection(edit_window, Tool) == int(item.CtlID - DrawSelect);
        const bool paint_button = item.CtlID >= PaintRequired && item.CtlID <= PaintInteraction;
        const bool paint_active = paint_button && selection(edit_window, Tool) == 1 && selection(edit_window, ConstraintTypeId) ==
                                                      int(item.CtlID - PaintRequired);
        const auto paint_color = item.CtlID == PaintRequired      ? RGB(48, 195, 135)
                                 : item.CtlID == PaintForbidden   ? RGB(242, 87, 105)
                                 : item.CtlID == PaintInteraction ? RGB(184, 112, 245)
                                                                  : RGB(255, 210, 60);
        const bool primary = tool_active || item.CtlID == Start || item.CtlID == NewMotion ||
                             item.CtlID == Commit || item.CtlID == SaveLayer ||
                             item.CtlID == TestInput ||
                             (item.CtlID == ConstraintsTab && inspector_tab == 0) ||
                             (item.CtlID == FingersTab && inspector_tab == 1) ||
                             (item.CtlID == RecordingTab && inspector_tab == 2) ||
                             (item.CtlID == LayersTab && inspector_tab == 3) ||
                             (item.CtlID == InteractionTab && inspector_tab == 4) ||
                             (item.CtlID == MovementTab && inspector_tab == 5) ||
                             (item.CtlID == StudioMovements && studio_view == 0) ||
                             (item.CtlID == StudioEdit && studio_view == 1) ||
                             (item.CtlID == StudioTest && studio_view == 2);
        const bool toggle = item.CtlID == Theme || item.CtlID == Logs || item.CtlID == TrackHands ||
                            item.CtlID == Keys || item.CtlID == Mirror ||
                            item.CtlID == GridViewMode;
        wchar_t label[256]{};
        GetWindowTextW(item.hwndItem, label, 256);
        const bool checked =
            toggle && (std::wstring_view(label).find(L"On") != std::wstring_view::npos ||
                       (item.CtlID == Theme && dark));
        const bool hover = GetPropW(item.hwndItem, L"MIGHover") != nullptr;
        const auto brush =
            CreateSolidBrush(paint_active                               ? paint_color
                             : primary || checked                       ? colors.primary
                             : hover || (item.itemState & ODS_SELECTED) ? colors.hover
                                                                        : colors.surface);
        const auto pen = CreatePen(PS_SOLID, (item.itemState & ODS_FOCUS) ? 2 : 1,
                                   paint_button                   ? paint_color
                                   : (item.itemState & ODS_FOCUS) ? colors.accent
                                                                  : colors.border);
        SelectObject(dc, brush);
        SelectObject(dc, pen);
        RoundRect(dc, rect.left, rect.top, rect.right, rect.bottom, 6, 6);
        if (primary || checked) {
            SetTextColor(dc, RGB(255, 255, 255));
        }
        if (paint_button) {
            SetTextColor(dc, paint_active || !dark ? RGB(20, 20, 20) : paint_color);
        }
        if (item.CtlID == DeleteInput || item.CtlID == DeleteLayer ||
            item.CtlID == DeleteConstraint || item.CtlID == DeleteStep ||
            item.CtlID == DeleteFinger) {
            SetTextColor(dc, dark ? RGB(255, 170, 166) : RGB(163, 39, 38));
        }
        if (item.itemState & ODS_DISABLED) {
            SetTextColor(dc, colors.muted);
        }
        if (toggle && item.CtlID != Theme && item.CtlID != GridViewMode) {
            const auto track = CreateSolidBrush(checked ? RGB(255, 255, 255) : colors.muted);
            const auto old = SelectObject(dc, track);
            RoundRect(dc, rect.left + 8, rect.top + 10, rect.left + 30, rect.top + 22, 12, 12);
            const auto knob = CreateSolidBrush(checked ? colors.accent : colors.surface);
            SelectObject(dc, knob);
            const int x = rect.left + (checked ? 20 : 10);
            Ellipse(dc, x, rect.top + 12, x + 8, rect.top + 20);
            SelectObject(dc, old);
            DeleteObject(knob);
            DeleteObject(track);
            rect.left += 32;
        }
        DrawTextW(dc, label, -1, &rect, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);
        SelectObject(dc, GetStockObject(NULL_BRUSH));
        SelectObject(dc, GetStockObject(BLACK_PEN));
        DeleteObject(brush);
        DeleteObject(pen);
    }
    RestoreDC(dc, saved);
}
void App::toggle_logs() {
    if (!log_window) {
        WNDCLASSW klass{};
        klass.lpfnWndProc = log_procedure;
        klass.hInstance = GetModuleHandleW(nullptr);
        klass.lpszClassName = L"MIGLogs";
        klass.hCursor = LoadCursor(nullptr, IDC_ARROW);
        RegisterClassW(&klass);
        RECT client{};
        GetClientRect(window, &client);
        log_window = CreateWindowW(klass.lpszClassName, L"MIG - Log terminal",
                                   editor ? WS_CHILD | WS_CLIPCHILDREN : WS_OVERLAPPEDWINDOW,
                                   editor ? 0 : 240, editor ? 96 : 200, editor ? client.right : 760,
                                   editor ? client.bottom - 128 : 480, window, nullptr,
                                   klass.hInstance, nullptr);
        if (!log_window) {
            throw std::runtime_error("Cannot open log terminal");
        }
    }
    logs_visible = !logs_visible;
    ShowWindow(log_window, logs_visible && !diagnostic_mode ? SW_SHOW : SW_HIDE);
    SetDlgItemTextW(window, Logs, logs_visible ? L"Logs: On" : L"Logs: Off");
    update_theme();
    shown_log_version = ~std::uint64_t{};
}
LRESULT CALLBACK log_procedure(HWND window, UINT message, WPARAM wp, LPARAM lp) {
    auto& app = *application;
    switch (message) {
    case WM_CREATE: {
        const auto edit = control(window, L"EDIT", L"", 1, 0, 0, 740, 420,
                                  ES_MULTILINE | ES_READONLY | WS_VSCROLL | ES_AUTOVSCROLL);
        SendMessageW(edit, WM_SETFONT, reinterpret_cast<WPARAM>(app.mono_font), TRUE);
        if constexpr (editor) {
            control(window, L"BUTTON", L"Back to workspace", KeyCancel, 16, 12, 180, 32);
        }
        return 0;
    }
    case WM_SIZE:
        MoveWindow(GetDlgItem(window, 1), 0, editor ? 60 : 0, LOWORD(lp),
                   HIWORD(lp) - (editor ? 60 : 0), TRUE);
        return 0;
    case WM_COMMAND:
        if (LOWORD(wp) == KeyCancel) {
            app.toggle_logs();
        }
        return 0;
    case WM_DRAWITEM:
        app.draw_control(*reinterpret_cast<DRAWITEMSTRUCT*>(lp));
        return TRUE;
    case WM_CTLCOLORSTATIC:
    case WM_CTLCOLOREDIT:
        SetTextColor(reinterpret_cast<HDC>(wp), app.palette().text);
        SetBkColor(reinterpret_cast<HDC>(wp), app.palette().surface);
        return reinterpret_cast<LRESULT>(app.surface_brush);
    case WM_CLOSE:
        app.logs_visible = false;
        ShowWindow(window, SW_HIDE);
        SetDlgItemTextW(app.window, Logs, L"Logs: Off");
        return 0;
    case WM_DESTROY:
        app.log_window = nullptr;
        return 0;
    }
    return DefWindowProcW(window, message, wp, lp);
}
} // namespace mig::app
