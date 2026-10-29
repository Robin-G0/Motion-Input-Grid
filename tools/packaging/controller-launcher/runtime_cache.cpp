#include "runtime_cache.hpp"
#include "payload.hpp"
#include <array>
#include <bcrypt.h>
#include <objbase.h>
#include <optional>
#include <set>
#include <stdexcept>
#include <string>

namespace {
using Path = std::filesystem::path;
constexpr auto marker_name = L".complete";

void require(bool condition, const char* message) {
    if (!condition) {
        throw std::runtime_error(message);
    }
}

FileHandle open_plain(const Path& path, bool directory) {
    const auto handle = CreateFileW(
        path.c_str(), directory ? FILE_READ_ATTRIBUTES : GENERIC_READ,
        directory ? FILE_SHARE_READ | FILE_SHARE_WRITE : FILE_SHARE_READ, nullptr, OPEN_EXISTING,
        FILE_FLAG_OPEN_REPARSE_POINT |
            (directory ? FILE_FLAG_BACKUP_SEMANTICS : FILE_FLAG_SEQUENTIAL_SCAN),
        nullptr);
    FileHandle result(handle);
    require(handle != INVALID_HANDLE_VALUE, "Cannot lock a cached runtime file.");
    BY_HANDLE_FILE_INFORMATION info{};
    require(GetFileInformationByHandle(handle, &info) != FALSE,
            "Cannot inspect a cached runtime file.");
    require(!(info.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT),
            "Runtime reparse points are not allowed.");
    require(bool(info.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) == directory,
            "Invalid runtime entry type.");
    require(directory || info.nNumberOfLinks == 1, "Runtime hard links are not allowed.");
    return result;
}

std::string sha256(HANDLE file) {
    std::vector<UCHAR> object;
    struct Hash {
        BCRYPT_ALG_HANDLE algorithm{};
        BCRYPT_HASH_HANDLE hash{};
        ~Hash() {
            if (hash) {
                BCryptDestroyHash(hash);
            }
            if (algorithm) {
                BCryptCloseAlgorithmProvider(algorithm, 0);
            }
        }
    } state;
    require(BCryptOpenAlgorithmProvider(&state.algorithm, BCRYPT_SHA256_ALGORITHM, nullptr, 0) >= 0,
            "Cannot initialise SHA-256.");
    DWORD length = 0, received = 0;
    require(BCryptGetProperty(state.algorithm, BCRYPT_OBJECT_LENGTH,
                              reinterpret_cast<PUCHAR>(&length), sizeof(length), &received, 0) >= 0,
            "Cannot initialise SHA-256 storage.");
    object.resize(length);
    require(BCryptCreateHash(state.algorithm, &state.hash, object.data(), length, nullptr, 0, 0) >=
                0,
            "Cannot create a SHA-256 hash.");
    std::array<UCHAR, 65536> buffer{};
    for (;;) {
        DWORD count = 0;
        require(ReadFile(file, buffer.data(), static_cast<DWORD>(buffer.size()), &count, nullptr) !=
                    FALSE,
                "Cannot read a runtime file for validation.");
        if (!count) {
            break;
        }
        require(BCryptHashData(state.hash, buffer.data(), count, 0) >= 0,
                "Cannot hash a runtime file.");
    }
    std::array<UCHAR, 32> digest{};
    require(BCryptFinishHash(state.hash, digest.data(), static_cast<ULONG>(digest.size()), 0) >= 0,
            "Cannot finish a runtime hash.");
    std::string result;
    for (const auto value : digest) {
        result += "0123456789abcdef"[value >> 4];
        result += "0123456789abcdef"[value & 15];
    }
    return result;
}

std::set<Path> directories() {
    std::set<Path> result{Path{}};
    for (const auto& file : payload_files) {
        for (auto parent = Path(file.name).parent_path(); !parent.empty();
             parent = parent.parent_path()) {
            result.insert(parent);
        }
    }
    return result;
}

std::optional<std::vector<FileHandle>> validate(const Path& root) {
    try {
        std::vector<FileHandle> guards;
        const auto folders = directories();
        for (const auto& folder : folders) {
            guards.push_back(open_plain(root / folder, true));
        }
        std::set<Path> files{Path(marker_name)};
        for (const auto& file : payload_files) {
            files.insert(Path(file.name));
        }
        // Enumerate only known, locked directories. Never traverse an injected
        // junction or accept an extra DLL merely because the marker exists.
        for (const auto& folder : folders) {
            for (const auto& entry : std::filesystem::directory_iterator(root / folder)) {
                const auto relative = folder / entry.path().filename();
                require(files.contains(relative) || folders.contains(relative),
                        "Unexpected runtime file.");
            }
        }
        for (const auto& file : payload_files) {
            auto handle = open_plain(root / file.name, false);
            LARGE_INTEGER size{};
            require(GetFileSizeEx(handle.get(), &size) &&
                        static_cast<unsigned long long>(size.QuadPart) == file.size,
                    "Cached runtime size mismatch.");
            require(sha256(handle.get()) == file.sha256, "Cached runtime hash mismatch.");
            guards.push_back(std::move(handle));
        }
        auto marker = open_plain(root / marker_name, false);
        const std::string expected = std::string(payload_hash) + "\n";
        std::array<char, 128> contents{};
        DWORD count = 0;
        require(ReadFile(marker.get(), contents.data(), static_cast<DWORD>(contents.size()), &count,
                         nullptr) &&
                    std::string(contents.data(), count) == expected,
                "Runtime completion marker mismatch.");
        guards.push_back(std::move(marker));
        return guards;
    } catch (const std::exception&) {
        return std::nullopt;
    }
}

std::wstring unique_name(const wchar_t* prefix) {
    GUID guid{};
    require(SUCCEEDED(CoCreateGuid(&guid)), "Cannot create a unique runtime staging directory.");
    wchar_t identifier[40]{};
    require(StringFromGUID2(guid, identifier, 40) != 0, "Cannot format the runtime identifier.");
    return std::wstring(prefix) + identifier;
}

void write_file(const Path& path, const void* bytes, DWORD size) {
    FileHandle file(CreateFileW(path.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_NEW,
                                FILE_ATTRIBUTE_NORMAL, nullptr));
    require(file.get() != INVALID_HANDLE_VALUE, "Cannot create the Controller runtime file.");
    DWORD written = 0;
    require(WriteFile(file.get(), bytes, size, &written, nullptr) && written == size &&
                FlushFileBuffers(file.get()),
            "Cannot write the Controller runtime. Check free disk space.");
}

FileHandle extraction_lock(const Path& path) {
    for (unsigned attempt = 0; attempt < 240; ++attempt) {
        const auto handle = CreateFileW(path.c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr,
                                        OPEN_ALWAYS, FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
        if (handle != INVALID_HANDLE_VALUE) {
            FileHandle result(handle);
            BY_HANDLE_FILE_INFORMATION info{};
            require(GetFileInformationByHandle(handle, &info) &&
                        !(info.dwFileAttributes &
                          (FILE_ATTRIBUTE_REPARSE_POINT | FILE_ATTRIBUTE_DIRECTORY)) &&
                        info.nNumberOfLinks == 1,
                    "Invalid runtime extraction lock.");
            return result;
        }
        require(GetLastError() == ERROR_SHARING_VIOLATION, "Cannot lock the Controller cache.");
        Sleep(250);
    }
    throw std::runtime_error(
        "Another Controller launch is still preparing this runtime. Try again shortly.");
}
} // namespace

CachedRuntime prepare_runtime(HINSTANCE instance) {
    std::array<wchar_t, 32768> local{};
    const auto length =
        GetEnvironmentVariableW(L"LOCALAPPDATA", local.data(), static_cast<DWORD>(local.size()));
    require(length && length < local.size() && Path(local.data()).is_absolute(),
            "LOCALAPPDATA must identify your user application-data directory.");
    CachedRuntime result;
    const auto application = Path(local.data()) / L"MotionInputGrid";
    std::filesystem::create_directory(application);
    result.guards.push_back(open_plain(application, true));
    const auto parent = application / L"runtime";
    std::filesystem::create_directory(parent);
    result.guards.push_back(open_plain(parent, true));
    const auto name = Path(payload_hash);
    result.directory = parent / name;
    // File sharing provides a cross-process lock that is automatically released
    // if the first launcher crashes. Successful readers need no write access.
    const auto lock = extraction_lock(parent / (name.wstring() + L".lock"));
    if (auto guards = validate(result.directory)) {
        for (auto& guard : *guards) {
            result.guards.push_back(std::move(guard));
        }
        return result;
    }
    const auto staging = parent / unique_name(L".staging-");
    require(std::filesystem::create_directory(staging),
            "Cannot create the runtime staging directory.");
    for (const auto& folder : directories()) {
        if (!folder.empty()) {
            std::filesystem::create_directory(staging / folder);
        }
    }
    for (const auto& file : payload_files) {
        const auto resource = FindResourceW(instance, MAKEINTRESOURCEW(file.id), RT_RCDATA);
        const auto loaded = resource ? LoadResource(instance, resource) : nullptr;
        const auto size = resource ? SizeofResource(instance, resource) : 0;
        const auto data = loaded ? LockResource(loaded) : nullptr;
        require(data && size == file.size,
                "The embedded Controller payload is incomplete. Download it again.");
        write_file(staging / file.name, data, size);
    }
    // Files are flushed first; the marker is written last. Then validate the
    // whole staged tree against hashes compiled into this executable.
    const auto marker = std::string(payload_hash) + "\n";
    write_file(staging / marker_name, marker.data(), static_cast<DWORD>(marker.size()));
    require(validate(staging).has_value(), "The extracted Controller failed integrity validation.");
    if (GetFileAttributesW(result.directory.c_str()) != INVALID_FILE_ATTRIBUTES) {
        const auto invalid = parent / unique_name(L".invalid-");
        require(MoveFileExW(result.directory.c_str(), invalid.c_str(), MOVEFILE_WRITE_THROUGH) !=
                    FALSE,
                "Cannot replace the invalid runtime. Close other Controller instances and retry.");
    }
    // Same-parent rename is the publication boundary. Abandoned staging and
    // quarantined directories are never executed or recursively removed.
    require(MoveFileExW(staging.c_str(), result.directory.c_str(), MOVEFILE_WRITE_THROUGH) != FALSE,
            "Cannot publish the verified Controller runtime.");
    auto guards = validate(result.directory);
    require(guards.has_value(), "The published Controller runtime failed validation.");
    for (auto& guard : *guards) {
        result.guards.push_back(std::move(guard));
    }
    return result;
}
