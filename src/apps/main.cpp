#include "app.hpp"
#ifdef MIG_APP_TESTS
#include "diagnostics.hpp"
#endif
#include <shellapi.h>

using namespace mig::app;
using namespace mig;

int run_application(int argc, wchar_t** argv) {
    try {
        const auto directory = executable_directory();
        bool ui_test = false, session_test = false, track_hands = false;
#ifdef MIG_APP_TESTS
        bool infer_test = false, camera_test = false;
#endif
        unsigned index = 0;
        PoseModel pose_model = PoseModel::Lite;
        auto profile = directory / L"configs/default.json";
        bool explicit_profile = false;
        for (int i = 1; i < argc; ++i) {
            const std::wstring arg = argv[i];
            if (arg == L"--hands") {
                track_hands = true;
            } else if (arg == L"--pose-full") {
                pose_model = PoseModel::Full;
            } else if (arg == L"--pose-lite") {
                pose_model = PoseModel::Lite;
#ifdef MIG_APP_TESTS
            } else if (arg == L"--infer-test") {
                infer_test = true;
            } else if (arg == L"--hands-test") {
                track_hands = true;
                infer_test = true;
            } else if (arg == L"--camera-test") {
                camera_test = true;
            } else if (arg == L"--ui-test") {
                ui_test = true;
            } else if (arg == L"--session-test") {
                session_test = true;
#endif
            } else if (arg == L"--config" && i + 1 < argc) {
                profile = argv[++i];
                explicit_profile = true;
            } else if (arg == L"--camera" && i + 1 < argc) {
                const std::wstring camera_number = argv[++i];
                if (camera_number.empty() ||
                    !std::all_of(camera_number.begin(), camera_number.end(), [](wchar_t character) {
                        return character >= L'0' && character <= L'9';
                    })) {
                    throw std::runtime_error("Camera index must be a non-negative integer");
                }
                index = static_cast<unsigned>(std::stoul(camera_number));
            } else {
                std::cout << "Usage: motion-input-grid-[studio|controller] [--config file.json] "
                             "[--camera "
                             "index] [--hands] [--pose-lite|--pose-full]"
#ifdef MIG_APP_TESTS
                             " [--infer-test|--hands-test|--camera-test|--ui-test|--session-test]"
#endif
                             "\n";
                return arg == L"--help" ? 0 : 1;
            }
        }
#ifdef MIG_APP_TESTS
        if (infer_test) {
            return run_inference_test(directory, track_hands, pose_model);
        }
#endif
        const HRESULT com = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
        if (FAILED(com)) {
            throw std::runtime_error("Cannot initialise COM");
        }
        struct ComCleanup {
            ~ComCleanup() {
                CoUninitialize();
            }
        } com_cleanup;
        if (FAILED(MFStartup(MF_VERSION))) {
            throw std::runtime_error("Cannot initialise Media Foundation");
        }
        struct MfCleanup {
            ~MfCleanup() {
                MFShutdown();
            }
        } mf_cleanup;
#ifdef MIG_APP_TESTS
        if (camera_test) {
            return run_camera_test(directory, index, track_hands, pose_model);
        }
#endif
        App app;
        app.diagnostic_mode = ui_test;
        app.directory = directory;
        if (explicit_profile) {
            app.config_path = profile;
            app.config = load_configuration(profile);
        } else {
            // Bundled sample profiles are examples, never an implicit user input.
            app.config.controls.recalibrate = {Gesture::V, HandSide::Right};
        }
        app.camera_index = index;
        if constexpr (editor) {
            if (track_hands) {
                app.config.track_hands = true;
            }
        }
        if constexpr (!editor) {
            if (!ui_test && !session_test) {
                app.restore_profiles();
                if (explicit_profile) {
                    auto proposed = load_configuration(profile);
#ifndef MIG_NATIVE_HANDS
                    if (hand_tracking_requested(proposed)) {
                        throw std::runtime_error(
                            "This profile needs the hands-enabled controller.");
                    }
#endif
                    // Review after window creation, before persisting an external profile.
                    app.config = std::move(proposed);
                }
            }
        }
        app.pose_model = pose_model;
        if constexpr (!editor) {
            if (track_hands && !session_test) {
                throw std::runtime_error(
                    "Controller hand tracking is configured by tracking.hands in "
                    "JSON; --hands is for preview/diagnostics");
            }
            if (session_test) {
                app.config.track_hands = track_hands;
            }
        }
#ifndef MIG_NATIVE_HANDS
        if (hand_tracking_requested(app.config)) {
            throw std::runtime_error("Hand tracking was disabled at build time");
        }
#endif
        application = &app;
        WNDCLASSW klass{};
        klass.lpfnWndProc = procedure;
        klass.hInstance = GetModuleHandleW(nullptr);
        klass.lpszClassName = L"MIGNativeWindow";
        klass.hCursor = LoadCursor(nullptr, IDC_ARROW);
        RegisterClassW(&klass);
        RECT work{};
        SystemParametersInfoW(SPI_GETWORKAREA, 0, &work, 0);
        auto window = CreateWindowW(
            klass.lpszClassName, title, WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN, work.left + 20,
            work.top + 20, std::min(editor ? 1320 : 620, int(work.right - work.left) - 40),
            std::min(editor ? 930 : 700, int(work.bottom - work.top) - 40), nullptr, nullptr,
            klass.hInstance, nullptr);
        if (!window) {
            throw std::runtime_error("Cannot create window");
        }
#ifdef MIG_APP_TESTS
        if (session_test) {
            return run_session_test(app, window);
        }
        if (ui_test) {
            return run_ui_test(app, window);
        }
#endif
        ShowWindow(window, SW_SHOW);
        if (explicit_profile) {
            if (app.review_import(app.config)) {
                if constexpr (!editor) {
                    const auto selected =
                        app.profiles->import(app.config, narrow(profile.stem().wstring()));
                    app.activate_profile(selected);
                }
            } else if constexpr (editor) {
                app.change_document(Configuration{});
            } else {
                app.config = Configuration{};
                app.restore_profiles();
                app.refresh_list();
            }
        }
        MSG msg{};
        while (GetMessageW(&msg, nullptr, 0, 0) > 0) {
#ifdef MIG_CONFIGURATOR
            if (msg.message == WM_KEYDOWN && (GetKeyState(VK_CONTROL) & 0x8000)) {
                const bool draft_scope = app.edit_window && (msg.hwnd == app.edit_window ||
                                                             IsChild(app.edit_window, msg.hwnd));
                if (msg.wParam == 'Z' || msg.wParam == 'Y') {
                    app.undo(msg.wParam == 'Y', draft_scope);
                    continue;
                }
                if (msg.wParam == 'S') {
                    app.file_dialog(true);
                    continue;
                }
                if (!draft_scope && (msg.wParam == 'C' || msg.wParam == 'V' || msg.wParam == 'X')) {
                    wchar_t type[64]{};
                    GetClassNameW(msg.hwnd, type, 64);
                    if (std::wstring_view(type) != L"Edit") {
                        SendMessageW(window, WM_COMMAND, msg.wParam == 'V' ? PasteInput : CopyInput,
                                     0);
                        if (msg.wParam == 'X') {
                            SendMessageW(window, WM_COMMAND, DeleteInput, 0);
                        }
                        continue;
                    }
                }
                if (msg.wParam == 'O') {
                    app.file_dialog(false);
                    continue;
                }
                if (msg.wParam == 'N') {
                    SendMessageW(window, WM_COMMAND, NewConfig, 0);
                    continue;
                }
            }
#endif
            if (app.edit_window && IsDialogMessageW(app.edit_window, &msg)) {
                continue;
            }
            if (IsDialogMessageW(window, &msg)) {
                continue;
            }
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
        application = nullptr;
        return 0;
    } catch (const std::exception& e) {
        std::cerr << e.what() << '\n';
        bool diagnostic = false;
        for (int index = 1; index < argc; ++index) {
            diagnostic = diagnostic || std::wstring_view(argv[index]).ends_with(L"-test");
        }
        if (!diagnostic) {
            const auto text = wide(e.what());
            MessageBoxW(nullptr, text.c_str(), L"Motion Input Grid - Startup error",
                        MB_OK | MB_ICONERROR);
        }
        return 1;
    }
}
int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR, int) {
    int argc{};
    auto argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    if (!argv) {
        return 1;
    }
    const int result = run_application(argc, argv);
    LocalFree(argv);
    return result;
}
