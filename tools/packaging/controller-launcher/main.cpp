#include "payload.hpp"
#include <filesystem>
#include <objbase.h>
#include <stdexcept>
#include <string>
#include <windows.h>

// The launcher has a static CRT. All application dependencies are embedded as
// resources and extracted into a fresh private temporary directory per run.
// No files beside the downloaded executable and no elevated rights are needed.
int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR arguments, int show) {
    std::filesystem::path directory;
    DWORD exit_code = 1;
    try {
        wchar_t temporary[32768]{};
        const DWORD length = GetTempPathW(32768, temporary);
        if (!length || length >= 32768) {
            throw std::runtime_error("Cannot locate the temporary directory.");
        }
        GUID guid{};
        if (FAILED(CoCreateGuid(&guid))) {
            throw std::runtime_error("Cannot create a unique runtime directory.");
        }
        wchar_t identifier[40]{};
        StringFromGUID2(guid, identifier, 40);
        const auto candidate =
            std::filesystem::path(temporary) / (std::wstring(L"MIG-controller-") + identifier);
        if (!std::filesystem::create_directory(candidate)) {
            throw std::runtime_error("Cannot create the Controller runtime directory.");
        }
        directory = candidate;
        for (const auto& file : payload_files) {
            const auto resource = FindResourceW(instance, MAKEINTRESOURCEW(file.id), RT_RCDATA);
            const auto loaded = resource ? LoadResource(instance, resource) : nullptr;
            const auto size = resource ? SizeofResource(instance, resource) : 0;
            const auto data = loaded ? LockResource(loaded) : nullptr;
            if (!data || !size) {
                throw std::runtime_error(
                    "The downloaded Controller is incomplete. Download it again.");
            }
            const auto path = directory / file.name;
            std::filesystem::create_directories(path.parent_path());
            const auto output = CreateFileW(path.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_NEW,
                                            FILE_ATTRIBUTE_NORMAL, nullptr);
            if (output == INVALID_HANDLE_VALUE) {
                throw std::runtime_error("Cannot unpack the Controller runtime files.");
            }
            DWORD written = 0;
            const bool success =
                WriteFile(output, data, size, &written, nullptr) && written == size;
            CloseHandle(output);
            if (!success) {
                throw std::runtime_error(
                    "Not enough space to unpack the Controller runtime files.");
            }
        }
        const auto executable = directory / L"motion-input-grid-controller.exe";
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
        CloseHandle(process.hThread);
        WaitForSingleObject(process.hProcess, INFINITE);
        GetExitCodeProcess(process.hProcess, &exit_code);
        CloseHandle(process.hProcess);
    } catch (const std::exception& error) {
        MessageBoxA(nullptr, error.what(), "MIG Controller", MB_OK | MB_ICONERROR);
    }
    if (!directory.empty()) {
        // Only the directory this invocation successfully created is removed.
        std::error_code ignored;
        std::filesystem::remove_all(directory, ignored);
    }
    return static_cast<int>(exit_code);
}
