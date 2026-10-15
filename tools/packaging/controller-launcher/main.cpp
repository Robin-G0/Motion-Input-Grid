#include "runtime_cache.hpp"
#include <shellapi.h>
#include <stdexcept>
#include <string>

namespace {
struct Cancelled {};

LRESULT CALLBACK notice_procedure(HWND window, UINT message, WPARAM wp, LPARAM lp) {
    if (message == WM_COMMAND && LOWORD(wp) == 101) {
        const auto field = GetDlgItem(window, 100);
        const auto length = GetWindowTextLengthW(field);
        const auto memory = GlobalAlloc(GMEM_MOVEABLE, (length + 1) * sizeof(wchar_t));
        if (memory) {
            const auto bytes = GlobalLock(memory);
            if (!bytes) {
                GlobalFree(memory);
                return 0;
            }
            GetWindowTextW(field, static_cast<wchar_t*>(bytes), length + 1);
            GlobalUnlock(memory);
            if (OpenClipboard(window)) {
                EmptyClipboard();
                if (!SetClipboardData(CF_UNICODETEXT, memory)) {
                    GlobalFree(memory);
                }
                CloseClipboard();
            } else {
                GlobalFree(memory);
            }
        }
        return 0;
    }
    if (message == WM_COMMAND && LOWORD(wp) == IDOK) {
        *reinterpret_cast<bool*>(GetWindowLongPtrW(window, GWLP_USERDATA)) = true;
        DestroyWindow(window);
        return 0;
    }
    return DefWindowProcW(window, message, wp, lp);
}
void installation_notice(HINSTANCE instance, const std::filesystem::path& directory) {
    WNDCLASSW type{};
    type.hInstance = instance;
    type.lpfnWndProc = notice_procedure;
    type.lpszClassName = L"MIGRuntimeNotice";
    type.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    type.hbrBackground = reinterpret_cast<HBRUSH>(COLOR_WINDOW + 1);
    RegisterClassW(&type);
    const auto window =
        CreateWindowExW(WS_EX_DLGMODALFRAME, type.lpszClassName, L"MIG Controller: local runtime",
                        WS_CAPTION | WS_SYSMENU, CW_USEDEFAULT, CW_USEDEFAULT, 660, 310, nullptr,
                        nullptr, instance, nullptr);
    if (!window) {
        throw std::runtime_error("Cannot show runtime installation information.");
    }
    bool accepted = false;
    SetWindowLongPtrW(window, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(&accepted));
    const auto font = CreateFontW(-17, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                                  OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                  DEFAULT_PITCH, L"Segoe UI");
    const auto control = [&](const wchar_t* kind, const wchar_t* text, int id, int x, int y,
                             int width, int height, DWORD style) {
        const auto child =
            CreateWindowExW(0, kind, text, WS_CHILD | WS_VISIBLE | style, x, y, width, height,
                            window, reinterpret_cast<HMENU>(INT_PTR(id)), instance, nullptr);
        SendMessageW(child, WM_SETFONT, reinterpret_cast<WPARAM>(font), TRUE);
        return child;
    };
    control(L"STATIC",
            L"MIG will extract its recognition runtime on this device.\n"
            L"It is verified and reused on subsequent launches.",
            -1, 24, 22, 600, 48, 0);
    control(L"EDIT", directory.c_str(), 100, 24, 84, 600, 30,
            WS_TABSTOP | ES_READONLY | ES_AUTOHSCROLL | WS_BORDER);
    control(L"BUTTON", L"Copy path", 101, 24, 126, 126, 32, WS_TABSTOP);
    control(L"STATIC",
            L"You can remove this runtime directory after closing MIG.\n"
            L"MIG will recreate it when needed. Your profiles are stored separately.",
            -1, 24, 174, 600, 48, 0);
    const auto next =
        control(L"BUTTON", L"Continue", IDOK, 494, 230, 130, 32, WS_TABSTOP | BS_DEFPUSHBUTTON);
    // Cache validation decides whether to show this notice. A dismissal marker
    // can never bless an incomplete installation. Closing cancels extraction.
    ShowWindow(window, SW_SHOW);
    SetFocus(next);
    MSG message{};
    while (IsWindow(window) && GetMessageW(&message, nullptr, 0, 0) > 0) {
        if (!IsDialogMessageW(window, &message)) {
            TranslateMessage(&message);
            DispatchMessageW(&message);
        }
    }
    DeleteObject(font);
    if (!accepted) {
        throw Cancelled{};
    }
}
bool diagnostic_launch() {
    int count = 0;
    const auto args = CommandLineToArgvW(GetCommandLineW(), &count);
    bool diagnostic = false;
    if (args && count == 2) {
        for (const auto flag :
             {L"--help", L"--ui-test", L"--infer-test", L"--hands-test", L"--session-test"}) {
            diagnostic |= std::wstring_view(args[1]) == flag;
        }
    }
    if (args) {
        LocalFree(args);
    }
    return diagnostic;
}
} // namespace

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR arguments, int show) {
    try {
        // Keep the validated files locked against writes/deletes until the child
        // exits. The persistent hash-addressed runtime remains for next launch.
        const auto runtime = prepare_runtime(
            instance, diagnostic_launch()
                          ? std::function<void(const std::filesystem::path&)>{}
                          : [instance](const auto& path) { installation_notice(instance, path); });
        const auto executable = runtime.directory / L"motion-input-grid-controller.exe";
        std::wstring command = L"\"" + executable.wstring() + L"\" " + arguments;
        STARTUPINFOW startup{sizeof(STARTUPINFOW)};
        startup.dwFlags = STARTF_USESHOWWINDOW;
        startup.wShowWindow = static_cast<WORD>(show);
        PROCESS_INFORMATION process{};
        // Preserve the caller's working directory for relative --config paths.
        if (!CreateProcessW(executable.c_str(), command.data(), nullptr, nullptr, FALSE, 0, nullptr,
                            nullptr, &startup, &process)) {
            throw std::runtime_error(
                "The Controller could not start. Check that Windows allows it to run.");
        }
        FileHandle thread(process.hThread);
        FileHandle child(process.hProcess);
        if (WaitForSingleObject(child.get(), INFINITE) != WAIT_OBJECT_0) {
            throw std::runtime_error("Cannot wait for the Controller to exit.");
        }
        DWORD exit_code = 1;
        if (!GetExitCodeProcess(child.get(), &exit_code)) {
            throw std::runtime_error("Cannot read the Controller exit status.");
        }
        return static_cast<int>(exit_code);
    } catch (const Cancelled&) {
        return 0;
    } catch (const std::exception& error) {
        MessageBoxA(nullptr, error.what(), "MIG Controller", MB_OK | MB_ICONERROR);
        return 1;
    }
}
