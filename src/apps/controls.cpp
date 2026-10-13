#include "app.hpp"
#include "scrollbars.hpp"
#include <commctrl.h>
#include <dwmapi.h>
namespace mig::app {
App* application{};
namespace {
LRESULT CALLBACK modern_control(HWND window, UINT message, WPARAM wp, LPARAM lp, UINT_PTR id,
                                DWORD_PTR) {
    if (message == WM_ERASEBKGND) {
        // The custom combo painter covers its entire client area in WM_PAINT.
        if (id != 2) {
            RECT area{};
            GetClientRect(window, &area);
            FillRect(reinterpret_cast<HDC>(wp), &area,
                     id == 3 ? application->surface_brush : application->background_brush);
        }
        return 1;
    }
    if (id == 3 && (GetWindowLongW(window, GWL_STYLE) & ES_MULTILINE) &&
        (message == WM_PRINTCLIENT || message == WM_PRINT)) {
        return DefSubclassProc(window, message, wp, lp);
    }
    if (message == WM_MOUSEMOVE) {
        if (!GetPropW(window, L"MIGHover")) {
            SetPropW(window, L"MIGHover", reinterpret_cast<HANDLE>(1));
            TRACKMOUSEEVENT tracking{sizeof(tracking), TME_LEAVE, window, 0};
            TrackMouseEvent(&tracking);
            InvalidateRect(window, nullptr, FALSE);
        }
    } else if (message == WM_MOUSELEAVE) {
        RemovePropW(window, L"MIGHover");
        InvalidateRect(window, nullptr, FALSE);
    } else if ((id == 2 &&
                (message == WM_PAINT || message == WM_PRINTCLIENT || message == WM_PRINT)) ||
               (id == 3 && (message == WM_PRINTCLIENT || message == WM_PRINT))) {
        PAINTSTRUCT paint{};
        const auto dc =
            message == WM_PAINT ? BeginPaint(window, &paint) : reinterpret_cast<HDC>(wp);
        RECT rect{};
        GetClientRect(window, &rect);
        const auto& app = *application;
        FillRect(dc, &rect, app.surface_brush);
        const auto pen = CreatePen(
            PS_SOLID, 1, GetFocus() == window ? app.palette().accent : app.palette().border);
        const auto old = SelectObject(dc, pen);
        const auto brush = SelectObject(dc, GetStockObject(NULL_BRUSH));
        RoundRect(dc, 0, 0, rect.right, rect.bottom, 6, 6);
        SelectObject(dc, app.font);
        SetTextColor(dc, app.palette().text);
        SetBkMode(dc, TRANSPARENT);
        wchar_t value[256]{};
        GetWindowTextW(window, value, 256);
        RECT text{8, 0, rect.right - (id == 2 ? 24 : 8), rect.bottom};
        DrawTextW(dc, value, -1, &text, DT_SINGLELINE | DT_VCENTER | DT_END_ELLIPSIS);
        if (id == 2) {
            MoveToEx(dc, rect.right - 16, rect.bottom / 2 - 2, nullptr);
            LineTo(dc, rect.right - 12, rect.bottom / 2 + 2);
            LineTo(dc, rect.right - 8, rect.bottom / 2 - 2);
        }
        SelectObject(dc, brush);
        SelectObject(dc, old);
        DeleteObject(pen);
        if (message == WM_PAINT) {
            EndPaint(window, &paint);
        }
        return 0;
    } else if (message == WM_NCDESTROY) {
        RemovePropW(window, L"MIGHover");
        RemoveWindowSubclass(window, modern_control, id);
    }
    return DefSubclassProc(window, message, wp, lp);
}
} // namespace
HWND control(HWND parent, const wchar_t* type, const wchar_t* text, int id, int x, int y, int width,
             int height, DWORD style) {
    if (std::wstring_view(type) == L"BUTTON") {
        style = BS_OWNERDRAW;
    } else if (std::wstring_view(type) == L"COMBOBOX") {
        style |= CBS_OWNERDRAWFIXED | CBS_HASSTRINGS;
    }
    auto child = CreateWindowExW(
        0, type, text, WS_CHILD | WS_VISIBLE | WS_TABSTOP | WS_CLIPSIBLINGS | style, x, y, width,
        height, parent, reinterpret_cast<HMENU>(INT_PTR(id)), GetModuleHandleW(nullptr), nullptr);
    SendMessageW(child, WM_SETFONT, reinterpret_cast<WPARAM>(application->font), TRUE);
    if (std::wstring_view(type) == L"BUTTON" || std::wstring_view(type) == L"COMBOBOX" ||
        std::wstring_view(type) == L"EDIT") {
        SetWindowSubclass(child, modern_control,
                          std::wstring_view(type) == L"BUTTON"     ? 1
                          : std::wstring_view(type) == L"COMBOBOX" ? 2
                                                                   : 3,
                          0);
    }
    if (std::wstring_view(type) == L"COMBOBOX") {
        SendMessageW(child, CB_SETITEMHEIGHT, WPARAM(-1), 24);
        SendMessageW(child, CB_SETITEMHEIGHT, 0, 24);
    }
    const auto colors = application->palette();
    const ScrollbarColors scroll{colors.surface, colors.border, colors.muted};
    theme_scrollbars(child, scroll);
    COMBOBOXINFO info{sizeof(info)};
    if (GetComboBoxInfo(child, &info) && info.hwndList) {
        theme_scrollbars(info.hwndList, scroll);
    }
    return child;
}
void position_control(HWND child, int x, int y, int width, int height) {
    if (!child) {
        return;
    }
    RECT current{};
    GetWindowRect(child, &current);
    MapWindowPoints(nullptr, GetParent(child), reinterpret_cast<POINT*>(&current), 2);
    wchar_t type[32]{};
    GetClassNameW(child, type, 32);
    int current_height = current.bottom - current.top;
    if (_wcsicmp(type, L"COMBOBOX") == 0) {
        RECT dropped{};
        SendMessageW(child, CB_GETDROPPEDCONTROLRECT, 0, reinterpret_cast<LPARAM>(&dropped));
        current_height = dropped.bottom - dropped.top;
    }
    if (current.left == x && current.top == y && current.right - current.left == width &&
        current_height == height) {
        return;
    }
    // Schedule one final paint after layout, rather than erase/paint every move synchronously.
    SetWindowPos(child, nullptr, x, y, width, height, SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOREDRAW);
    RedrawWindow(child, nullptr, nullptr, RDW_INVALIDATE | RDW_ALLCHILDREN | RDW_FRAME);
}
void choices(HWND parent, int id, std::initializer_list<const wchar_t*> items) {
    for (auto item : items) {
        SendDlgItemMessageW(parent, id, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(item));
    }
    SendDlgItemMessageW(parent, id, CB_SETCURSEL, 0, 0);
}
int selection(HWND parent, int id) {
    const auto result = SendDlgItemMessageW(parent, id, CB_GETCURSEL, 0, 0);
    return result == CB_ERR ? 0 : int(result);
}
std::string text_value(HWND parent, int id) {
    const auto length = GetWindowTextLengthW(GetDlgItem(parent, id));
    if (length > 65536) {
        throw std::runtime_error("Text field too long");
    }
    std::wstring text(std::size_t(length) + 1, L'\0');
    const int count = GetDlgItemTextW(parent, id, text.data(), int(text.size()));
    text.resize(count);
    return narrow(text);
}
int integer_value(HWND parent, int id, int minimum, int maximum) {
    const auto text = text_value(parent, id);
    std::size_t consumed{};
    const int value = std::stoi(text, &consumed);
    if (consumed != text.size() || value < minimum || value > maximum) {
        throw std::runtime_error("Numeric field out of range");
    }
    return value;
}
} // namespace mig::app
