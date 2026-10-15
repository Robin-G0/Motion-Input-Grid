#pragma once
#include <filesystem>
#include <vector>
#include <windows.h>

class FileHandle {
public:
    explicit FileHandle(HANDLE handle = INVALID_HANDLE_VALUE) : value_(handle) {}
    ~FileHandle() {
        if (value_ != INVALID_HANDLE_VALUE) {
            CloseHandle(value_);
        }
    }
    FileHandle(const FileHandle&) = delete;
    FileHandle& operator=(const FileHandle&) = delete;
    FileHandle(FileHandle&& other) noexcept : value_(other.value_) {
        other.value_ = INVALID_HANDLE_VALUE;
    }
    HANDLE get() const {
        return value_;
    }

private:
    HANDLE value_;
};

struct CachedRuntime {
    std::filesystem::path directory;
    // Deny writes/deletes to validated files and renames of their directories
    // until the child exits. Other Controller launches can still read them.
    std::vector<FileHandle> guards;
};

CachedRuntime prepare_runtime(HINSTANCE instance);
