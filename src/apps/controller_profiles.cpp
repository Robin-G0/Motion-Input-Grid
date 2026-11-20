#include "app.hpp"

namespace mig::app {
void App::restore_profiles() {
    auto profile_directory = controller::user_directory();
#ifdef MIG_APP_TESTS
    // Interactive UI tests and screenshot capture must never touch the user's
    // real profile library. This override is absent from non-diagnostic builds.
    wchar_t isolated[32768]{};
    const auto length = GetEnvironmentVariableW(L"MIG_TEST_PROFILE_DIRECTORY", isolated, 32768);
    if (length && length < 32768 && std::filesystem::path(isolated).is_absolute()) {
        profile_directory = isolated;
    }
#endif
    profiles = std::make_unique<controller::Profiles>(profile_directory);
    try {
        profiles->restore();
        if (profiles->selected() >= 0) {
            auto proposed = profiles->load(std::size_t(profiles->selected()));
#ifndef MIG_NATIVE_HANDS
            if (hand_tracking_requested(proposed)) {
                throw std::runtime_error("This profile needs the hands-enabled controller.");
            }
#endif
            config = std::move(proposed);
        }
    } catch (const std::exception& error) {
        message(error.what());
    }
}
void App::refresh_profiles() {
    SendDlgItemMessageW(window, ProfileList, CB_RESETCONTENT, 0, 0);
    if (!profiles) {
        return;
    }
    for (const auto& profile : profiles->entries()) {
        const auto name = wide(profile.name);
        SendDlgItemMessageW(window, ProfileList, CB_ADDSTRING, 0,
                            reinterpret_cast<LPARAM>(name.c_str()));
    }
    const auto index = profiles->selected();
    SendDlgItemMessageW(window, ProfileList, CB_SETCURSEL, index, 0);
    if (index >= 0) {
        SetDlgItemTextW(window, ProfileName, wide(profiles->entries()[index].name).c_str());
    }
}
void App::refresh_list() {
    SendDlgItemMessageW(window, MotionList, LB_RESETCONTENT, 0, 0);
    for (const auto& input : config.motions) {
        const auto name = wide(input.name.empty() ? input.id : input.name);
        SendDlgItemMessageW(window, MotionList, LB_ADDSTRING, 0,
                            reinterpret_cast<LPARAM>(name.c_str()));
    }
    selected = 0;
    SendDlgItemMessageW(window, MotionList, LB_SETCURSEL, config.motions.empty() ? -1 : 0, 0);
    {
        std::lock_guard lock(state_mutex);
        verification = controller_verify && !config.motions.empty() ? 0 : -1;
    }
    InvalidateRect(window, nullptr, FALSE);
}
void App::activate_profile(std::size_t index) {
    auto proposed = profiles->load(index);
    Engine validate_engine(proposed);
#ifndef MIG_NATIVE_HANDS
    if (hand_tracking_requested(proposed)) {
        throw std::runtime_error("This profile needs the hands-enabled controller.");
    }
#endif
    profiles->select(index);
    release_keys();
    {
        std::lock_guard lock(state_mutex);
        config = std::move(proposed);
        ++profile_revision;
        reload = true;
        snapshot.reset();
        pending_events.clear();
        triggered_inputs.clear();
    }
    refresh_profiles();
    refresh_list();
    message("Profile selected. Camera and keyboard settings are kept.");
}
void App::controller_file(bool saving) {
    dialog_open = true;
    release_keys();
    struct CloseDialog {
        App& app;
        ~CloseDialog() {
            std::lock_guard lock(app.state_mutex);
            app.dialog_open = false;
            app.pending_events.clear();
        }
    } close{*this};
    wchar_t path[32768]{};
    OPENFILENAMEW dialog{sizeof(dialog)};
    dialog.hwndOwner = window;
    dialog.lpstrFilter = L"MIG profiles (*.json)\0*.json\0\0";
    dialog.lpstrFile = path;
    dialog.nMaxFile = 32768;
    dialog.lpstrDefExt = L"json";
    dialog.Flags =
        OFN_NOCHANGEDIR | OFN_PATHMUSTEXIST | (saving ? OFN_OVERWRITEPROMPT : OFN_FILEMUSTEXIST);
    if (!(saving ? GetSaveFileNameW(&dialog) : GetOpenFileNameW(&dialog))) {
        return;
    }
    if (saving) {
        if (profiles->selected() < 0) {
            throw std::runtime_error("Import a profile first.");
        }
        profiles->export_file(std::size_t(profiles->selected()), path);
        message("Profile exported.");
    } else {
        const std::filesystem::path source(path);
        const auto proposed = load_configuration(source);
        if (!review_import(proposed)) {
            return;
        }
#ifndef MIG_NATIVE_HANDS
        if (hand_tracking_requested(proposed)) {
            throw std::runtime_error("This profile needs the hands-enabled controller.");
        }
#endif
        const auto index = profiles->import(proposed, narrow(source.stem().wstring()));
        activate_profile(index);
    }
}
} // namespace mig::app
