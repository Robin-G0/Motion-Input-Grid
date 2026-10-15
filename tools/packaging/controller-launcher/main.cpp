#include "runtime_cache.hpp"
#include <stdexcept>
#include <string>

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR arguments, int show) {
    try {
        // Keep the validated files locked against writes/deletes until the child
        // exits. The persistent hash-addressed runtime remains for next launch.
        const auto runtime = prepare_runtime(instance);
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
    } catch (const std::exception& error) {
        MessageBoxA(nullptr, error.what(), "MIG Controller", MB_OK | MB_ICONERROR);
        return 1;
    }
}
