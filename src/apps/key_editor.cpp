#include "app.hpp"
namespace mig::app {
void App::update_key_preview() {
    key_preview.clear();
    key_preview_rows.clear();
    key_error.clear();
    try {
        key_preview = ui::parse_binding(text_value(key_window, KeyExpression));
        if (draft.action_mode == ActionMode::Hold && !key_preview.empty() &&
            key_preview.back().type != KeyboardActionType::Chord) {
            throw std::runtime_error("Hold needs a final shortcut, e.g. \"Hello\" _ Ctrl + C");
        }
        const auto tokens = ui::binding_tokens(key_preview);
        std::vector<std::string> row;
        std::size_t width = 0;
        for (const auto& token : tokens) {
            const auto size = std::min(std::size_t(84), token.size()) * 8 + 24;
            if (!row.empty() && width + size > 660) {
                key_preview_rows.push_back(std::move(row));
                row.clear();
                width = 0;
            }
            row.push_back(token);
            width += size;
        }
        if (!row.empty()) {
            key_preview_rows.push_back(std::move(row));
        }
    } catch (const std::exception& error) {
        key_preview.clear();
        key_error = error.what();
    }
    const auto list = GetDlgItem(key_window, KeySequenceList);
    SendMessageW(list, LB_RESETCONTENT, 0, 0);
    for (std::size_t i = 0; i < key_preview_rows.size(); ++i) {
        SendMessageW(list, LB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L""));
    }
    SetDlgItemTextW(key_window, KeyError,
                    wide(key_error.empty()
                             ? "Recognized: " + std::to_string(key_preview.size()) +
                                   " action(s). Runs in order; output is disabled while editing."
                             : key_error)
                        .c_str());
    EnableWindow(GetDlgItem(key_window, KeyApply), key_error.empty());
    InvalidateRect(list, nullptr, TRUE);
}
void App::open_keys() {
    if (key_window) {
        SetForegroundWindow(key_window);
        return;
    }
    release_keys();
    WNDCLASSW klass{};
    klass.lpfnWndProc = keys_procedure;
    klass.hInstance = GetModuleHandleW(nullptr);
    klass.lpszClassName = L"MIGKeys";
    klass.hCursor = LoadCursor(nullptr, IDC_ARROW);
    RegisterClassW(&klass);
    RECT client{};
    GetClientRect(window, &client);
    key_window =
        CreateWindowExW(WS_EX_CONTROLPARENT, klass.lpszClassName, L"MIG - Keyboard sequence",
                        WS_CHILD | WS_CLIPCHILDREN, 0, 96, client.right, client.bottom - 128,
                        window, nullptr, klass.hInstance, nullptr);
    if (!key_window) {
        throw std::runtime_error("Cannot open keyboard editor");
    }
    SetDlgItemTextW(key_window, KeyExpression, wide(text_value(edit_window, Key)).c_str());
    update_key_preview();
    update_theme();
    if (!diagnostic_mode) {
        ShowWindow(key_window, SW_SHOW);
        SetFocus(GetDlgItem(key_window, KeyExpression));
    }
}
LRESULT CALLBACK keys_procedure(HWND window, UINT message, WPARAM wp, LPARAM lp) {
    auto& app = *application;
    try {
        switch (message) {
        case WM_CREATE:
            control(window, L"STATIC",
                    L"Quoted text types characters. _ runs the next action. + holds shortcut keys "
                    L"together.\nExample: \"Hello world\" _ Enter _ Ctrl + C",
                    0, 20, 16, 700, 48);
            control(window, L"EDIT", L"None", KeyExpression, 20, 76, 700, 100,
                    ES_MULTILINE | ES_AUTOVSCROLL | WS_VSCROLL | WS_BORDER);
            SendDlgItemMessageW(window, KeyExpression, EM_SETLIMITTEXT, 65536, 0);
            control(window, L"STATIC", L"Recognized keys / text in execution order", 0, 20, 192,
                    700, 24);
            control(window, L"LISTBOX", L"", KeySequenceList, 20, 224, 700, 190,
                    LBS_OWNERDRAWFIXED | LBS_HASSTRINGS | WS_VSCROLL | LBS_NOINTEGRALHEIGHT);
            SendDlgItemMessageW(window, KeySequenceList, LB_SETITEMHEIGHT, 0, 40);
            control(window, L"STATIC", L"", KeyError, 20, 426, 700, 46);
            control(window, L"BUTTON", L"Apply sequence", KeyApply, 430, 484, 180, 32);
            control(window, L"BUTTON", L"Cancel", KeyCancel, 620, 484, 100, 32);
            return 0;
        case WM_COMMAND:
            if (LOWORD(wp) == KeyExpression && HIWORD(wp) == EN_CHANGE && app.key_window) {
                app.update_key_preview();
            } else if (LOWORD(wp) == KeyApply && app.key_error.empty()) {
                app.update_key_preview();
                if (!app.key_error.empty()) {
                    return 0;
                }
                const auto before = app.draft;
                app.draft.keyboard = app.key_preview;
                if (app.draft != before) {
                    app.remember_edit(before);
                }
                app.refresh_editor();
                DestroyWindow(window);
            } else if (LOWORD(wp) == KeyCancel) {
                DestroyWindow(window);
            }
            return 0;
        case WM_DRAWITEM:
            app.draw_control(*reinterpret_cast<DRAWITEMSTRUCT*>(lp));
            return TRUE;
        case WM_MEASUREITEM:
            reinterpret_cast<MEASUREITEMSTRUCT*>(lp)->itemHeight = 40;
            return TRUE;
        case WM_CTLCOLORSTATIC:
        case WM_CTLCOLOREDIT:
        case WM_CTLCOLORLISTBOX:
            SetTextColor(reinterpret_cast<HDC>(wp), app.palette().text);
            SetBkColor(reinterpret_cast<HDC>(wp), app.palette().surface);
            return reinterpret_cast<LRESULT>(app.surface_brush);
        case WM_ERASEBKGND: {
            RECT rect{};
            GetClientRect(window, &rect);
            FillRect(reinterpret_cast<HDC>(wp), &rect, app.background_brush);
            return 1;
        }
        case WM_CLOSE:
            DestroyWindow(window);
            return 0;
        case WM_DESTROY:
            app.key_window = nullptr;
            app.layout();
            SetFocus(app.edit_window);
            app.key_preview.clear();
            app.key_preview_rows.clear();
            app.key_error.clear();
            app.release_keys();
            {
                std::lock_guard lock(app.state_mutex);
                app.pending_events.clear();
            }
            return 0;
        }
    } catch (const std::exception& error) {
        app.message(error.what());
    }
    return DefWindowProcW(window, message, wp, lp);
}
namespace {
LRESULT CALLBACK details_procedure(HWND window, UINT message, WPARAM wp, LPARAM lp) {
    auto& app = *application;
    switch (message) {
    case WM_CREATE:
        control(window, L"EDIT",
                wide(ui::binding_description(app.draft) +
                     "\r\nKeyboard: " + ui::binding_label(app.draft.keyboard))
                    .c_str(),
                1, 12, 12, 700, 440, ES_MULTILINE | ES_READONLY | WS_VSCROLL | WS_BORDER);
        control(window, L"BUTTON", L"Back to editing", KeyCancel, 12, 12, 180, 32);
        return 0;
    case WM_COMMAND:
        if (LOWORD(wp) == KeyCancel) {
            DestroyWindow(window);
        }
        return 0;
    case WM_SIZE:
        MoveWindow(GetDlgItem(window, 1), 12, 60, std::max(100, int(LOWORD(lp)) - 24),
                   std::max(100, int(HIWORD(lp)) - 76), TRUE);
        return 0;
    case WM_CTLCOLOREDIT:
    case WM_CTLCOLORSTATIC:
        SetTextColor(reinterpret_cast<HDC>(wp), app.palette().text);
        SetBkColor(reinterpret_cast<HDC>(wp), app.palette().surface);
        return reinterpret_cast<LRESULT>(app.surface_brush);
    case WM_CLOSE:
        DestroyWindow(window);
        return 0;
    case WM_DESTROY:
        app.details_window = nullptr;
        app.layout();
        SetFocus(app.edit_window);
        return 0;
    case WM_ERASEBKGND: {
        RECT rect{};
        GetClientRect(window, &rect);
        FillRect(reinterpret_cast<HDC>(wp), &rect, app.background_brush);
        return 1;
    }
    }
    return DefWindowProcW(window, message, wp, lp);
}
} // namespace
void App::open_binding_details() {
    if (details_window) {
        DestroyWindow(details_window);
    }
    WNDCLASSW klass{};
    klass.lpfnWndProc = details_procedure;
    klass.hInstance = GetModuleHandleW(nullptr);
    klass.lpszClassName = L"MIGBindings";
    klass.hCursor = LoadCursor(nullptr, IDC_ARROW);
    RegisterClassW(&klass);
    RECT client{};
    GetClientRect(window, &client);
    details_window =
        CreateWindowExW(WS_EX_CONTROLPARENT, klass.lpszClassName, L"MIG - Input bindings",
                        WS_CHILD | WS_CLIPCHILDREN, 0, 96, client.right, client.bottom - 128,
                        window, nullptr, klass.hInstance, nullptr);
    update_theme();
    if (!diagnostic_mode) {
        ShowWindow(details_window, SW_SHOW);
    }
}
} // namespace mig::app
