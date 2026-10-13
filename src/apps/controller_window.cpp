#include "app.hpp"
#include <commctrl.h>

namespace mig::app {
namespace {
void button(HWND window, int id, const wchar_t* name) {
    control(window, L"BUTTON", name, id, 0, 0, 100, 32);
}
void create_controller(App& app, HWND window) {
    app.window = window;
    app.font = CreateFontW(-16, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                           OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                           DEFAULT_PITCH, L"Segoe UI");
    app.mono_font = CreateFontW(-14, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                                OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                DEFAULT_PITCH, L"Consolas");
    app.heading_font = CreateFontW(-28, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                                   OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                   DEFAULT_PITCH, L"Georgia");
    if (!app.profiles) {
        app.profiles = std::make_unique<controller::Profiles>(
            std::filesystem::temp_directory_path() / "mig-controller-ui-unused");
    }
    control(window, L"COMBOBOX", L"", ProfileList, 0, 0, 250, 280, CBS_DROPDOWNLIST | WS_VSCROLL);
    control(window, L"EDIT", L"", ProfileName, 0, 0, 250, 32, ES_AUTOHSCROLL);
    for (const auto [id, name] : {std::pair{Load, L"Import profile"},
                                  {Save, L"Export file"},
                                  {RenameProfile, L"Save name"},
                                  {Start, L"Start"},
                                  {Stop, L"Stop"},
                                  {Calibrate, L"Recalibrate"},
                                  {Keys, L"Keyboard: Off"},
                                  {ViewMenu, L"View"},
                                  {ProfileManagement, L"Manage profile"},
                                  {OpenView, L"Open"}}) {
        button(window, id, name);
    }
    const auto list = control(window, L"LISTBOX", L"", MotionList, 0, 0, 300, 350,
                              LBS_NOTIFY | LBS_OWNERDRAWFIXED | LBS_HASSTRINGS | WS_VSCROLL |
                                  LBS_NOINTEGRALHEIGHT);
    SendMessageW(list, LB_SETITEMHEIGHT, 0, 104);
    app.preview_enabled = false;
    app.update_theme();
    app.refresh_profiles();
    app.refresh_list();
    app.layout();
    SetTimer(window, 1, 16, nullptr);
}
void view_menu(App& app) {
    const auto menu = CreatePopupMenu();
    const auto add = [&](int id, const wchar_t* name, bool checked) {
        AppendMenuW(menu, MF_STRING | (checked ? MF_CHECKED : 0), id, name);
    };
    add(CameraView, L"Camera preview", app.controller_camera);
    add(ViewGrid, L"Grid", app.show_grid);
    add(ViewHands, L"Hand detections", app.show_hands);
    add(ViewDots, L"Body dots", app.show_dots);
    add(VerifyView, L"Verify bindings (keyboard paused)", app.controller_verify);
    add(CompactView, L"Compact background window", app.controller_compact);
    add(Theme, L"Dark mode", app.dark);
    RECT anchor{};
    GetWindowRect(GetDlgItem(app.window, ViewMenu), &anchor);
    const auto chosen =
        TrackPopupMenu(menu, TPM_RETURNCMD, anchor.left, anchor.bottom, 0, app.window, nullptr);
    DestroyMenu(menu);
    if (chosen) {
        app.controller_view(int(chosen));
    }
}
void command(App& app, int id, int notification) {
    if (id == ProfileList && notification == CBN_SELCHANGE) {
        try {
            app.activate_profile(std::size_t(selection(app.window, ProfileList)));
        } catch (...) {
            app.refresh_profiles();
            throw;
        }
    } else if (id == MotionList && notification == LBN_SELCHANGE) {
        const auto selected = SendDlgItemMessageW(app.window, MotionList, LB_GETCURSEL, 0, 0);
        if (selected >= 0) {
            app.selected = std::size_t(selected);
            std::lock_guard lock(app.state_mutex);
            app.verification = app.controller_verify ? int(selected) : -1;
            app.snapshot.reset();
        }
        InvalidateRect(app.window, nullptr, FALSE);
    } else if (notification == BN_CLICKED) {
        switch (id) {
        case Start:
            if (app.config.motions.empty()) {
                app.message("Import a profile before starting.");
            } else {
                app.start();
            }
            break;
        case Stop:
            app.stop();
            break;
        case Calibrate:
            app.release_keys();
            {
                std::lock_guard lock(app.state_mutex);
                app.recalibrate = true;
                ++app.profile_revision;
                app.snapshot.reset();
                app.pending_events.clear();
            }
            break;
        case Keys:
            app.keyboard_enabled = !app.keyboard_enabled;
            app.release_keys();
            SetDlgItemTextW(app.window, Keys,
                            app.keyboard_enabled ? L"Keyboard: On" : L"Keyboard: Off");
            break;
        case Load:
        case Save:
            app.controller_file(id == Save);
            break;
        case RenameProfile:
            if (app.profiles->selected() >= 0) {
                app.profiles->rename(std::size_t(app.profiles->selected()),
                                     text_value(app.window, ProfileName));
                app.refresh_profiles();
            }
            break;
        case ViewMenu:
            view_menu(app);
            break;
        case ProfileManagement:
            app.profile_management = !app.profile_management;
            SetDlgItemTextW(app.window, ProfileManagement,
                            app.profile_management ? L"Done" : L"Manage profile");
            app.layout();
            break;
        case OpenView:
            app.controller_view(CompactView);
            break;
        }
    }
}
void paint_window(App& app) {
    PAINTSTRUCT paint{};
    const auto dc = BeginPaint(app.window, &paint);
    RECT client{};
    GetClientRect(app.window, &client);
    if (app.preview_buffer.resize(dc, client.right, client.bottom)) {
        const auto memory = app.preview_buffer.dc();
        const auto state = SaveDC(memory);
        app.paint(memory);
        BitBlt(dc, 0, 0, client.right, client.bottom, memory, 0, 0, SRCCOPY);
        RestoreDC(memory, state);
    }
    EndPaint(app.window, &paint);
}
} // namespace
void App::layout() {
    RECT rect{};
    GetClientRect(window, &rect);
    const auto place = [&](int id, int x, int y, int width, int height = 32) {
        MoveWindow(GetDlgItem(window, id), x, y, width, id == ProfileList ? 280 : height, TRUE);
    };
    for (int id : {ProfileList, ProfileName, RenameProfile, Load, Save, Start, Stop, Calibrate,
                   Keys, ViewMenu, MotionList, ProfileManagement}) {
        ShowWindow(GetDlgItem(window, id), controller_compact ? SW_HIDE : SW_SHOW);
    }
    ShowWindow(GetDlgItem(window, OpenView), controller_compact ? SW_SHOW : SW_HIDE);
    if (controller_compact) {
        place(OpenView, rect.right - 100, 12, 84);
    } else {
        place(ViewMenu, rect.right - 88, 20, 72);
        place(ProfileList, 16, 88, rect.right - 186);
        place(ProfileManagement, rect.right - 156, 88, 140);
        for (int id : {ProfileName, RenameProfile, Load, Save}) {
            ShowWindow(GetDlgItem(window, id), profile_management ? SW_SHOW : SW_HIDE);
        }
        place(ProfileName, 16, 132, rect.right - 134);
        place(RenameProfile, rect.right - 110, 132, 94);
        place(Load, 16, 174, 124);
        place(Save, 150, 174, 108);
        const int session_y = profile_management ? 236 : 152;
        place(Start, 16, session_y, 76);
        place(Stop, 102, session_y, 70);
        place(Calibrate, 182, session_y, 112);
        place(Keys, rect.right - 168, session_y, 152);
        const int list_width = controller_camera ? 300 : rect.right - 32;
        const int content_y = profile_management ? 304 : 220;
        place(MotionList, rect.right - list_width - 16, content_y, list_width,
              std::max(80, int(rect.bottom) - content_y - 50));
    }
    InvalidateRect(window, nullptr, FALSE);
}
void App::controller_view(int command) {
    if (command == CompactView) {
        controller_compact = !controller_compact;
        if (controller_compact) {
            GetWindowRect(window, &expanded_bounds);
            SetWindowPos(window, nullptr, 0, 0, 340, 116, SWP_NOMOVE | SWP_NOZORDER);
        } else {
            SetWindowPos(window, nullptr, expanded_bounds.left, expanded_bounds.top,
                         expanded_bounds.right - expanded_bounds.left,
                         expanded_bounds.bottom - expanded_bounds.top, SWP_NOZORDER);
        }
    } else if (command == CameraView) {
        controller_camera = !controller_camera;
        if (controller_camera) {
            SetWindowPos(window, nullptr, 0, 0, 1100, 760, SWP_NOMOVE | SWP_NOZORDER);
        }
    } else if (command == VerifyView) {
        controller_verify = !controller_verify;
        release_keys();
        {
            std::lock_guard lock(state_mutex);
            verification =
                controller_verify && selected < config.motions.size() ? int(selected) : -1;
            pending_events.clear();
        }
        if (controller_verify && !controller_camera) {
            controller_view(CameraView);
        }
        show_grid = controller_verify;
    } else if (command == ViewGrid) {
        show_grid = !show_grid;
    } else if (command == ViewHands) {
        show_hands = !show_hands;
    } else if (command == ViewDots) {
        show_dots = !show_dots;
    } else if (command == Theme) {
        dark = !dark;
        update_theme();
    }
    preview_enabled = controller_camera && !controller_compact && !IsIconic(window);
    layout();
}
LRESULT CALLBACK procedure(HWND window, UINT message, WPARAM wp, LPARAM lp) {
    if (!application) {
        return DefWindowProcW(window, message, wp, lp);
    }
    auto& app = *application;
    try {
        switch (message) {
        case WM_CREATE:
            create_controller(app, window);
            return 0;
        case WM_SIZE:
            app.preview_enabled =
                app.controller_camera && !app.controller_compact && wp != SIZE_MINIMIZED;
            app.layout();
            return 0;
        case WM_COMMAND:
            command(app, LOWORD(wp), HIWORD(wp));
            return 0;
        case WM_TIMER:
            app.tick();
            return 0;
        case WM_DRAWITEM:
            app.draw_control(*reinterpret_cast<DRAWITEMSTRUCT*>(lp));
            return TRUE;
        case WM_MEASUREITEM:
            reinterpret_cast<MEASUREITEMSTRUCT*>(lp)->itemHeight =
                reinterpret_cast<MEASUREITEMSTRUCT*>(lp)->CtlType == ODT_LISTBOX ? 104 : 24;
            return TRUE;
        case WM_CTLCOLORSTATIC:
        case WM_CTLCOLOREDIT:
        case WM_CTLCOLORLISTBOX:
            SetTextColor(reinterpret_cast<HDC>(wp), app.palette().text);
            SetBkColor(reinterpret_cast<HDC>(wp), app.palette().surface);
            return reinterpret_cast<LRESULT>(app.surface_brush);
        case WM_PAINT:
            paint_window(app);
            return 0;
        case WM_ERASEBKGND:
            return 1;
        case WM_GETMINMAXINFO:
            reinterpret_cast<MINMAXINFO*>(lp)->ptMinTrackSize =
                app.controller_compact ? POINT{340, 116} : POINT{500, 460};
            return 0;
        case WM_CLOSE:
            app.stop();
            DestroyWindow(window);
            return 0;
        case WM_DESTROY:
            KillTimer(window, 1);
            PostQuitMessage(0);
            return 0;
        }
    } catch (const std::exception& error) {
        app.message(error.what());
        if (!app.diagnostic_mode) {
            MessageBoxW(window, wide(error.what()).c_str(), title, MB_OK | MB_ICONERROR);
        }
    }
    return DefWindowProcW(window, message, wp, lp);
}
} // namespace mig::app
