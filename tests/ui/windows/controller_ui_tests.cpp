#include "app.hpp"
#include "diagnostics.hpp"
namespace mig::app {
int App::controller_ui_test() {
    const auto check = [](bool value, const char* message) {
        if (!value) {
            throw std::runtime_error(message);
        }
    };
    check(!GetDlgItem(window, NewMotion) && !GetDlgItem(window, EditMenu),
          "Controller must not expose authoring controls.");
    check(!(GetWindowLongW(GetDlgItem(window, ProfileName), GWL_STYLE) & WS_VISIBLE),
          "Profile management must be collapsed while running movements.");
    SendMessageW(window, WM_COMMAND, ProfileManagement, 0);
    check(profile_management &&
              (GetWindowLongW(GetDlgItem(window, ProfileName), GWL_STYLE) & WS_VISIBLE),
          "Profile management did not open.");
    SendMessageW(window, WM_COMMAND, ProfileManagement, 0);
    check(!profile_management &&
              !(GetWindowLongW(GetDlgItem(window, ProfileName), GWL_STYLE) & WS_VISIBLE),
          "Profile management did not close.");
    const auto temporary = std::filesystem::temp_directory_path() /
                           ("mig-controller-ui-" + std::to_string(GetCurrentProcessId()));
    std::filesystem::create_directories(temporary);
    profiles = std::make_unique<controller::Profiles>(temporary);
    Configuration sample;
    Motion input;
    input.id = input.name = input.action = "test";
    input.keyboard = ui::parse_binding("A");
    input.steps.push_back({"step1", StepMode::Visited});
    SpatialConstraint trigger;
    trigger.id = "trigger";
    trigger.type = ConstraintType::Trigger;
    trigger.cell = {4, 3, 1, 1};
    input.steps[0].constraints.push_back(trigger);
    sample.motions.push_back(input);
    for (const auto button : {IDCANCEL, IDOK}) {
        keyboard_enabled = true;
        std::jthread responder([button] {
            // Exercise the real modal window without user interaction or keys.
            for (int attempt = 0; attempt < 200; ++attempt) {
                if (const auto dialog = FindWindowW(L"MIGImportReview", nullptr)) {
                    PostMessageW(dialog, WM_COMMAND, button, 0);
                    return;
                }
                std::this_thread::sleep_for(std::chrono::milliseconds(5));
            }
        });
        check(review_import(sample) == (button == IDOK) && !keyboard_enabled,
              "Import review must require acceptance and reset keyboard consent.");
    }
    const auto first = profiles->import(sample, "First game");
    const auto second = profiles->import(sample, "Second game");
    activate_profile(first);
    check(profiles->selected() == int(first) && config == sample,
          "Profile switch did not load the selected configuration.");
    int presses = 0;
    key_sender = [&](int, bool release) {
        presses += !release;
        return true;
    };
    keyboard_enabled = true;
    running = true;
    const auto supply_trigger = [&] {
        auto result = std::make_shared<Snapshot>();
        result->grid.valid = true;
        result->pose.timestamp_ms = now_ms();
        result->actions_active[0] = true;
        snapshot = result;
        pending_events.push_back({0, result->pose.timestamp_ms});
    };
    supply_trigger();
    tick();
    check(presses > 0, "Normal controller must deliver a binding.");
    const auto before_verify = presses;
    controller_view(CameraView);
    check(controller_camera && preview_enabled, "Camera view did not enable preview.");
    controller_view(VerifyView);
    check(controller_verify && show_grid, "Verification did not show regions.");
    supply_trigger();
    tick();
    check(presses == before_verify && pending_events.empty(),
          "Verification must discard keyboard events.");
    controller_view(CompactView);
    check(controller_compact && !preview_enabled && keyboard_enabled,
          "Compact mode must hide preview and keep keyboard enabled.");
    controller_view(CompactView);
    check(!controller_compact && preview_enabled, "Open did not restore preview.");
    controller_view(VerifyView);
    controller_view(CameraView);
    check(!controller_camera && !controller_verify && !preview_enabled,
          "Bindings-only mode must skip camera display conversion.");
    supply_trigger();
    activate_profile(second);
    check(running && !snapshot && pending_events.empty(),
          "Live profile changes must clear obsolete results without stopping capture.");
    controller::Profiles restored(temporary);
    restored.restore();
    check(restored.selected() == int(second), "Last profile was not persisted.");
    running = false;
    std::filesystem::remove_all(temporary);
    dark = false;
    update_theme();
    SendMessageW(window, WM_CLOSE, 0, 0);
    std::cout << "Controller views, verification, compact restoration and themes passed.\n";
    return 0;
}
int run_ui_test(App& app, HWND) {
    return app.controller_ui_test();
}
} // namespace mig::app
