#include "import_review.hpp"
#include "app.hpp"
#include <dwmapi.h>

namespace mig::app {
namespace {
struct ReviewDialog {
    bool accepted{}, done{};
};
constexpr int summary_id = 1001;
LRESULT CALLBACK review_proc(HWND window, UINT message, WPARAM wp, LPARAM lp) {
    auto* state = reinterpret_cast<ReviewDialog*>(GetWindowLongPtrW(window, GWLP_USERDATA));
    if (message == WM_NCCREATE) {
        state = static_cast<ReviewDialog*>(reinterpret_cast<CREATESTRUCTW*>(lp)->lpCreateParams);
        SetWindowLongPtrW(window, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(state));
    }
    if (state && ((message == WM_COMMAND && (LOWORD(wp) == IDOK || LOWORD(wp) == IDCANCEL)) ||
                  message == WM_CLOSE)) {
        state->accepted = message == WM_COMMAND && LOWORD(wp) == IDOK;
        state->done = true;
        return 0;
    }
    if (message == WM_DRAWITEM) {
        application->draw_control(*reinterpret_cast<DRAWITEMSTRUCT*>(lp));
        return TRUE;
    }
    if (message == WM_CTLCOLORSTATIC || message == WM_CTLCOLOREDIT) {
        const auto colors = application->palette();
        SetTextColor(reinterpret_cast<HDC>(wp), colors.text);
        SetBkColor(reinterpret_cast<HDC>(wp), colors.surface);
        return reinterpret_cast<LRESULT>(application->surface_brush);
    }
    if (message == WM_ERASEBKGND) {
        return 1;
    }
    if (message == WM_PAINT || message == WM_PRINTCLIENT) {
        PAINTSTRUCT paint{};
        const auto dc =
            message == WM_PAINT ? BeginPaint(window, &paint) : reinterpret_cast<HDC>(wp);
        RECT area{};
        GetClientRect(window, &area);
        FillRect(dc, &area, application->background_brush);
        const auto saved = SaveDC(dc);
        const auto colors = application->palette();
        SelectObject(dc, application->heading_font);
        SetBkMode(dc, TRANSPARENT);
        SetTextColor(dc, colors.text);
        RECT heading{24, 18, area.right - 24, 58};
        DrawTextW(dc, L"Review your profile", -1, &heading, DT_SINGLELINE | DT_VCENTER);
        SelectObject(dc, application->font);
        SetTextColor(dc, colors.muted);
        RECT hint{24, 60, area.right - 24, 84};
        DrawTextW(dc, L"Check the movements and keys before importing.", -1, &hint, DT_SINGLELINE);
        const auto pen = CreatePen(PS_SOLID, 1, colors.border);
        SelectObject(dc, pen);
        SelectObject(dc, application->surface_brush);
        RoundRect(dc, 20, 90, area.right - 20, 492, 6, 6);
        RestoreDC(dc, saved);
        DeleteObject(pen);
        if (message == WM_PAINT) {
            EndPaint(window, &paint);
        }
        return 0;
    }
    return DefWindowProcW(window, message, wp, lp);
}
} // namespace
bool App::review_import(const Configuration& proposed) {
    // Disable consent before opening a modal loop: timers can still run inside it.
    release_keys();
    keyboard_enabled = false;
    SetDlgItemTextW(window, Keys, L"Keyboard: Off");
    const auto instance = GetModuleHandleW(nullptr);
    WNDCLASSW cls{};
    cls.lpfnWndProc = review_proc;
    cls.hInstance = instance;
    cls.lpszClassName = L"MIGImportReview";
    cls.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    RegisterClassW(&cls);
    ReviewDialog state;
    const auto dialog =
        CreateWindowExW(WS_EX_DLGMODALFRAME, cls.lpszClassName,
                        L"Review imported movement mappings", WS_CAPTION | WS_SYSMENU | WS_POPUP,
                        CW_USEDEFAULT, CW_USEDEFAULT, 760, 600, window, nullptr, instance, &state);
    if (!dialog) {
        throw std::runtime_error("Cannot create import review window");
    }
    auto text = wide(ui::configuration_review(proposed));
    std::wstring content;
    for (const auto character : text) {
        if (character == L'\n') {
            content += L'\r';
        }
        content += character;
    }
    const auto summary = control(dialog, L"EDIT", L"", summary_id, 30, 100, 684, 382,
                                 WS_VSCROLL | ES_MULTILINE | ES_READONLY);
    if (!summary) {
        DestroyWindow(dialog);
        throw std::runtime_error("Cannot display import review");
    }
    SendMessageW(summary, EM_SETLIMITTEXT, 0, 0);
    if (!SetWindowTextW(summary, content.c_str()) ||
        std::size_t(GetWindowTextLengthW(summary)) != content.size()) {
        DestroyWindow(dialog);
        throw std::runtime_error("Cannot display complete import review");
    }
    for (const auto [id, label, x] : {std::tuple{IDOK, L"Import reviewed profile", 368},
                                      std::tuple{IDCANCEL, L"Cancel", 600}}) {
        const auto button =
            control(dialog, L"BUTTON", label, id, x, 512, id == IDOK ? 216 : 120, 36);
        if (id == IDOK) {
            SetPropW(button, L"MIGPrimary", reinterpret_cast<HANDLE>(1));
        }
    }
    const BOOL dark_title = dark;
    DwmSetWindowAttribute(dialog, 20, &dark_title, sizeof(dark_title));
    EnableWindow(window, FALSE);
    ShowWindow(dialog, SW_SHOW);
    SetFocus(GetDlgItem(dialog, IDCANCEL));
    MSG message{};
    while (!state.done) {
        const auto message_status = GetMessageW(&message, nullptr, 0, 0);
        if (message_status <= 0) {
            if (message_status == 0) {
                PostQuitMessage(int(message.wParam));
            }
            break;
        }
        if (message.message == WM_KEYDOWN && message.wParam == VK_RETURN) {
            SendMessageW(dialog, WM_COMMAND,
                         GetFocus() == GetDlgItem(dialog, IDOK) ? IDOK : IDCANCEL, 0);
        } else if (!IsDialogMessageW(dialog, &message)) {
            TranslateMessage(&message);
            DispatchMessageW(&message);
        }
    }
    EnableWindow(window, TRUE);
    DestroyWindow(dialog);
    SetActiveWindow(window);
    return state.accepted;
}
} // namespace mig::app
