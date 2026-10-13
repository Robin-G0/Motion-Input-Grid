#include "app.hpp"
#include "diagnostics.hpp"
#include <fstream>

namespace mig::app {
int run_ui_test(App& app, HWND window) {
    const auto check = [](bool condition, const char* message) {
        if (!condition) {
            throw std::runtime_error(message);
        }
    };
    const auto before = app.config;
    if (app.config_path.empty()) {
        check(app.config.motions.empty() && app.config.controls.recalibrate.gesture == Gesture::V,
              "Fresh startup must have no sample movement and expose V recalibration");
    }
    SendMessageW(window, WM_COMMAND, NewConfig, 0);
    check(app.config.motions.empty(), "New document failed");
    app.undo(false, false);
    check(app.config == before, "Document undo failed");
    app.undo(true, false);
    check(app.config.motions.empty(), "Document redo failed");
    const auto draw_preview = [&](HWND target, const std::filesystem::path& output) {
        RECT rect{};
        GetClientRect(target, &rect);
        BITMAPINFO info{};
        info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
        info.bmiHeader.biWidth = rect.right;
        info.bmiHeader.biHeight = rect.bottom;
        info.bmiHeader.biPlanes = 1;
        info.bmiHeader.biBitCount = 32;
        info.bmiHeader.biCompression = BI_RGB;
        void* pixels{};
        const auto dc = GetDC(target), memory = CreateCompatibleDC(dc);
        const auto bitmap = CreateDIBSection(dc, &info, DIB_RGB_COLORS, &pixels, nullptr, 0);
        const auto previous = SelectObject(memory, bitmap);
        if (target == app.window) {
            app.paint(memory);
        } else if (target == app.edit_window) {
            app.paint_editor(memory);
        } else {
            FillRect(memory, &rect, app.background_brush);
            SendMessageW(target, WM_PRINTCLIENT, reinterpret_cast<WPARAM>(memory), PRF_CLIENT);
        }
        struct PreviewContext {
            HDC dc;
            HWND parent;
        } context{memory, target};
        EnumChildWindows(
            target,
            [](HWND child, LPARAM parameter) -> BOOL {
                const auto& context = *reinterpret_cast<PreviewContext*>(parameter);
                for (HWND ancestor = child; ancestor && ancestor != context.parent;
                     ancestor = GetParent(ancestor)) {
                    if (!(GetWindowLongW(ancestor, GWL_STYLE) & WS_VISIBLE)) {
                        return TRUE;
                    }
                }
                RECT rect{};
                GetWindowRect(child, &rect);
                MapWindowPoints(nullptr, context.parent, reinterpret_cast<POINT*>(&rect), 2);
                const int saved = SaveDC(context.dc);
                SetViewportOrgEx(context.dc, rect.left, rect.top, nullptr);
                SendMessageW(child, WM_PRINT, reinterpret_cast<WPARAM>(context.dc),
                             PRF_CLIENT | PRF_CHILDREN | PRF_ERASEBKGND);
                RestoreDC(context.dc, saved);
                return TRUE;
            },
            reinterpret_cast<LPARAM>(&context));
        BITMAPFILEHEADER header{};
        header.bfType = 0x4d42;
        header.bfOffBits = sizeof(header) + sizeof(info.bmiHeader);
        header.bfSize = header.bfOffBits + rect.right * rect.bottom * 4;
        std::ofstream stream(output, std::ios::binary);
        stream.write(reinterpret_cast<const char*>(&header), sizeof(header));
        stream.write(reinterpret_cast<const char*>(&info.bmiHeader), sizeof(info.bmiHeader));
        stream.write(static_cast<const char*>(pixels), rect.right * rect.bottom * 4);
        SelectObject(memory, previous);
        DeleteObject(bitmap);
        DeleteDC(memory);
        ReleaseDC(target, dc);
    };

    app.open_editor(true);
    app.editor_command(MovementTab, BN_CLICKED);
    check(IsWindowEnabled(GetDlgItem(window, Keys)),
          "Keyboard switch must be enabled in both configurator and controller");
    check(GetWindowLongW(GetDlgItem(app.edit_window, Key), GWL_STYLE) & WS_VISIBLE,
          "Shortcut binding must be visible in Unified mode");
    SetDlgItemTextW(app.edit_window, Key, L"Ctrl+Shift+K");
    check(app.draft.keyboard == ui::parse_binding("Ctrl+Shift+K"),
          "Unified shortcut edit must update the input");
    RECT dropdown{};
    SendDlgItemMessageW(app.edit_window, Members, CB_GETDROPPEDCONTROLRECT, 0,
                        reinterpret_cast<LPARAM>(&dropdown));
    check(dropdown.bottom - dropdown.top >= 200,
          "Body part popup must retain enough height to select landmarks after layout");
    check(app.draft.constraints.empty() && app.draft.steps[0].constraints.empty() &&
              app.layer_members.empty() && !app.editor_help,
          "A new input must start with no forced cells or mandatory tutorial");
    app.editor_command(ConstraintsTab, BN_CLICKED);
    for (int id : {DrawSelect, DrawEraser, PaintRequired, PaintForbidden, PaintTrigger,
                   PaintInteraction, Undo, Redo}) {
        RECT button{};
        GetWindowRect(GetDlgItem(app.edit_window, id), &button);
        MapWindowPoints(nullptr, app.edit_window, reinterpret_cast<POINT*>(&button), 2);
        check(button.left >= 0, "Drawing controls must stay within the workspace");
    }
    check(app.draft.max_duration_ms == 0 && app.draft.steps[0].mode == StepMode::Ordered &&
              (GetWindowLongW(GetDlgItem(app.edit_window, AddStep), GWL_STYLE) & WS_VISIBLE) &&
              (GetWindowLongW(GetDlgItem(app.edit_window, PaintRequired), GWL_STYLE) & WS_VISIBLE),
          "Unified editor must expose steps and drawing tools without a mode switch");
    const auto set_choice = [&](int id, int value) {
        SendDlgItemMessageW(app.edit_window, id, CB_SETCURSEL, value, 0);
    };
    const auto draw_cell = [&](int landmark_choice, int x, int y) {
        set_choice(Members, landmark_choice);
        set_choice(Tool, 1);
        const auto point = app.grid_view.screen({x + .5f, y + .5f});
        const int px = int(point.x), py = int(point.y);
        SendMessageW(app.edit_window, WM_LBUTTONDOWN, MK_LBUTTON, MAKELPARAM(px, py));
        SendMessageW(app.edit_window, WM_LBUTTONUP, 0, MAKELPARAM(px, py));
    };
    set_choice(Members, 7);
    app.editor_command(Members, CBN_SELCHANGE);
    set_choice(BrushOrder, 1);
    const auto draw_row = [&](int y) {
        const auto start = app.grid_view.screen({1.5f, y + .5f});
        const auto end = app.grid_view.screen({3.5f, y + .5f});
        SendMessageW(app.edit_window, WM_LBUTTONDOWN, MK_LBUTTON,
                     MAKELPARAM(int(start.x), int(start.y)));
        SendMessageW(app.edit_window, WM_MOUSEMOVE, MK_LBUTTON, MAKELPARAM(int(end.x), int(end.y)));
        SendMessageW(app.edit_window, WM_LBUTTONUP, 0, MAKELPARAM(int(end.x), int(end.y)));
    };
    draw_row(5);
    check(ui::constraint_labels(app.draft) == std::vector<std::string>{"1", "1", "1"} &&
              app.layer_members == std::vector<int>{16},
          "Selected body part and brush number must paint a row of alternative cells");
    app.undo(false, true);
    check(app.draft.steps[0].constraints.empty(), "One Undo must remove the whole numbered stroke");
    app.undo(true, true);
    set_choice(BrushOrder, 2);
    draw_row(3);
    check(ui::constraint_labels(app.draft) ==
              std::vector<std::string>{"1", "1", "1", "2", "2", "2"},
          "The second row must share order 2, independently of row 1");
    validate(Configuration{{app.draft}});
    draw_preview(app.edit_window, app.directory / "editor-numbered-rows-ui.bmp");
    set_choice(BrushOrder, 1);
    draw_cell(7, 1, 3);
    check(app.selected_constraint == 3 && ui::constraint_labels(app.draft)[3] == "2",
          "Painting with the existing colour must select the square without modifying it");
    set_choice(BrushOrder, 1);
    app.editor_command(UpdateConstraint, BN_CLICKED);
    check(app.draft.steps[0].constraints.size() == 6 && ui::constraint_labels(app.draft)[3] == "1",
          "Editing the selected zone's order must not duplicate it");
    app.undo(false, true);
    set_choice(Tool, 0);
    const auto select_cell = app.grid_view.screen({1.5f, 5.5f});
    SendMessageW(app.edit_window, WM_LBUTTONDOWN, MK_LBUTTON,
                 MAKELPARAM(int(select_cell.x), int(select_cell.y)));
    SendMessageW(app.edit_window, WM_LBUTTONUP, 0,
                 MAKELPARAM(int(select_cell.x), int(select_cell.y)));
    set_choice(Members, 6);
    app.editor_command(Members, CBN_SELCHANGE);
    check(app.selected_constraint == -1 &&
              std::all_of(app.draft.steps[0].constraints.begin(),
                          app.draft.steps[0].constraints.end(),
                          [](const auto& cell) { return cell.landmark == 15; }),
          "Changing a movement's tracked point must reassign its zones immediately");
    validate(Configuration{{app.draft}});
    app.undo(false, true);
    app.editor_command(Clear, BN_CLICKED);
    set_choice(BrushOrder, 0);
    set_choice(Tool, 1);
    SetDlgItemTextW(app.edit_window, InputName, L"Jump");
    SetDlgItemTextW(app.edit_window, ActionId, L"jump");
    set_choice(StepModeId, 1);
    app.editor_command(StepModeId, CBN_SELCHANGE);
    draw_cell(0, 4, -1);
    draw_cell(2, 6, 1);
    draw_cell(3, 2, 1);
    check(app.draft.steps[0].constraints.size() == 3, "Generic editor landmarks failed");
    draw_cell(7, 4, -1);
    check(app.draft.steps[0].constraints.size() == 4, "Overlapping independent constraints failed");
    app.undo(false, true);
    check(app.draft.steps[0].constraints.size() == 3, "Editor stroke undo failed");
    app.undo(true, true);
    check(app.draft.steps[0].constraints.size() == 4, "Editor stroke redo failed");
    app.undo(false, true);
    app.editor_command(Mirror, BN_CLICKED);
    check(app.draft.mirror, "Mirror editor option failed");
    app.undo(false, true);
    check(!app.draft.mirror, "Mirror undo failed");
    set_choice(FingerScope, 0);
    app.editor_command(FingersTab, BN_CLICKED);
    check((GetWindowLongW(GetDlgItem(app.edit_window, FingerList), GWL_STYLE) & WS_VISIBLE) != 0 &&
              (GetWindowLongW(GetDlgItem(app.edit_window, ConstraintList), GWL_STYLE) &
               WS_VISIBLE) == 0,
          "Finger inspector must show its panel without overlapping constraints");
    set_choice(FingerHand, 1);
    set_choice(FingerId, 1);
    app.editor_command(AddFinger, BN_CLICKED);
    check(app.draft.fingers.size() == 1, "Finger editor failed");
    app.undo(false, true);
    check(app.draft.fingers.empty(), "Finger undo failed");
    app.apply();
    check(app.config.motions.size() == 1 && app.config.motions[0].name == "Jump",
          "Apply generic input failed");
    const auto path =
        app.directory / (editor ? "ui-test-configurator.json" : "ui-test-controller.json");
    save_configuration(app.config, path);
    check(load_configuration(path) == app.config, "UI document save/load failed");
    std::filesystem::remove(path);
    app.set_test(true);
    check(app.testing == 0 && app.pending_events.empty(), "Test isolation failed");
    const auto old_revision = app.profile_revision;
    app.request_restart(false);
    check(app.restart_requested && !app.recalibrate && app.profile_revision > old_revision,
          "Restart must not recalibrate");
    app.restart_requested = false;
    app.request_restart(true);
    check(app.recalibrate, "Recalibrate action failed");
    app.recalibrate = false;
    app.open_controls();
    SendDlgItemMessageW(app.control_window, RestartBinding, CB_SETCURSEL, 1, 0);
    SendDlgItemMessageW(app.control_window, RecalibrateBinding, CB_SETCURSEL, 4, 0);
    SendDlgItemMessageW(app.control_window, RecordBinding, CB_SETCURSEL, 4, 0);
    SendMessageW(app.control_window, WM_COMMAND, MAKEWPARAM(RecordBinding, CBN_SELCHANGE),
                 reinterpret_cast<LPARAM>(GetDlgItem(app.control_window, RecordBinding)));
    check(selection(app.control_window, RecalibrateBinding) == 0,
          "Assigning Right V to recording must remove the default Right V recalibration collision");
    SendDlgItemMessageW(app.control_window, RecalibrateBinding, CB_SETCURSEL, 2, 0);
    app.apply_controls();
    check(app.config.controls.restart.gesture == Gesture::Thumb &&
              app.config.controls.record_toggle.gesture == Gesture::V,
          "Remote control editor failed");
#ifdef MIG_NATIVE_HANDS
    check(app.config.track_hands && hand_tracking_requested(app.config),
          "Applying gesture bindings must enable hand inference in both applications");
#endif
    check(app.config.controls.recalibrate.gesture == Gesture::Thumb &&
              app.config.controls.recalibrate.hand == HandSide::Right,
          "Calibration restart must be assignable to a hand sign");
    app.request_record();
    check(app.record_requested && app.recording_landmarks.size() == 2,
          "Recording selection failed");
    app.editor_command(RecordingTab, BN_CLICKED);
    app.dark = false;
    app.update_theme();
    check(app.palette().background == RGB(247, 244, 237), "Light theme failed");
    app.dark = true;
    app.update_theme();
    app.toggle_logs();
    const auto terminal = app.log_window;
    check(app.logs_visible && IsWindow(terminal), "Linked log terminal failed");
    const auto terminal_style = GetWindowLongW(terminal, GWL_STYLE);
    check((terminal_style & WS_POPUP) && !(terminal_style & WS_CHILD) &&
              (terminal_style & WS_THICKFRAME) && GetWindow(terminal, GW_OWNER) == window &&
              !(GetWindowLongW(terminal, GWL_EXSTYLE) & WS_EX_TRANSPARENT),
          "Terminal must be an opaque, movable, resizable owned window, not an editor overlay");
    RECT terminal_frame{};
    GetWindowRect(terminal, &terminal_frame);
    SetWindowPos(terminal, nullptr, terminal_frame.left + 16, terminal_frame.top + 16, 600, 280,
                 SWP_NOZORDER | SWP_NOACTIVATE);
    GetWindowRect(terminal, &terminal_frame);
    const auto workspace_frame = app.editor_grid;
    app.layout();
    app.layout_editor();
    RECT after_layout{};
    GetWindowRect(terminal, &after_layout);
    check(EqualRect(&terminal_frame, &after_layout) &&
              EqualRect(&workspace_frame, &app.editor_grid),
          "Workspace refresh must not resize or reposition a floating terminal or its grid");
    POINT terminal_margin{2, 2};
    ClientToScreen(terminal, &terminal_margin);
    check(SendMessageW(terminal, WM_NCHITTEST, 0,
                       MAKELPARAM(terminal_margin.x, terminal_margin.y)) == HTCLIENT,
          "Terminal margins must consume pointer input instead of forwarding it to the editor");
    app.toggle_logs();
    GetWindowRect(terminal, &after_layout);
    check(EqualRect(&terminal_frame, &after_layout), "Reopening terminal must retain its geometry");
    check(!app.logs_visible && app.log_window == terminal,
          "Terminal should hide and remain reusable");
    app.toggle_logs();
    app.message("UI diagnostics: logs alive.");
    const auto event_font = SendDlgItemMessageW(terminal, 1, WM_GETFONT, 0, 0);
    app.editor_command(Mirror, BN_CLICKED);
    check(SendDlgItemMessageW(terminal, 1, WM_GETFONT, 0, 0) == event_font,
          "Recognition Mirror must not alter the event terminal font");
    app.undo(false, true);
    app.tick();
    check(GetWindowTextLengthW(GetDlgItem(terminal, 1)) > 0, "Terminal content failed");
    app.show_studio_view(1);
    check(app.logs_visible, "Changing workspace views must keep the terminal open");
    std::vector<std::string> terminal_entries;
    for (int line = 0; line < 60; ++line) {
        terminal_entries.push_back("Event " + std::to_string(line));
    }
    const auto terminal_edit = GetDlgItem(terminal, 1);
    app.refresh_logs(terminal_entries, app.log_version + 1000);
    SendMessageW(terminal_edit, EM_SETSEL, 0, 4);
    SendMessageW(terminal_edit, EM_LINESCROLL, 0, -1000);
    terminal_entries.push_back("New event while reading");
    app.refresh_logs(terminal_entries, app.log_version + 1001);
    DWORD terminal_selection_start{}, terminal_selection_end{};
    SendMessageW(terminal_edit, EM_GETSEL, reinterpret_cast<WPARAM>(&terminal_selection_start),
                 reinterpret_cast<LPARAM>(&terminal_selection_end));
    check(terminal_selection_start == 0 && terminal_selection_end == 4 &&
              SendMessageW(terminal_edit, EM_GETFIRSTVISIBLELINE, 0, 0) == 0,
          "Incoming logs must preserve selection and scroll position while reading older events");
    const auto terminal_length = GetWindowTextLengthW(terminal_edit);
    SendMessageW(terminal_edit, EM_SETSEL, terminal_length, terminal_length);
    SendMessageW(terminal_edit, EM_SCROLLCARET, 0, 0);
    SendMessageW(terminal_edit, EM_LINESCROLL, 0, 1000);
    terminal_entries.push_back("Follow newest event");
    app.refresh_logs(terminal_entries, app.log_version + 1002);
    SendMessageW(terminal_edit, EM_GETSEL, reinterpret_cast<WPARAM>(&terminal_selection_start),
                 reinterpret_cast<LPARAM>(&terminal_selection_end));
    check(terminal_selection_start == DWORD(GetWindowTextLengthW(terminal_edit)) &&
              terminal_selection_end == terminal_selection_start,
          "Terminal must follow new events when already at the bottom without a selection");
    {
        PaintBuffer erase_buffer;
        const auto compatible = GetDC(window);
        check(erase_buffer.resize(compatible, 32, 32), "Allocate erase diagnostic buffer");
        ReleaseDC(window, compatible);
        for (const auto child : {terminal_edit, GetDlgItem(app.edit_window, InputName)}) {
            PatBlt(erase_buffer.dc(), 0, 0, 32, 32, WHITENESS);
            check(SendMessageW(child, WM_ERASEBKGND, reinterpret_cast<WPARAM>(erase_buffer.dc()),
                               0) == 1 &&
                      GetPixel(erase_buffer.dc(), 2, 2) == app.palette().surface,
                  "Native edit controls must erase with the theme instead of flashing white");
        }
    }
    app.dialog_open = true;
    app.pending_events.push_back({0, now_ms()});
    app.finish_dialog();
    check(!app.dialog_open && app.pending_events.empty() && app.restart_requested,
          "Modal output barrier failed");
    draw_preview(window, app.directory / (editor ? "configurator-ui.bmp" : "controller-ui.bmp"));
    draw_preview(terminal, app.directory / "terminal-dark-ui.bmp");
    SendMessageW(window, WM_COMMAND, ThemeLight, 0);
    check(!app.dark, "Explicit light appearance command failed");
    draw_preview(terminal, app.directory / "terminal-light-ui.bmp");
    draw_preview(window, app.directory /
                             (editor ? "configurator-light-ui.bmp" : "controller-light-ui.bmp"));
    SendMessageW(window, WM_COMMAND, ThemeDark, 0);
    check(app.dark, "Explicit dark appearance command failed");
    draw_preview(app.edit_window, app.directory / "editor-ui.bmp");
    draw_preview(app.edit_window, app.directory / "editor-unified-ui.bmp");
    app.open_editor(true);
    set_choice(Members, 7);
    app.editor_command(PaintRequired, BN_CLICKED);
    draw_cell(7, 2, 5);
    draw_cell(7, 2, 4);
    app.editor_command(PaintTrigger, BN_CLICKED);
    draw_cell(7, 2, 3);
    draw_cell(7, 3, 3);
    check(app.draft.steps[0].constraints.size() == 3 &&
              app.draft.steps[0].constraints.back().cell == Cell{3, 3},
          "Unified yellow finish must move rather than create multiple Triggers");
    app.editor_command(PaintRequired, BN_CLICKED);
    draw_cell(7, 3, 4);
    check(app.draft.steps[0].constraints.back().type == ConstraintType::Trigger,
          "Extending a unified path must keep its Trigger last");
    const auto before_retired_tool = app.draft;
    app.editor_command(DrawContour, BN_CLICKED);
    check(app.draft == before_retired_tool && !GetDlgItem(app.edit_window, DrawContour) &&
              !GetDlgItem(app.edit_window, DrawPencil) &&
              !GetDlgItem(app.edit_window, DrawBucket) && !GetDlgItem(app.edit_window, StepUp) &&
              !GetDlgItem(app.edit_window, StepDown) &&
              !(GetWindowLongW(GetDlgItem(app.edit_window, PriorityId), GWL_STYLE) & WS_VISIBLE),
          "Authoring must expose six tools without tolerance, priority or step arrows");
    SetDlgItemTextW(app.edit_window, Cooldown, L"500");
    check(app.draft.cooldown_ms == 500, "Unified cooldown editing failed");
    app.editor_command(PaintForbidden, BN_CLICKED);
    draw_cell(7, 1, 3);
    app.editor_command(PaintRequired, BN_CLICKED);
    app.editor_command(GridViewMode, BN_CLICKED);
    draw_preview(app.edit_window, app.directory / "editor-unified-path-ui.bmp");
    app.dark = false;
    app.update_theme();
    draw_preview(app.edit_window, app.directory / "editor-unified-light-ui.bmp");
    app.dark = true;
    app.update_theme();
    app.editor_command(EditorHelp, BN_CLICKED);
    draw_cell(6, 6, 5);
    check(!app.editor_help && app.layer_members.size() == 2,
          "Drawing must replace optional help with per-body-part layers");
    const auto layered = app.draft;
    for (int id : {LayersTab, RecordingTab, Undo, Redo, InteractionTab}) {
        check(!(GetWindowLongW(GetDlgItem(app.edit_window, id), GWL_STYLE) & WS_VISIBLE),
              "Retired peer-level options must stay hidden");
    }
    const auto choose_body = [&](int landmark) {
        for (std::size_t i = 0; i < landmarks.size(); ++i) {
            if (landmarks[i].index == landmark) {
                set_choice(Members, int(i));
                app.editor_command(Members, CBN_SELCHANGE);
                return;
            }
        }
    };
    bool conflict_blocked = false;
    try {
        choose_body(16);
    } catch (const std::exception&) {
        conflict_blocked = true;
    }
    check(conflict_blocked && app.draft == layered,
          "Changing tracked point must preserve another existing point's zones");
    choose_body(33);
    auto reassigned = layered;
    ui::reassign_layer(reassigned, 15, 33);
    check(app.draft == reassigned && app.editing_layer == 33 && !app.layer_change_pending(),
          "Changing the tracked point must update all its zones without Save layer");
    app.undo(false, true);
    check(app.draft == layered, "Automatic body reassignment must undo in one operation");
    app.undo(true, true);
    check(app.draft == reassigned, "Automatic body reassignment must redo in one operation");
    app.undo(false, true);
    draw_preview(app.edit_window, app.directory / "editor-movement-zones-ui.bmp");
    app.editor_command(DrawEraser, BN_CLICKED);
    const auto erased_finish = app.grid_view.screen({3.5f, 3.5f});
    SendMessageW(app.edit_window, WM_LBUTTONDOWN, MK_LBUTTON,
                 MAKELPARAM(int(erased_finish.x), int(erased_finish.y)));
    SendMessageW(app.edit_window, WM_LBUTTONUP, 0,
                 MAKELPARAM(int(erased_finish.x), int(erased_finish.y)));
    check(
        std::none_of(app.draft.steps[0].constraints.begin(), app.draft.steps[0].constraints.end(),
                     [](const auto& item) { return item.type == ConstraintType::Trigger; }),
        "Unified eraser must erase the selected part's yellow cell without changing paint colour");
    app.undo(false, true);
    check(app.draft == layered, "Erasing a finish must undo with all independent layers intact");
    app.editor_command(Clear, BN_CLICKED);
    check(app.layer_members.empty() && app.draft.steps[0].constraints.empty(),
          "Unified clear must remove all drawing layers");
    app.undo(false, true);
    check(app.draft == layered, "Clear all layers must undo as one operation");
    const auto definition = app.draft;
    app.editor_command(MovementTab, BN_CLICKED);
    check(app.draft == definition && GetParent(app.edit_window) == window &&
              (GetWindowLongW(app.edit_window, GWL_STYLE) & WS_CHILD),
          "Movement settings must remain inside the main Studio window");
    app.editor_command(FingersTab, BN_CLICKED);
    check(app.draft == definition, "Context changes must preserve all movement rules");
    app.open_editor(true);
    set_choice(Members, 7);
    const auto drag_start = app.grid_view.screen({2.5f, 5.5f});
    const auto drag_end = app.grid_view.screen({2.5f, 2.5f});
    SendMessageW(app.edit_window, WM_LBUTTONDOWN, MK_LBUTTON,
                 MAKELPARAM(int(drag_start.x), int(drag_start.y)));
    SendMessageW(app.edit_window, WM_MOUSEMOVE, MK_LBUTTON,
                 MAKELPARAM(int(drag_end.x), int(drag_end.y)));
    SendMessageW(app.edit_window, WM_LBUTTONUP, 0, MAKELPARAM(int(drag_end.x), int(drag_end.y)));
    check(app.draft.steps[0].constraints.size() == 4, "Fast pencil drag must fill sampling gaps");
    app.undo(false, true);
    check(app.draft.steps[0].constraints.empty(), "A whole interpolated stroke is one Undo");
    app.open_editor(true);
    SetDlgItemTextW(app.edit_window, InputName, L"Crouch");
    SetDlgItemTextW(app.edit_window, ActionId, L"crouch");
    set_choice(StepModeId, 1);
    app.editor_command(StepModeId, CBN_SELCHANGE);
    draw_cell(0, 4, 3);
    draw_cell(2, 6, 5);
    draw_cell(3, 2, 5);
    app.apply();
    check(app.config.motions.size() == 2 && app.config.motions.back().name == "Crouch",
          "Crouch must be authored entirely through the generic editor");
    Grid recording_grid;
    recording_grid.valid = recording_grid.calibrated = true;
    recording_grid.scale = 0.05f;
    recording_grid.center = {0.5f, 0.4f};
    Frame recording_frame;
    recording_frame.aspect = 1;
    recording_frame.points[0] = {recording_grid.metric({4.5f, 3.5f}), 1};
    app.reviewed_recording.begin({33});
    app.reviewed_recording.sample(recording_frame, recording_grid);
    app.reviewed_recording.stop();
    const auto original_traces = app.reviewed_recording.traces();
    set_choice(Members, 0);
    set_choice(Tool, 5);
    const auto rect = app.editor_grid;
    const auto trace_start = app.grid_view.screen({4.5f, 3.5f});
    const auto trace_end = app.grid_view.screen({2.5f, 3.5f});
    const int start_x = int(trace_start.x), end_x = int(trace_end.x), trace_y = int(trace_start.y);
    SendMessageW(app.edit_window, WM_LBUTTONDOWN, MK_LBUTTON, MAKELPARAM(start_x, trace_y));
    SendMessageW(app.edit_window, WM_MOUSEMOVE, MK_LBUTTON, MAKELPARAM(end_x, trace_y));
    SendMessageW(app.edit_window, WM_LBUTTONUP, 0, MAKELPARAM(end_x, trace_y));
    check(app.reviewed_recording.traces() != original_traces, "Trace point drag failed");
    app.undo(false, true);
    check(app.reviewed_recording.traces() == original_traces, "Trace drag undo failed");
    app.undo(true, true);
    check(app.reviewed_recording.traces() != original_traces, "Trace drag redo failed");
    auto live = std::make_shared<Snapshot>();
    auto video = std::make_shared<VideoFrame>();
    video->width = 640;
    video->height = 480;
    video->bgrx.resize(640 * 480 * 4);
    for (std::size_t pixel = 0; pixel < video->bgrx.size(); pixel += 4) {
        video->bgrx[pixel] = 48;
        video->bgrx[pixel + 1] = 43;
        video->bgrx[pixel + 2] = 39;
    }
    live->video = video;
    live->pose.timestamp_ms = now_ms();
    live->pose.aspect = 4.f / 3.f;
    live->grid.valid = live->grid.calibrated = true;
    live->grid.scale = .04f;
    live->grid.center = {2.f / 3.f, .45f};
    live->reference_grid = live->grid;
    for (const auto [index, point] : {std::pair{0, Vec2{.5f, .28f}},
                                      {11, {.65f, .45f}},
                                      {12, {.35f, .45f}},
                                      {13, {.72f, .55f}},
                                      {14, {.28f, .55f}},
                                      {15, {.72f, .68f}},
                                      {16, {.28f, .68f}},
                                      {23, {.58f, .7f}},
                                      {24, {.42f, .7f}},
                                      {25, {.58f, .85f}},
                                      {26, {.42f, .85f}}}) {
        live->pose.points[index] = {point, 1};
    }
    app.body_view = true;
    app.update_grid_view(live);
    check(app.grid_view.live, "Editor must use live body projection after calibration");
    const auto before_scale =
        distance(app.grid_view.screen({4.5f, 3.5f}), app.grid_view.screen({5.5f, 3.5f}));
    live->grid.scale *= 2;
    live->reference_grid.scale *= 2;
    app.update_grid_view(live);
    const auto after_scale =
        distance(app.grid_view.screen({4.5f, 3.5f}), app.grid_view.screen({5.5f, 3.5f}));
    check(std::abs(after_scale - before_scale * 2) < .01f,
          "Editor grid must double with shoulder scale");
    const auto centre = app.grid_view.screen({4.5f, 3.5f});
    const auto clicked = app.grid_view.local(centre);
    check(distance(clicked, {4.5f, 3.5f}) < .001f,
          "Live editor hit-test must invert the body projection");
    app.snapshot = live;
    app.latest = video;
    const auto output_definition = app.config;
    const int output_test = app.testing;
    app.config.motions[0].keyboard = ui::parse_binding("Ctrl+Shift+K");
    std::vector<std::pair<int, bool>> emitted_keys;
    app.key_sender = [&](int key, bool release) {
        emitted_keys.emplace_back(key, release);
        return true;
    };
    app.running = true;
    app.testing = -1;
    app.dialog_open = false;
    app.keyboard_enabled = false;
    SendMessageW(window, WM_COMMAND, Keys, 0);
    app.pending_events.push_back({0, now_ms()});
    app.tick();
    check(emitted_keys == std::vector<std::pair<int, bool>>{{17, false}, {16, false}, {75, false}},
          "Recognized input must press its entire shortcut in both applications");
    app.testing = 0;
    app.pending_events.push_back({0, now_ms()});
    app.tick();
    check(app.keyboard_output.empty() && emitted_keys.size() == 6 &&
              emitted_keys.back() == std::pair<int, bool>{17, true},
          "Test mode must release existing keys and never send another chord");
    app.testing = -1;
    app.pending_events.push_back({0, now_ms()});
    live->pose.timestamp_ms = now_ms() - 300;
    app.tick();
    check(emitted_keys.size() == 6 && app.pending_events.empty(),
          "Stale detections cannot produce keyboard output");
    live->pose.timestamp_ms = now_ms();
    live->actions_active[0] = true;
    app.config.motions[0].action_mode = ActionMode::Hold;
    app.pending_events.push_back({0, now_ms()});
    app.tick();
    check(emitted_keys.size() == 9 && !app.keyboard_output.empty(),
          "Native app starts Hold on an accepted live input");
    live->actions_active[0] = false;
    app.tick();
    check(emitted_keys.size() == 12 && app.keyboard_output.empty() &&
              emitted_keys.back() == std::pair<int, bool>{17, true},
          "Native app releases Hold as soon as its live action ends");
    live->actions_active[0] = true;
    app.pending_events.push_back({0, now_ms()});
    app.tick();
    app.testing = 0;
    app.tick();
    check(app.keyboard_output.empty() && emitted_keys.size() == 18,
          "Entering Test cancels a Hold even if its pose stays active");
    live->actions_active[0] = false;
    app.running = false;
    app.config = output_definition;
    app.testing = output_test;
    SendMessageW(window, WM_COMMAND, Keys, 0);
    app.key_sender = {};
    live->pose.timestamp_ms = now_ms();
    const auto profile_without_overlay = app.config;
#ifdef MIG_NATIVE_HANDS
    live->hands_active = true;
    live->hands.count = 1;
    auto& illustrated_hand = live->hands.hands[0];
    illustrated_hand.points[0] = {.28f, .68f, 0};
    for (int finger = 0; finger < 5; ++finger) {
        const int base = 1 + finger * 4;
        for (int joint = 0; joint < 4; ++joint) {
            illustrated_hand.points[base + joint] = {.22f + finger * .03f, .65f - joint * .025f, 0};
        }
        live->pose.fingers[1][finger] = {finger == 1 || finger == 2 ? .9f : .1f, 1};
    }
#endif
    for (int command : {ViewGrid, ViewHands, ViewDots}) {
        SendMessageW(window, WM_COMMAND, command, 0);
    }
    check(app.show_grid && app.show_hands && app.show_dots && app.config == profile_without_overlay,
          "View overlays must toggle independently without changing detection configuration");
    app.show_studio_view(0);
    draw_preview(window, app.directory / "main-overlays-ui.bmp");
    const auto has_color = [&](const std::filesystem::path& path, COLORREF color) {
        std::ifstream stream(path, std::ios::binary);
        BITMAPFILEHEADER header{};
        stream.read(reinterpret_cast<char*>(&header), sizeof(header));
        stream.seekg(header.bfOffBits);
        std::array<unsigned char, 4> pixel{};
        while (stream.read(reinterpret_cast<char*>(pixel.data()), 4)) {
            if (pixel[0] == GetBValue(color) && pixel[1] == GetGValue(color) &&
                pixel[2] == GetRValue(color)) {
                return true;
            }
        }
        return false;
    };
    check(has_color(app.directory / "main-overlays-ui.bmp", RGB(105, 165, 190)) &&
              has_color(app.directory / "main-overlays-ui.bmp", RGB(48, 195, 135)),
          "Enabled grid and body dots must actually render on the main video");
#ifdef MIG_NATIVE_HANDS
    check(has_color(app.directory / "main-overlays-ui.bmp", RGB(255, 210, 60)),
          "Enabled hand skeleton must actually render on the main video");
#endif
    for (int command : {ViewGrid, ViewHands, ViewDots}) {
        SendMessageW(window, WM_COMMAND, command, 0);
    }
    check(!app.show_grid && !app.show_hands && !app.show_dots, "View overlays must hide again");
    draw_preview(window, app.directory / "main-no-overlays-ui.bmp");
    check(!has_color(app.directory / "main-no-overlays-ui.bmp", RGB(105, 165, 190)) &&
              !has_color(app.directory / "main-no-overlays-ui.bmp", RGB(48, 195, 135)) &&
              !has_color(app.directory / "main-no-overlays-ui.bmp", RGB(255, 210, 60)),
          "Hiding overlays must remove grid, body dots and hands from the main image");
    app.editor_command(ConstraintsTab, BN_CLICKED);
    draw_preview(app.edit_window, app.directory / "editor-body-ui.bmp");
    const auto selected_before = app.recording_landmarks;
    app.editor_command(RecordingTab, BN_CLICKED);
    app.editor_command(RecordAll, BN_CLICKED);
    check(app.recording_landmarks.size() == landmarks.size() &&
              app.recording_landmarks.size() > selected_before.size(),
          "Full-body recording selection failed");
    app.editor_command(GridViewMode, BN_CLICKED);
    check(!app.grid_view.live, "Full grid authoring mode must remain available");
    app.triggered_inputs[app.config.motions[0].id] = now_ms();
    app.dark = true;
    app.update_theme();
    app.refresh_list();
    draw_preview(window, app.directory / "main-triggered-ui.bmp");
    check(has_color(app.directory / "main-triggered-ui.bmp", RGB(25, 90, 65)),
          "Triggered input must visibly light its sidebar row");
    app.dark = false;
    app.update_theme();
    draw_preview(window, app.directory / "main-triggered-light-ui.bmp");
    check(has_color(app.directory / "main-triggered-light-ui.bmp", RGB(200, 245, 218)),
          "Triggered row must also highlight in light mode");
    app.dark = true;
    app.update_theme();
    app.triggered_inputs[app.config.motions[0].id] = now_ms() - 1000;
    draw_preview(window, app.directory / "main-trigger-expired-ui.bmp");
    check(!has_color(app.directory / "main-trigger-expired-ui.bmp", RGB(25, 90, 65)),
          "Sidebar flash must expire independently of persistent Test progress");
    app.open_editor(true);
    check(GetWindowLongW(GetDlgItem(app.edit_window, PaintInteraction), GWL_STYLE) & WS_VISIBLE,
          "Hand sign drawing must be available without a mode switch");
    app.editor_command(PaintInteraction, BN_CLICKED);
    check(app.inspector_tab == 0 &&
              !(GetWindowLongW(GetDlgItem(app.edit_window, InteractionGesture), GWL_STYLE) &
                WS_VISIBLE),
          "Hand sign options must stay hidden until a conditional zone exists");
    SendDlgItemMessageW(app.edit_window, Members, CB_SETCURSEL, 6, 0);
    SendDlgItemMessageW(app.edit_window, InteractionGesture, CB_SETCURSEL, int(Gesture::OK) - 1, 0);
    SetDlgItemInt(app.edit_window, InteractionHold, 400, FALSE);
    app.body_view = false;
    app.update_grid_view(nullptr);
    const auto purple_cell = app.grid_view.screen({4.5f, 5.5f});
    SendMessageW(app.edit_window, WM_LBUTTONDOWN, MK_LBUTTON,
                 MAKELPARAM(int(purple_cell.x), int(purple_cell.y)));
    SendMessageW(app.edit_window, WM_LBUTTONUP, 0,
                 MAKELPARAM(int(purple_cell.x), int(purple_cell.y)));
    check(app.draft.steps[0].constraints.size() == 1 &&
              app.draft.steps[0].constraints[0].interaction ==
                  Interaction{HandSide::Left, Gesture::OK, 400} &&
              ui::needs_fingers(app.draft),
          "Purple cell must carry hand, sign, hold time and request hand inference");
    validate(Configuration{{app.draft}});
    app.editor_command(MovementTab, BN_CLICKED);
    SendDlgItemMessageW(app.edit_window, ActionModeId, CB_SETCURSEL, int(ActionMode::Repeat), 0);
    app.editor_command(ActionModeId, CBN_SELCHANGE);
    SetDlgItemInt(app.edit_window, RepeatInterval, 375, FALSE);
    check(app.draft.action_mode == ActionMode::Repeat && app.draft.repeat_interval_ms == 375 &&
              (GetWindowLongW(GetDlgItem(app.edit_window, RepeatInterval), GWL_STYLE) & WS_VISIBLE),
          "Editor exposes the repeat interval and stores action mode in the draft");
    app.editor_command(InteractionTab, BN_CLICKED);
    check(app.draft.action_mode == ActionMode::Repeat &&
              !(GetWindowLongW(GetDlgItem(app.edit_window, ActionModeId), GWL_STYLE) & WS_VISIBLE),
          "Movement settings must remain stored without crowding the sign inspector");
    draw_preview(app.edit_window, app.directory / "editor-interaction-ui.bmp");
    check(has_color(app.directory / "editor-interaction-ui.bmp", RGB(184, 112, 245)),
          "Interaction cells and drawing button must render purple");
    SendDlgItemMessageW(app.edit_window, Tool, CB_SETCURSEL, 0, 0);
    SendMessageW(app.edit_window, WM_LBUTTONDOWN, MK_LBUTTON,
                 MAKELPARAM(int(purple_cell.x), int(purple_cell.y)));
    SendMessageW(app.edit_window, WM_LBUTTONUP, 0,
                 MAKELPARAM(int(purple_cell.x), int(purple_cell.y)));
    SetDlgItemInt(app.edit_window, InteractionHold, 750, FALSE);
    app.editor_command(SetInteraction, BN_CLICKED);
    check(app.draft.steps[0].constraints[0].interaction->hold_ms == 750,
          "Selected Interaction must be editable");
    app.undo(false, true);
    check(app.draft.steps[0].constraints[0].interaction->hold_ms == 400,
          "Interaction edits must undo");
    check(app.draft.steps[0].constraints[0].type == ConstraintType::Interaction,
          "Unified mode preserves Pro Interaction rules");
    app.editor_command(FingersTab, BN_CLICKED);
    SetDlgItemInt(app.edit_window, FingerStable, 250, FALSE);
    SetDlgItemInt(app.edit_window, FingerGrace, 75, FALSE);
    app.editor_command(AddFinger, BN_CLICKED);
    check(app.draft.fingers[0].stable_ms == 250 && app.draft.fingers[0].grace_ms == 75,
          "Pro finger editor must author its stable/grace timings");
    const auto authored = app.draft;
    const auto frame = app.editor_grid;
    app.show_studio_view(2);
    check(EqualRect(&frame, &app.editor_grid) && app.testing >= 0 && app.draft == authored,
          "Test must preserve the grid frame and all authored rules");
    const auto test_point = app.grid_view.screen({6.5f, 5.5f});
    SendMessageW(app.edit_window, WM_LBUTTONDOWN, MK_LBUTTON,
                 MAKELPARAM(int(test_point.x), int(test_point.y)));
    check(app.draft == authored, "Test view must not paint accidental regions");
    SendMessageW(app.edit_window, WM_KEYDOWN, VK_DELETE, 0);
    app.undo(false, true);
    check(app.draft == authored, "Test view must prevent deletion and history edits");
    app.show_studio_view(1);
    check(EqualRect(&frame, &app.editor_grid) && app.testing == -1 && app.draft == authored,
          "Returning to editing must preserve geometry and leave Test mode");
    app.open_binding_details();
    check(GetParent(app.details_window) == window &&
              text_value(app.details_window, 1).find("400") != std::string::npos &&
              text_value(app.details_window, 1).find("250") != std::string::npos,
          "Binding details must expose Interaction hold and scoped finger timing");
    DestroyWindow(app.details_window);
    const auto old_keyboard = app.draft.keyboard;
    app.open_keys();
    SetDlgItemTextW(app.key_window, KeyExpression, L"\"Hello world\" _ Enter _ Ctrl + C _ C _ C");
    app.update_key_preview(); // Multiline WM_SETTEXT does not emit EN_CHANGE.
    check(app.key_error.empty() && app.key_preview.size() == 5 &&
              IsWindowEnabled(GetDlgItem(app.key_window, KeyApply)),
          "Key editor must recognize text, shortcuts and repeated actions");
    draw_preview(app.key_window, app.directory / "key-sequence-ui.bmp");
    SetDlgItemTextW(app.key_window, KeyExpression, L"Ctrl + Ctrl");
    app.update_key_preview();
    check(!app.key_error.empty() && app.key_preview_rows.empty() &&
              !IsWindowEnabled(GetDlgItem(app.key_window, KeyApply)),
          "Invalid expressions must clear recognized key boxes and block Apply");
    SetDlgItemTextW(app.key_window, KeyExpression, L"\"Hello world\" _ Enter _ Ctrl + C _ C _ C");
    app.update_key_preview();
    SendMessageW(app.key_window, WM_COMMAND, KeyApply, 0);
    check(!app.key_window && app.draft.keyboard.size() == 5 &&
              app.draft.keyboard[0].text == "Hello world",
          "Applying sequence must update the input and close its editor");
    app.undo(false, true);
    check(app.draft.keyboard == old_keyboard, "Keyboard sequence edits must undo");
    app.editor_command(PaintInteraction, BN_CLICKED);
    const auto alternate_cell = app.grid_view.screen({6.5f, 5.5f});
    SendMessageW(app.edit_window, WM_LBUTTONDOWN, MK_LBUTTON,
                 MAKELPARAM(int(alternate_cell.x), int(alternate_cell.y)));
    SendMessageW(app.edit_window, WM_LBUTTONUP, 0,
                 MAKELPARAM(int(alternate_cell.x), int(alternate_cell.y)));
    check(app.draft.steps[0].constraints.size() == 1 &&
              app.draft.steps[0].constraints[0].order == 1 &&
              app.draft.steps[0].constraints[0].cell == Cell{6, 5},
          "Direct hand sign drawing must move the terminal zone instead of duplicating it");
    validate(Configuration{{app.draft}});
    app.editor_command(DrawBucket, BN_CLICKED);
    check(selection(app.edit_window, Tool) == 1,
          "Retired Fill must leave direct cell drawing active");
    draw_preview(app.edit_window, app.directory / "editor-bindings-ui.bmp");
    app.editor_command(PaintInteraction, BN_CLICKED);
    SendDlgItemMessageW(app.edit_window, Members, CB_SETCURSEL, 7, 0);
    app.editor_command(Members, CBN_SELCHANGE);
    check(selection(app.edit_window, InteractionHand) == int(HandSide::Right),
          "Choosing the right wrist must default new Interaction signs to the right hand");
    SendDlgItemMessageW(app.edit_window, Members, CB_SETCURSEL, 6, 0);
    app.editor_command(Members, CBN_SELCHANGE);
    check(selection(app.edit_window, InteractionHand) == int(HandSide::Left),
          "Choosing the left wrist must default signs to the left hand");
    SetDlgItemInt(app.edit_window, InteractionHold, 12000, FALSE);
    const auto long_cell = app.grid_view.screen({7.5f, 5.5f});
    SendMessageW(app.edit_window, WM_LBUTTONDOWN, MK_LBUTTON,
                 MAKELPARAM(int(long_cell.x), int(long_cell.y)));
    SendMessageW(app.edit_window, WM_LBUTTONUP, 0, MAKELPARAM(int(long_cell.x), int(long_cell.y)));
    check(app.draft.steps[0].constraints.back().interaction->hold_ms == 12000,
          "Editor must accept hand-sign holds above ten seconds");
    validate(Configuration{{app.draft}});
    app.open_editor(true);
    app.body_view = false;
    app.update_grid_view({});
    app.editor_command(PaintRequired, BN_CLICKED);
    draw_cell(6, 2, 4);
    draw_cell(6, 2, 3);
    draw_cell(6, 5, 5);
    app.editor_command(DrawSelect, BN_CLICKED);
    const auto selection_start = app.grid_view.screen({1.8f, 4.8f});
    const auto selection_end = app.grid_view.screen({3.2f, 2.8f});
    SendMessageW(app.edit_window, WM_LBUTTONDOWN, MK_LBUTTON,
                 MAKELPARAM(int(selection_start.x), int(selection_start.y)));
    SendMessageW(app.edit_window, WM_MOUSEMOVE, MK_LBUTTON,
                 MAKELPARAM(int(selection_end.x), int(selection_end.y)));
    SendMessageW(app.edit_window, WM_LBUTTONUP, 0,
                 MAKELPARAM(int(selection_end.x), int(selection_end.y)));
    check(app.region_selection.ids.size() == 2 && !app.region_selection.dragging,
          "Mouse drag must select a rectangle without modifying the drawing");
    BYTE keyboard_state[256]{};
    check(GetKeyboardState(keyboard_state), "Read thread keyboard state for Ctrl selection");
    auto control_state = std::to_array(keyboard_state);
    control_state[VK_CONTROL] |= 0x80;
    check(SetKeyboardState(control_state.data()), "Set thread-local Ctrl state");
    const auto extra_point = app.grid_view.screen({5.5f, 5.5f});
    SendMessageW(app.edit_window, WM_LBUTTONDOWN, MK_LBUTTON | MK_CONTROL,
                 MAKELPARAM(int(extra_point.x), int(extra_point.y)));
    SendMessageW(app.edit_window, WM_LBUTTONUP, MK_CONTROL,
                 MAKELPARAM(int(extra_point.x), int(extra_point.y)));
    check(SetKeyboardState(keyboard_state), "Restore thread keyboard state");
    check(app.region_selection.ids.size() == 3, "Ctrl-click must retain the rectangle selection");
    SendMessageW(app.edit_window, WM_KEYDOWN, VK_DELETE, 0);
    check(app.draft.steps[0].constraints.empty(),
          "Delete must remove every selected region in one operation");
    app.undo(false, true);
    check(app.draft.steps[0].constraints.size() == 3 && app.region_selection.ids.empty(),
          "Undo must restore rectangular deletion without leaving stale selection");
    app.draft.fingers.push_back({});
    app.draft.steps[0].fingers.push_back({});
    app.refresh_editor();
    const auto with_fingers = app.draft;
    check(app.draft == with_fingers && selection(app.edit_window, FingerScope) == 0,
          "Mode switches must preserve finger rules and restore whole-input inspection");
    app.editor_command(ClearFingers, BN_CLICKED);
    check(!ui::needs_fingers(app.draft), "Clear fingers must remove rules from every scope");
    app.undo(false, true);
    check(app.draft == with_fingers, "Finger cleanup must be fully undoable");
    app.editor_command(PaintRequired, BN_CLICKED);
    check(selection(app.edit_window, Tool) == 1 && selection(app.edit_window, BrushOrder) == 0,
          "Choosing a zone tool must reset numbering to automatic");
    app.editor_command(Clear, BN_CLICKED);
    check(app.draft.steps[0].constraints.empty() && app.draft.steps[0].fingers.empty() &&
              !app.draft.fingers.empty(),
          "Clear scope must remove scoped fingers without deleting whole-input rules");
    app.editor_command(DeleteStep, BN_CLICKED);
    check(app.draft.steps.size() == 1 && app.scope == 1,
          "Deleting the last step must leave a usable drawing scope in Unified mode");
    app.editor_command(Clear, BN_CLICKED);
    check(!app.draft.fingers.empty(), "Clearing a step must preserve global finger rules");
    app.editor_command(ClearFingers, BN_CLICKED);
    check(!ui::needs_fingers(app.draft), "Clear drawing must not leave invisible finger rules");
    SpatialConstraint imported_main{"main", 15, {2, 3}};
    auto imported_margin = imported_main;
    imported_margin.id = "margin";
    imported_margin.priority = Priority::Low;
    imported_margin.tolerance_for = "main";
    app.draft.steps[0].constraints = {imported_main, imported_margin};
    app.selected_constraint = 1;
    app.refresh_editor();
    SetDlgItemInt(app.edit_window, CellX, 3, TRUE);
    app.update_constraint();
    check(app.draft.steps[0].constraints[1].priority == Priority::Low &&
              app.draft.steps[0].constraints[1].tolerance_for == "main" &&
              app.draft.steps[0].constraints[1].cell.x == 3,
          "Editing imported margin geometry must retain its priority and target");
    SpatialConstraint route_start{"start", 15, {0, 1}};
    route_start.order = 1;
    SpatialConstraint route_finish{"finish", 15, {0, 0}, ConstraintType::Trigger};
    route_finish.order = 2;
    app.draft.steps[0].constraints = {route_start, route_finish};
    app.selected_constraint = -1;
    app.refresh_editor();
    app.editor_command(PaintRequired, BN_CLICKED);
    draw_cell(6, 1, 2);
    draw_cell(6, 1, 2);
    const auto& extended_route = app.draft.steps[0].constraints;
    check(extended_route.size() == 3 && extended_route[1].order == 2 &&
              extended_route.back().type == ConstraintType::Trigger &&
              extended_route.back().order == 3,
          "Extending a numbered route must keep its finish last and repainting must not duplicate "
          "cells");
    app.apply();
    const auto published_id = app.draft.id;
    set_choice(Members, 7);
    app.editor_command(Members, CBN_SELCHANGE);
    const auto published = [&]() -> const Motion& {
        return *std::find_if(app.config.motions.begin(), app.config.motions.end(),
                             [&](const auto& motion) { return motion.id == published_id; });
    };
    check(std::all_of(published().steps[0].constraints.begin(),
                      published().steps[0].constraints.end(),
                      [](const auto& cell) { return cell.landmark == 16; }),
          "Tracked-point edits must immediately update the existing document movement");
    const auto before_replace = app.draft;
    app.confirm_overwrite = [] { return false; };
    app.editor_command(PaintForbidden, BN_CLICKED);
    draw_cell(7, 1, 2);
    check(app.draft == before_replace && published() == before_replace,
          "Declining a different-colour overwrite must preserve draft and document");
    app.confirm_overwrite = [] { return true; };
    draw_cell(7, 1, 2);
    check(std::any_of(published().steps[0].constraints.begin(),
                      published().steps[0].constraints.end(),
                      [](const auto& cell) {
                          return cell.type == ConstraintType::Forbidden && cell.cell == Cell{1, 2};
                      }),
          "Confirming an overwrite must replace the zone and update the document");
    app.undo(false, true);
    check(app.draft == before_replace && published() == before_replace,
          "Undo must restore the overwritten zone in both draft and document");
    app.editor_command(PaintInteraction, BN_CLICKED);
    draw_cell(7, 4, 5);
    check(app.selected_constraint >= 0 && app.inspector_tab == 4 &&
              (GetWindowLongW(GetDlgItem(app.edit_window, InteractionGesture), GWL_STYLE) &
               WS_VISIBLE),
          "A newly placed conditional trigger must expose its sign settings");
    set_choice(InteractionGesture, int(Gesture::OK) - 1);
    app.editor_command(InteractionGesture, CBN_SELCHANGE);
    SetDlgItemInt(app.edit_window, InteractionHold, 750, FALSE);
    app.editor_command(InteractionHold, EN_KILLFOCUS);
    const auto conditional = std::find_if(
        published().steps[0].constraints.begin(), published().steps[0].constraints.end(),
        [](const auto& cell) { return cell.interaction.has_value(); });
    check(conditional != published().steps[0].constraints.end() &&
              conditional->interaction->gesture == Gesture::OK &&
              conditional->interaction->hold_ms == 750,
          "Selected sign and hold edits must update the document without an Apply button");
    SendMessageW(window, WM_CLOSE, 0, 0);
    check(!IsWindow(terminal), "Linked terminal must close with application");
    application = nullptr;
    std::cout
        << "Native UI document/editor/history/mirror/fingers/test/controls/recording/themes/log "
           "lifecycle passed.\n";
    return 0;
}
} // namespace mig::app
