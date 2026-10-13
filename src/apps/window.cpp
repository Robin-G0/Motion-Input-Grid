#include "app.hpp"
#include <commctrl.h>
#include <dwmapi.h>
namespace mig::app {
namespace {
void button(HWND parent, int id, const wchar_t* label, int x, int y, int width = 100) {
    control(parent, L"BUTTON", label, id, x, y, width, 32);
}
void combo(HWND parent, int id, int x, int y, int width = 150) {
    control(parent, L"COMBOBOX", L"", id, x, y, width, 250, CBS_DROPDOWNLIST | WS_VSCROLL);
}
void edit(HWND parent, int id, const wchar_t* value, int x, int y, int width = 80) {
    control(parent, L"EDIT", value, id, x, y, width, 28, WS_BORDER | ES_AUTOHSCROLL);
}
void label(HWND parent, const wchar_t* value, int x, int y, int width = 150, int id = 0) {
    control(parent, L"STATIC", value, id, x, y, width, 22);
}
void paint_window(HWND window, bool editor_window) {
    PAINTSTRUCT paint{};
    const auto dc = BeginPaint(window, &paint);
    struct EndPainting {
        HWND window;
        PAINTSTRUCT& paint;
        ~EndPainting() {
            EndPaint(window, &paint);
        }
    } end{window, paint};
    RECT client{};
    GetClientRect(window, &client);
    if (client.right > 0 && client.bottom > 0) {
        auto& buffer = editor_window ? application->editor_buffer : application->preview_buffer;
        if (buffer.resize(dc, client.right, client.bottom)) {
            const auto memory = buffer.dc();
            const auto state = SaveDC(memory);
            if (state) {
                struct RestorePainting {
                    HDC dc;
                    int state;
                    ~RestorePainting() {
                        RestoreDC(dc, state);
                    }
                } restore{memory, state};
                if (editor_window) {
                    application->paint_editor(memory);
                } else {
                    application->paint(memory);
                }
                BitBlt(dc, 0, 0, client.right, client.bottom, memory, 0, 0, SRCCOPY);
            }
        }
    }
}
LRESULT color_control(WPARAM wp, bool surface) {
    auto& app = *application;
    const auto palette = app.palette();
    const auto dc = reinterpret_cast<HDC>(wp);
    SetTextColor(dc, palette.text);
    SetBkColor(dc, surface ? palette.surface : palette.background);
    return reinterpret_cast<LRESULT>(surface ? app.surface_brush : app.background_brush);
}
WNDPROC list_original{};
LRESULT CALLBACK list_procedure(HWND window, UINT message, WPARAM wp, LPARAM lp) {
    const auto result = CallWindowProcW(list_original, window, message, wp, lp);
    if (message == WM_LBUTTONUP) {
        const auto hit = SendMessageW(window, LB_ITEMFROMPOINT, 0, lp);
        if (HIWORD(hit) == 0) {
            RECT row{};
            SendMessageW(window, LB_GETITEMRECT, LOWORD(hit), reinterpret_cast<LPARAM>(&row));
            for (int i = 0; i < 3; ++i) {
                auto button = motion_button_rect(row, i);
                if (PtInRect(&button, {GET_X_LPARAM(lp), GET_Y_LPARAM(lp)})) {
                    const int commands[]{EditInput, TestInput, DeleteInput};
                    SendMessageW(GetParent(window), WM_COMMAND, commands[i], 0);
                    break;
                }
            }
        }
    }
    return result;
}
} // namespace
void App::layout() {
    RECT client{};
    GetClientRect(window, &client);
    const int sidebar = client.right - 332;
    const auto place = [&](int id, int x, int y, int width, int height = 32) {
        const auto child = GetDlgItem(window, id);
        wchar_t type[32]{};
        GetClassNameW(child, type, 32);
        MoveWindow(child, x, y, width, _wcsicmp(type, L"COMBOBOX") == 0 ? 280 : height, TRUE);
    };
    place(FileMenu, 230, 10, 62, 28);
    place(EditMenu, 298, 10, 62, 28);
    place(ViewMenu, 366, 10, 62, 28);
    place(Theme, client.right - 156, 6, 136, 28);
    place(Start, 24, 88, 122);
    place(Stop, 154, 88, 70);
    place(Calibrate, 232, 88, 112);
    place(RestartTest, 352, 88, 88);
    place(StopTest, 448, 88, 100);
    place(MotionList, sidebar + 16, 104, 300, std::max(100, int(client.bottom) - 366));
    place(NewMotion, sidebar + 16, client.bottom - 242, 300);
    place(RemoteControls, sidebar + 16, client.bottom - 200, 300);
    place(TrackHands, sidebar + 16, client.bottom - 148, 140);
    place(Keys, sidebar + 164, client.bottom - 148, 152);
    place(Logs, sidebar + 16, client.bottom - 106, 300);
    InvalidateRect(window, nullptr, FALSE);
}
void App::layout_editor() {
    RECT client{};
    GetClientRect(edit_window, &client);
    const int side = std::min(540, std::max(270, int(client.bottom) - (pro_mode ? 402 : 326)));
    editor_grid = {20, pro_mode ? 155 : 80, 20 + side, (pro_mode ? 155 : 80) + side};
    std::shared_ptr<const Snapshot> result;
    {
        std::lock_guard lock(state_mutex);
        result = snapshot;
    }
    update_grid_view(result);
    const auto place = [&](int id, int x, int y, int width, int height = 32) {
        const auto child = GetDlgItem(edit_window, id);
        wchar_t type[32]{};
        GetClassNameW(child, type, 32);
        MoveWindow(child, x, y, width, _wcsicmp(type, L"COMBOBOX") == 0 ? 280 : height, TRUE);
    };
    const auto show = [&](int id, bool visible) {
        ShowWindow(GetDlgItem(edit_window, id), visible ? SW_SHOW : SW_HIDE);
    };
    for (int id : {Duration, DurationCaption, StepList, AddStep, DeleteStep, StepUp, StepDown,
                   StepModeId, HoldTime, Trigger, PriorityId, ConstraintsTab, FingersTab,
                   RecordingTab, LayersTab, InteractionTab, PaintInteraction}) {
        show(id, pro_mode);
    }
    show(Tool, false);
    place(KeyCaption, 20, client.bottom - 150, 125, 22);
    place(Key, 150, client.bottom - 154, 292, 28);
    place(EditKeys, 452, client.bottom - 156, 98);
    place(KeyTokens, 20, client.bottom - 118, 530, 28);
    place(ActionModeCaption, 20, client.bottom - 194, 125, 22);
    place(ActionModeId, 150, client.bottom - 198, 200);
    place(RepeatCaption, 360, client.bottom - 194, 90, 22);
    place(RepeatInterval, 452, client.bottom - 198, 98, 28);
    const bool repeat = selection(edit_window, ActionModeId) == int(ActionMode::Repeat);
    show(RepeatCaption, repeat);
    show(RepeatInterval, repeat);
    place(BindingSummary, 580, 66, 300, 28);
    place(ClearFingers, 890, 66, 130, 28);
    show(ConstraintTypeId, false);
    show(ClearFingers, pro_mode && inspector_tab == 1 && !editor_help);
    show(Space, pro_mode);
    show(Cooldown, !pro_mode || inspector_tab == 0);
    show(CooldownCaption, !pro_mode || inspector_tab == 0);
    if (!pro_mode) {
        inspector_tab = 3;
    }
    place(StepList, 20, 80, 220);
    place(AddStep, 250, 80, 80);
    place(DeleteStep, 340, 80, 80);
    place(StepUp, 430, 80, 60);
    place(StepDown, 500, 80, 60);
    place(StepModeId, 20, 120, 170);
    place(HoldTime, 200, 120, 90, 28);
    place(Trigger, 300, 118, 130);
    place(PriorityId, 440, 120, 120);
    place(Members, 580, 100, 280);
    place(BrushOrder, 870, 100, 150);
    EnableWindow(GetDlgItem(edit_window, BrushOrder),
                 scope > 0 && draft.steps[scope - 1].mode == StepMode::Ordered &&
                     selection(edit_window, ConstraintTypeId) != int(ConstraintType::Forbidden) &&
                     selection(edit_window, PriorityId) == int(Priority::High));
    show(BrushOrder, IsWindowEnabled(GetDlgItem(edit_window, BrushOrder)) != FALSE);
    place(PaintRequired, 580, 142, pro_mode ? 104 : 140);
    place(PaintForbidden, pro_mode ? 692 : 730, 142, pro_mode ? 104 : 140);
    place(PaintTrigger, pro_mode ? 804 : 880, 142, pro_mode ? 104 : 140);
    place(PaintInteraction, 916, 142, 104);
    place(DrawPencil, 580, 184, 140);
    place(DrawBucket, 730, 184, 140);
    place(DrawSelect, 880, 184, 140);
    place(DrawEraser, 580, 226, 214);
    place(DrawContour, 804, 226, 216);
    place(Undo, 580, 268, 100);
    place(Redo, 690, 268, 100);
    place(DeleteConstraint, 800, 268, 220);
    show(DeleteConstraint, true);
    place(LayersTab, 580, 310, 72);
    place(ConstraintsTab, 660, 310, 92);
    place(FingersTab, 760, 310, 72);
    place(RecordingTab, 840, 310, 80);
    place(InteractionTab, 928, 310, 92);
    // Clicking the active advanced tab again returns to the layer stack.
    const bool layers = inspector_tab == 3 && !editor_help && !layer_members.empty();
    show(LayerList, layers);
    show(ToggleLayer, layers);
    show(DeleteLayer, layers);
    show(LayerBodyPart, layers);
    show(SaveLayer, layers);
    show(LayerCaption, layers);
    place(LayerList, 580, pro_mode ? 376 : 338, 440,
          std::max(80, int(client.bottom) - (pro_mode ? 558 : 520)));
    place(LayerCaption, 580, client.bottom - 172, 440, 22);
    place(LayerBodyPart, 580, client.bottom - 144, 280);
    place(SaveLayer, 870, client.bottom - 144, 150);
    place(ToggleLayer, 580, client.bottom - 96, 214);
    place(DeleteLayer, 804, client.bottom - 96, 216);
    for (int id : {ConstraintList, CellX, CellY, CellWidth, CellHeight, UpdateConstraint,
                   ConstraintUp, ConstraintDown}) {
        show(id, pro_mode && inspector_tab == 0 && !editor_help);
    }
    for (int id : {FingerScope, FingerHand, FingerId, FingerPoseId, FingerList, AddFinger,
                   DeleteFinger, FingerStable, FingerGrace, FingerTimingCaption}) {
        show(id, pro_mode && inspector_tab == 1 && !editor_help);
    }
    for (int id : {InteractionHand, InteractionGesture, InteractionHold, InteractionCaption,
                   SetInteraction}) {
        show(id, pro_mode && inspector_tab == 4 && !editor_help);
    }
    place(InteractionCaption, 580, 376, 440, 54);
    place(InteractionHand, 580, 442, 136);
    place(InteractionGesture, 726, 442, 294);
    place(InteractionHold, 580, 490, 136, 28);
    place(SetInteraction, 726, 488, 294);
    for (int id : {RecordLandmarks, RecordToggle, ConvertRecording, DiscardRecording, TrimBegin,
                   TrimEnd, TrimRecording, RecordAll, TraceMove, TraceDelete}) {
        show(id, pro_mode && inspector_tab == 2 && !editor_help);
    }
    const int list_height = std::max(80, int(client.bottom) - 560);
    place(ConstraintList, 580, 376, 440, list_height - 12);
    for (const auto [id, x] :
         {std::pair{CellX, 580}, {CellY, 690}, {CellWidth, 800}, {CellHeight, 910}}) {
        place(id, x, 396 + list_height, 100, 28);
    }
    place(UpdateConstraint, 580, 436 + list_height, 160);
    place(ConstraintUp, 750, 436 + list_height, 130);
    place(ConstraintDown, 890, 436 + list_height, 130);
    place(FingerScope, 580, 376, 440);
    place(FingerHand, 580, 416, 136);
    place(FingerId, 726, 416, 146);
    place(FingerPoseId, 882, 416, 138);
    place(FingerTimingCaption, 580, 460, 208, 24);
    place(FingerStable, 794, 458, 104, 28);
    place(FingerGrace, 908, 458, 112, 28);
    place(FingerList, 580, 498, 440, std::max(32, int(client.bottom) - 630));
    place(AddFinger, 580, client.bottom - 116, 214);
    place(DeleteFinger, 804, client.bottom - 116, 216);
    place(RecordLandmarks, 580, 376, 260, std::max(64, int(client.bottom) - 526));
    place(RecordToggle, 850, 376, 170);
    place(ConvertRecording, 850, 414, 170);
    place(DiscardRecording, 850, 452, 170);
    place(RecordAll, 850, 490, 170);
    place(TrimBegin, 580, client.bottom - 132, 80, 28);
    place(TrimEnd, 670, client.bottom - 132, 80, 28);
    place(TrimRecording, 760, client.bottom - 134, 260);
    place(TraceMove, 580, client.bottom - 92, 214);
    place(TraceDelete, 804, client.bottom - 92, 216);
    place(Space, 20, editor_grid.bottom + 10, 180);
    place(GridViewMode, pro_mode ? 210 : 20, editor_grid.bottom + 10, 195);
    place(CooldownCaption, pro_mode ? 580 : 380, pro_mode ? client.bottom - 82 : 10, 170, 22);
    place(Cooldown, pro_mode ? 580 : 380, pro_mode ? client.bottom - 58 : 32, 170, 28);
    place(Clear, 580, client.bottom - 54, 214);
    show(Clear, !(pro_mode && inspector_tab == 0));
    place(EditorHelp, 804, client.bottom - 54, 216);
    SetDlgItemTextW(edit_window, EditorHelp, editor_help ? L"Hide help" : L"Drawing help");
    for (const auto [id, x, width] : {std::tuple{TestInput, 20, 110},
                                      {RestartTest, 140, 100},
                                      {Calibrate, 250, 120},
                                      {TrackHands, 380, 180}}) {
        place(id, x, client.bottom - 82, width);
    }
    InvalidateRect(edit_window, nullptr, FALSE);
}
LRESULT CALLBACK procedure(HWND window, UINT message, WPARAM wp, LPARAM lp) {
    if (!application) {
        return DefWindowProcW(window, message, wp, lp);
    }
    auto& app = *application;
    try {
        switch (message) {
        case WM_CREATE: {
            app.window = window;
            app.font = CreateFontW(-16, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                                   OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                   DEFAULT_PITCH, L"Segoe UI");
            app.mono_font = CreateFontW(-14, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
                                        DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
                                        CLEARTYPE_QUALITY, DEFAULT_PITCH, L"Consolas");
            app.heading_font = CreateFontW(-28, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
                                           DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
                                           CLEARTYPE_QUALITY, DEFAULT_PITCH, L"Georgia");
            app.update_theme();
            button(window, FileMenu, L"File", 64, 6, 62);
            button(window, EditMenu, L"Edit", 132, 6, 62);
            button(window, ViewMenu, L"View", 200, 6, 62);
            button(window, Theme, L"Theme: Dark", 1100, 6, 136);
            button(window, Start, L"Start camera", 72, 72, 122);
            button(window, Stop, L"Stop", 202, 72, 70);
            button(window, Calibrate, L"Recalibrate", 280, 72, 112);
            button(window, RestartTest, L"Restart", 400, 72, 88);
            button(window, StopTest, L"Stop test", 496, 72, 100);
            button(window, TrackHands, app.config.track_hands ? L"Hands: On" : L"Hands: Off", 950,
                   730, 140);
            button(window, Keys, L"Keyboard: Off", 1100, 730, 152);
            button(window, Logs, L"Logs: Off", 950, 774, 300);
            EnableWindow(GetDlgItem(window, Keys), TRUE);
            const auto list = control(window, L"LISTBOX", L"", MotionList, 950, 94, 300, 420,
                                      LBS_OWNERDRAWFIXED | LBS_HASSTRINGS | LBS_NOTIFY |
                                          WS_VSCROLL | LBS_NOINTEGRALHEIGHT);
            SendMessageW(list, LB_SETITEMHEIGHT, 0, 142);
            list_original = reinterpret_cast<WNDPROC>(
                SetWindowLongPtrW(list, GWLP_WNDPROC, reinterpret_cast<LONG_PTR>(list_procedure)));
            button(window, NewMotion, L"+ New movement", 950, 650, 300);
            button(window, RemoteControls, L"Remote hand controls", 950, 690, 300);
            app.update_theme();
            app.refresh_list();
            app.layout();
            SetTimer(window, 1, 16, nullptr);
            return 0;
        }
        case WM_SIZE:
            app.layout();
            return 0;
        case WM_COMMAND: {
            const int id = LOWORD(wp), notification = HIWORD(wp);
            if (id == MotionList && notification == LBN_SELCHANGE) {
                app.selected =
                    std::size_t(SendDlgItemMessageW(window, MotionList, LB_GETCURSEL, 0, 0));
                return 0;
            }
            if (id == MotionList && notification == LBN_DBLCLK) {
                app.open_editor();
                return 0;
            }
            if (notification != BN_CLICKED) {
                return 0;
            }
            switch (id) {
            case FileMenu:
            case EditMenu:
            case ViewMenu: {
                const auto menu = CreatePopupMenu();
                const auto add = [&](UINT command, const wchar_t* name) {
                    AppendMenuW(menu, MF_OWNERDRAW, command, name);
                };
                if (id == FileMenu) {
                    add(NewConfig, L"New configuration   Ctrl+N");
                    add(Load, L"Open configuration   Ctrl+O");
                    add(Save, L"Save configuration   Ctrl+S");
                } else if (id == EditMenu) {
                    add(Undo, L"Undo   Ctrl+Z");
                    add(Redo, L"Redo   Ctrl+Y");
                    add(CopyInput, L"Copy input   Ctrl+C");
                    add(PasteInput, L"Paste input   Ctrl+V");
                    add(DuplicateInput, L"Duplicate input");
                    add(DeleteInput, L"Delete input");
                } else {
                    add(ThemeDark, L"Dark theme");
                    add(ThemeLight, L"Light theme");
                    add(Logs, app.logs_visible ? L"Hide log terminal" : L"Show log terminal");
                    add(ViewGrid, app.show_grid ? L"Hide body grid" : L"Show body grid");
                    add(ViewHands,
                        app.show_hands ? L"Hide hand detections" : L"Show hand detections");
                    add(ViewDots, app.show_dots ? L"Hide body dots" : L"Show body dots");
                }
                RECT anchor{};
                GetWindowRect(GetDlgItem(window, id), &anchor);
                const auto chosen = TrackPopupMenu(menu, TPM_RETURNCMD | TPM_LEFTALIGN, anchor.left,
                                                   anchor.bottom, 0, window, nullptr);
                DestroyMenu(menu);
                if (chosen) {
                    SendMessageW(window, WM_COMMAND, chosen, 0);
                }
                break;
            }
            case ThemeDark:
            case ThemeLight:
                app.dark = id == ThemeDark;
                app.update_theme();
                break;
            case Start:
                app.start();
                break;
            case Stop:
                app.stop();
                break;
            case Calibrate:
                app.request_restart(true);
                break;
            case RestartTest:
                app.request_restart(false);
                break;
            case Load:
                app.file_dialog(false);
                break;
            case Save:
                app.file_dialog(true);
                break;
            case NewConfig:
                if (app.edit_window) {
                    DestroyWindow(app.edit_window);
                }
                app.change_document({});
                app.message("New empty configuration.");
                break;
            case Undo:
            case Redo:
                app.undo(id == Redo, false);
                break;
            case NewMotion:
                app.open_editor(true);
                break;
            case CopyInput:
                if (!app.config.motions.empty()) {
                    app.select_motion();
                    app.clipboard_input = app.config.motions[app.selected];
                }
                break;
            case PasteInput:
            case DuplicateInput: {
                if (id == DuplicateInput && !app.config.motions.empty()) {
                    app.clipboard_input = app.config.motions[app.selected];
                }
                if (!app.clipboard_input) {
                    break;
                }
                auto proposed = app.config;
                auto duplicate = *app.clipboard_input;
                duplicate.id =
                    "input_" + std::to_string(now_ms()) + "_" + std::to_string(++app.serial);
                duplicate.name += " copy";
                proposed.motions.push_back(std::move(duplicate));
                app.change_document(std::move(proposed));
                break;
            }
            case StopTest:
                app.set_test(false);
                break;
            case EditInput:
                app.open_editor();
                break;
            case TestInput:
                app.open_editor(false, true);
                break;
            case DeleteInput:
                if (!app.config.motions.empty()) {
                    auto proposed = app.config;
                    app.select_motion();
                    proposed.motions.erase(proposed.motions.begin() + app.selected);
                    if (app.edit_window) {
                        DestroyWindow(app.edit_window);
                    }
                    app.change_document(std::move(proposed));
                }
                break;
            case TrackHands: {
                const bool enabled = !app.config.track_hands;
#ifndef MIG_NATIVE_HANDS
                if (enabled) {
                    throw std::runtime_error(
                        "This build has no hand inference; use the hands-enabled binaries.");
                }
#endif
                auto proposed = app.config;
                proposed.track_hands = enabled;
                app.change_document(std::move(proposed));
                app.set_preview_hands(enabled);
                SetDlgItemTextW(window, TrackHands,
                                app.config.track_hands ? L"Hands: On" : L"Hands: Off");
                break;
            }
            case Keys:
                app.keyboard_enabled = !app.keyboard_enabled;
                if (!app.keyboard_enabled) {
                    app.release_keys();
                }
                SetDlgItemTextW(window, Keys,
                                app.keyboard_enabled ? L"Keyboard: On" : L"Keyboard: Off");
                app.message(app.keyboard_enabled ? "Keyboard enabled. Test mode sends no keys."
                                                 : "Keyboard output disabled.");
                break;
            case ViewGrid:
            case ViewHands:
            case ViewDots:
                if (id == ViewGrid) {
                    app.show_grid = !app.show_grid;
                } else if (id == ViewHands) {
                    app.show_hands = !app.show_hands;
                } else {
                    app.show_dots = !app.show_dots;
                }
                break;
            case Theme:
                app.dark = !app.dark;
                app.update_theme();
                break;
            case Logs:
                app.toggle_logs();
                break;
            case RemoteControls:
                app.open_controls();
                break;
            }
            return 0;
        }
        case WM_DRAWITEM:
            app.draw_control(*reinterpret_cast<DRAWITEMSTRUCT*>(lp));
            return TRUE;
        case WM_MEASUREITEM: {
            auto& item = *reinterpret_cast<MEASUREITEMSTRUCT*>(lp);
            item.itemHeight = item.CtlType == ODT_MENU ? 32 : 24;
            item.itemWidth = 250;
            return TRUE;
        }
        case WM_CTLCOLORSTATIC:
            return color_control(wp, false);
        case WM_CTLCOLOREDIT:
        case WM_CTLCOLORLISTBOX:
            return color_control(wp, true);
        case WM_TIMER:
            if (!app.running && app.camera) {
                std::string error;
                {
                    std::lock_guard lock(app.state_mutex);
                    error = app.status;
                }
                app.stop();
                app.message(error);
            }
            if (!app.dialog_open) {
                app.tick();
            }
            return 0;
        case WM_PAINT:
            paint_window(window, false);
            return 0;
        case WM_ERASEBKGND:
            return 1;
        case WM_GETMINMAXINFO:
            reinterpret_cast<MINMAXINFO*>(lp)->ptMinTrackSize = {1100, 700};
            return 0;
        case WM_CLOSE:
            app.stop();
            if (app.edit_window) {
                DestroyWindow(app.edit_window);
            }
            if (app.control_window) {
                DestroyWindow(app.control_window);
            }
            if (app.log_window) {
                DestroyWindow(app.log_window);
            }
            DestroyWindow(window);
            return 0;
        case WM_DESTROY:
            KillTimer(window, 1);
            PostQuitMessage(0);
            return 0;
        }
    } catch (const std::exception& error) {
        app.message(error.what());
        MessageBoxW(window, wide(error.what()).c_str(), L"MIG", MB_OK | MB_ICONERROR);
    }
    return DefWindowProcW(window, message, wp, lp);
}
LRESULT CALLBACK editor_procedure(HWND window, UINT message, WPARAM wp, LPARAM lp) {
    auto& app = *application;
    try {
        switch (message) {
        case WM_CREATE:
            app.edit_window = window;
            label(window, L"Name", 20, 10);
            edit(window, InputName, L"", 20, 32, 170);
            label(window, L"Action", 200, 10);
            edit(window, ActionId, L"", 200, 32, 170);
            label(window, L"Keys / Ctrl+K", 20, 640, 125, KeyCaption);
            edit(window, Key, L"None", 150, 640, 400);
            control(window, L"STATIC", L"Action mode", ActionModeCaption, 20, 596, 125, 22);
            combo(window, ActionModeId, 150, 592, 200);
            choices(window, ActionModeId, {L"Single press", L"Hold", L"Repeat"});
            control(window, L"STATIC", L"Repeat ms", RepeatCaption, 360, 596, 90, 22);
            edit(window, RepeatInterval, L"200", 452, 592, 98);
            button(window, EditKeys, L"Edit keys", 452, 638, 98);
            control(window, L"STATIC", L"", KeyTokens, 20, 674, 530, 28, SS_OWNERDRAW);
            button(window, BindingSummary, L"Fingers: 0 | Signs: 0 / Details", 580, 66, 440);
            button(window, ClearFingers, L"Clear fingers", 890, 66, 130);
            label(window, L"Time limit ms", 450, 10, 110, DurationCaption);
            edit(window, Duration, L"0", 450, 32, 100);
            label(window, L"Cooldown ms (0 = off)", 380, 10, 170, CooldownCaption);
            edit(window, Cooldown, L"0", 380, 32, 170);
            button(window, ProMode, L"Advanced: Off", 690, 30, 165);
            button(window, Mirror, L"Mirror: Off", 570, 30, 110);
            combo(window, Space, 690, 32, 165);
            choices(window, Space, {L"Body relative", L"Calibration anchor"});
            button(window, Commit, L"Apply movement", 870, 30, 150);
            combo(window, StepList, 20, 82, 235);
            button(window, AddStep, L"+ Step", 270, 80, 85);
            button(window, DeleteStep, L"- Step", 365, 80, 85);
            button(window, StepUp, L"Up", 460, 80, 60);
            button(window, StepDown, L"Down", 530, 80, 60);
            combo(window, StepModeId, 600, 82, 155);
            choices(window, StepModeId, {L"Visited", L"Simultaneous", L"Ordered / landmark"});
            edit(window, HoldTime, L"0", 765, 82, 80);
            button(window, Trigger, L"Set hold ms", 855, 80, 165);
            combo(window, Tool, 20, 120, 155);
            choices(window, Tool,
                    {L"Select", L"Pencil", L"Bucket", L"Eraser", L"Contour / tolerance",
                     L"Move trace point", L"Delete trace sample"});
            SendDlgItemMessageW(window, Tool, CB_SETCURSEL, 1, 0);
            button(window, DrawPencil, L"Pencil", 20, 80, 100);
            button(window, DrawBucket, L"Fill", 130, 80, 100);
            button(window, DrawContour, L"Tolerance", 240, 80, 100);
            button(window, DrawEraser, L"Eraser", 350, 80, 100);
            button(window, DrawSelect, L"Select", 460, 80, 100);
            button(window, PaintRequired, L"Required", 580, 118, 140);
            button(window, PaintForbidden, L"Forbidden", 730, 118, 140);
            button(window, PaintTrigger, L"Trigger", 880, 118, 140);
            button(window, PaintInteraction, L"Interaction", 916, 142, 104);
            button(window, InteractionTab, L"Interaction", 928, 310, 92);
            control(
                window, L"STATIC",
                L"Your Left / Right hand; hold 0..60000 ms (0 = immediate).\nDraw purple cells, "
                L"or Select one then Update interaction.",
                InteractionCaption, 580, 376, 440, 54);
            combo(window, InteractionHand, 580, 442, 136);
            choices(window, InteractionHand, {L"Left", L"Right"});
            combo(window, InteractionGesture, 726, 442, 294);
            for (std::size_t sign = 1; sign < gesture_names.size(); ++sign) {
                const auto name = wide(std::string(gesture_names[sign]));
                SendDlgItemMessageW(window, InteractionGesture, CB_ADDSTRING, 0,
                                    reinterpret_cast<LPARAM>(name.c_str()));
            }
            SendDlgItemMessageW(window, InteractionGesture, CB_SETCURSEL, int(Gesture::V) - 1, 0);
            edit(window, InteractionHold, L"0", 580, 490, 136);
            button(window, SetInteraction, L"Update interaction", 726, 488, 294);
            button(window, GridViewMode, L"View: Body", 365, 118, 195);
            button(window, ConstraintsTab, L"Constraints", 580, 160, 140);
            button(window, FingersTab, L"Fingers", 730, 160, 140);
            button(window, RecordingTab, L"Recording", 880, 160, 140);
            button(window, LayersTab, L"Layers", 580, 310, 104);
            button(window, Undo, L"Undo", 185, 118, 80);
            button(window, Redo, L"Redo", 275, 118, 80);
            combo(window, BrushOrder, 870, 100, 150);
            SendDlgItemMessageW(window, BrushOrder, CB_ADDSTRING, 0,
                                reinterpret_cast<LPARAM>(L"Order: Auto"));
            for (int number = 1; number <= 1024; ++number) {
                const auto text = L"Order: " + std::to_wstring(number);
                SendDlgItemMessageW(window, BrushOrder, CB_ADDSTRING, 0,
                                    reinterpret_cast<LPARAM>(text.c_str()));
            }
            SendDlgItemMessageW(window, BrushOrder, CB_SETCURSEL, 0, 0);
            combo(window, Members, 580, 120, 175);
            for (auto landmark : landmarks) {
                const auto text = wide(ui::landmark_label(landmark.index));
                SendDlgItemMessageW(window, Members, CB_ADDSTRING, 0,
                                    reinterpret_cast<LPARAM>(text.c_str()));
            }
            SendDlgItemMessageW(window, Members, CB_SETCURSEL, 0, 0);
            combo(window, ConstraintTypeId, 765, 120, 125);
            choices(window, ConstraintTypeId,
                    {L"Required", L"Forbidden", L"Trigger", L"Interaction"});
            combo(window, PriorityId, 900, 120, 120);
            choices(window, PriorityId, {L"High", L"Low"});
            control(window, L"LISTBOX", L"", ConstraintList, 580, 178, 440, 132,
                    LBS_NOTIFY | LBS_OWNERDRAWFIXED | LBS_HASSTRINGS | WS_VSCROLL);
            control(window, L"LISTBOX", L"", LayerList, 580, 338, 440, 230,
                    LBS_NOTIFY | LBS_OWNERDRAWFIXED | LBS_HASSTRINGS | WS_VSCROLL);
            SendDlgItemMessageW(window, LayerList, LB_SETITEMHEIGHT, 0, 64);
            button(window, ToggleLayer, L"Show / hide layer", 580, 580, 214);
            button(window, DeleteLayer, L"Delete layer", 804, 580, 216);
            control(window, L"STATIC", L"Layer body part", LayerCaption, 580, 540, 440, 22);
            combo(window, LayerBodyPart, 580, 560, 280);
            for (auto landmark : landmarks) {
                const auto text = wide(ui::landmark_label(landmark.index));
                SendDlgItemMessageW(window, LayerBodyPart, CB_ADDSTRING, 0,
                                    reinterpret_cast<LPARAM>(text.c_str()));
            }
            button(window, SaveLayer, L"Save layer", 870, 560, 150);
            button(window, EditorHelp, L"Drawing help", 804, 710, 216);
            button(window, TrackHands, app.config.track_hands ? L"Hands: On" : L"Hands: Off", 380,
                   710, 180);
            button(window, TraceMove, L"Move trace point", 580, 670, 214);
            button(window, TraceDelete, L"Delete trace sample", 804, 670, 216);
            edit(window, CellX, L"4", 580, 320, 80);
            edit(window, CellY, L"3", 670, 320, 80);
            edit(window, CellWidth, L"1", 760, 320, 80);
            edit(window, CellHeight, L"1", 850, 320, 80);
            button(window, UpdateConstraint, L"Update region", 580, 378, 130);
            button(window, DeleteConstraint, L"Delete", 720, 378, 90);
            button(window, ConstraintUp, L"Earlier", 820, 378, 95);
            button(window, ConstraintDown, L"Later", 925, 378, 95);
            combo(window, FingerScope, 580, 425, 145);
            choices(window, FingerScope,
                    {L"Whole input fingers", L"Step fingers", L"Constraint fingers"});
            combo(window, FingerHand, 735, 425, 85);
            choices(window, FingerHand, {L"Left", L"Right"});
            combo(window, FingerId, 830, 425, 90);
            choices(window, FingerId, {L"Thumb", L"Index", L"Middle", L"Ring", L"Pinky"});
            combo(window, FingerPoseId, 930, 425, 90);
            choices(window, FingerPoseId, {L"Extended", L"Closed"});
            control(window, L"LISTBOX", L"", FingerList, 580, 465, 270, 78,
                    LBS_NOTIFY | LBS_OWNERDRAWFIXED | LBS_HASSTRINGS | WS_VSCROLL);
            button(window, AddFinger, L"Set finger", 860, 465, 160);
            button(window, DeleteFinger, L"Remove finger", 860, 507, 160);
            control(window, L"STATIC", L"Stable ms / Grace ms", FingerTimingCaption, 580, 460, 208,
                    24);
            edit(window, FingerStable, L"100", 794, 458, 104);
            edit(window, FingerGrace, L"150", 908, 458, 112);
            control(window, L"LISTBOX", L"", RecordLandmarks, 580, 582, 260, 95,
                    LBS_MULTIPLESEL | LBS_OWNERDRAWFIXED | LBS_HASSTRINGS | WS_VSCROLL);
            for (auto landmark : landmarks) {
                const auto text = wide(ui::landmark_label(landmark.index));
                SendDlgItemMessageW(window, RecordLandmarks, LB_ADDSTRING, 0,
                                    reinterpret_cast<LPARAM>(text.c_str()));
            }
            for (int index : {6, 7}) {
                SendDlgItemMessageW(window, RecordLandmarks, LB_SETSEL, TRUE, index);
            }
            button(window, RecordToggle, L"Record Start / Stop", 850, 582, 170);
            button(window, ConvertRecording, L"Convert reviewed trace", 850, 624, 170);
            button(window, DiscardRecording, L"Discard recording", 850, 666, 170);
            button(window, RecordAll, L"Select full body", 850, 710, 170);
            edit(window, TrimBegin, L"0", 580, 690, 75);
            edit(window, TrimEnd, L"0", 665, 690, 75);
            button(window, TrimRecording, L"Trim [start,end)", 750, 688, 90);
            button(window, TestInput, L"Test", 20, 716, 110);
            button(window, RestartTest, L"Restart", 140, 716, 100);
            button(window, Calibrate, L"Recalibrate", 250, 716, 120);
            button(window, Clear, L"Clear scope", 380, 716, 180);
            app.layout_editor();
            return 0;
        case WM_SIZE:
            app.layout_editor();
            return 0;
        case WM_COMMAND:
            app.editor_command(LOWORD(wp), HIWORD(wp));
            return 0;
        case WM_DRAWITEM:
            app.draw_control(*reinterpret_cast<DRAWITEMSTRUCT*>(lp));
            return TRUE;
        case WM_MEASUREITEM:
            reinterpret_cast<MEASUREITEMSTRUCT*>(lp)->itemHeight =
                reinterpret_cast<MEASUREITEMSTRUCT*>(lp)->CtlID == LayerList       ? 64
                : reinterpret_cast<MEASUREITEMSTRUCT*>(lp)->CtlType == ODT_LISTBOX ? 36
                                                                                   : 24;
            return TRUE;
        case WM_CTLCOLORSTATIC: {
            RECT bounds{};
            GetWindowRect(reinterpret_cast<HWND>(lp), &bounds);
            MapWindowPoints(nullptr, window, reinterpret_cast<POINT*>(&bounds), 2);
            return color_control(wp, bounds.left >= 570);
        }
        case WM_CTLCOLOREDIT:
        case WM_CTLCOLORLISTBOX:
            return color_control(wp, true);
        case WM_SETCURSOR:
            if (LOWORD(lp) == HTCLIENT) {
                POINT pointer{};
                GetCursorPos(&pointer);
                ScreenToClient(window, &pointer);
                if (PtInRect(&app.editor_grid, pointer)) {
                    SetCursor(
                        LoadCursor(nullptr, selection(window, Tool) == 0 ? IDC_ARROW : IDC_CROSS));
                    return TRUE;
                }
            }
            break;
        case WM_LBUTTONDOWN:
            SetFocus(window);
            SetCapture(window);
            app.editor_click(GET_X_LPARAM(lp), GET_Y_LPARAM(lp), true);
            return 0;
        case WM_MOUSEMOVE:
            if (app.stroke && (wp & MK_LBUTTON)) {
                app.editor_click(GET_X_LPARAM(lp), GET_Y_LPARAM(lp), false);
            }
            return 0;
        case WM_LBUTTONUP:
        case WM_CAPTURECHANGED:
            if (app.stroke) {
                if (app.trace_stroke) {
                    std::lock_guard lock(app.state_mutex);
                    if (app.reviewed_recording.traces() != app.trace_before.traces()) {
                        app.draft_history.commit({app.draft, app.trace_before});
                    }
                    app.trace_stroke = false;
                } else if (app.draft != app.stroke_before) {
                    app.remember_edit(app.stroke_before);
                }
                app.stroke = false;
                app.region_selection.dragging = false;
                app.refresh_editor();
            }
            if (message == WM_LBUTTONUP) {
                ReleaseCapture();
            }
            return 0;
        case WM_KEYDOWN:
            if (wp == VK_DELETE) {
                app.editor_command(DeleteConstraint, BN_CLICKED);
                return 0;
            }
            break;
        case WM_PAINT:
            paint_window(window, true);
            return 0;
        case WM_ERASEBKGND:
            return 1;
        case WM_GETMINMAXINFO:
            reinterpret_cast<MINMAXINFO*>(lp)->ptMinTrackSize = {1080, 700};
            return 0;
        case WM_CLOSE:
            DestroyWindow(window);
            return 0;
        case WM_DESTROY:
            app.edit_window = nullptr;
            {
                std::lock_guard lock(app.state_mutex);
                app.testing = -1;
                app.recording_allowed = false;
                ++app.profile_revision;
                app.reload = true;
            }
            return 0;
        }
    } catch (const std::exception& error) {
        if (app.stroke) {
            if (app.trace_stroke) {
                std::lock_guard lock(app.state_mutex);
                app.reviewed_recording = app.trace_before;
                app.trace_stroke = false;
            } else {
                app.draft = app.stroke_before;
            }
            app.stroke = false;
            ReleaseCapture();
        }
        app.message(error.what());
        MessageBoxW(window, wide(error.what()).c_str(), L"Motion Input Grid", MB_OK | MB_ICONERROR);
    }
    return DefWindowProcW(window, message, wp, lp);
}
LRESULT CALLBACK controls_procedure(HWND window, UINT message, WPARAM wp, LPARAM lp) {
    auto& app = *application;
    try {
        switch (message) {
        case WM_CREATE:
            for (const auto [id, y, text] :
                 {std::tuple{RestartBinding, 25, L"Restart"},
                  std::tuple{RecalibrateBinding, 75, L"Restart calibration"},
                  std::tuple{RecordBinding, 125, L"Record Start / Stop"}}) {
                label(window, text, 20, y, 180);
                combo(window, id, 220, y, 215);
                choices(window, id,
                        {L"Disabled", L"Left Thumb", L"Right Thumb", L"Left V", L"Right V"});
                for (std::size_t sign = 3; sign < gesture_names.size(); ++sign) {
                    for (auto side : {"Left ", "Right "}) {
                        const auto name =
                            wide(std::string(side) + std::string(gesture_names[sign]));
                        SendDlgItemMessageW(window, id, CB_ADDSTRING, 0,
                                            reinterpret_cast<LPARAM>(name.c_str()));
                    }
                }
            }
            button(window, ApplyControls, L"Apply bindings", 220, 175, 215);
            label(window, L"Left / Right refer to your own hands. Hold the sign.", 20, 217, 430);
            app.update_theme();
            return 0;
        case WM_COMMAND:
            if (HIWORD(wp) == CBN_SELCHANGE &&
                (LOWORD(wp) == RestartBinding || LOWORD(wp) == RecalibrateBinding ||
                 LOWORD(wp) == RecordBinding)) {
                const int chosen = selection(window, LOWORD(wp));
                if (chosen != 0) {
                    for (int other : {RestartBinding, RecalibrateBinding, RecordBinding}) {
                        if (other != LOWORD(wp) && selection(window, other) == chosen) {
                            SendDlgItemMessageW(window, other, CB_SETCURSEL, 0, 0);
                        }
                    }
                }
            } else if (LOWORD(wp) == ApplyControls) {
                app.apply_controls();
            }
            return 0;
        case WM_DRAWITEM:
            app.draw_control(*reinterpret_cast<DRAWITEMSTRUCT*>(lp));
            return TRUE;
        case WM_MEASUREITEM:
            reinterpret_cast<MEASUREITEMSTRUCT*>(lp)->itemHeight = 24;
            return TRUE;
        case WM_CTLCOLORSTATIC:
            return color_control(wp, false);
        case WM_CTLCOLOREDIT:
        case WM_CTLCOLORLISTBOX:
            return color_control(wp, true);
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
            app.control_window = nullptr;
            return 0;
        }
    } catch (const std::exception& error) {
        app.message(error.what());
        MessageBoxW(window, wide(error.what()).c_str(), L"MIG Controls", MB_OK | MB_ICONERROR);
    }
    return DefWindowProcW(window, message, wp, lp);
}
} // namespace mig::app
