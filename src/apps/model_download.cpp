#include "model_download.hpp"
#include "app.hpp"
#include <stdexcept>
#include <vector>
#include <winhttp.h>

namespace mig::app {
namespace {
struct Handle {
    HINTERNET value{};
    ~Handle() {
        if (value) {
            WinHttpCloseHandle(value);
        }
    }
};
void require(bool condition, const std::string& message) {
    if (!condition) {
        throw std::runtime_error(message + " (Windows error " + std::to_string(GetLastError()) +
                                 ")");
    }
}
std::vector<std::uint8_t> download(const std::wstring& url, std::uint64_t expected_size,
                                   const std::function<void(std::uint64_t)>& received) {
    wchar_t host[256]{}, path[2048]{};
    URL_COMPONENTSW parts{};
    parts.dwStructSize = sizeof(parts);
    parts.lpszHostName = host;
    parts.dwHostNameLength = DWORD(std::size(host));
    parts.lpszUrlPath = path;
    parts.dwUrlPathLength = DWORD(std::size(path));
    require(WinHttpCrackUrl(url.c_str(), DWORD(url.size()), 0, &parts) &&
                parts.nScheme == INTERNET_SCHEME_HTTPS,
            "Model downloads require an HTTPS URL");
    Handle session{WinHttpOpen(L"MotionInputGrid", WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
                               WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0)};
    require(session.value != nullptr, "Cannot open an HTTPS session");
    WinHttpSetTimeouts(session.value, 10000, 10000, 30000, 30000);
    Handle connection{WinHttpConnect(session.value, host, parts.nPort, 0)};
    require(connection.value != nullptr, "Cannot connect to the model server");
    Handle request{WinHttpOpenRequest(connection.value, L"GET", path, nullptr, WINHTTP_NO_REFERER,
                                      WINHTTP_DEFAULT_ACCEPT_TYPES, WINHTTP_FLAG_SECURE)};
    require(request.value != nullptr, "Cannot prepare the model request");
    require(WinHttpSendRequest(request.value, WINHTTP_NO_ADDITIONAL_HEADERS, 0,
                               WINHTTP_NO_REQUEST_DATA, 0, 0, 0) &&
                WinHttpReceiveResponse(request.value, nullptr),
            "Model download failed: check the internet connection");
    DWORD status{}, length = sizeof(status);
    WinHttpQueryHeaders(request.value, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                        WINHTTP_HEADER_NAME_BY_INDEX, &status, &length, WINHTTP_NO_HEADER_INDEX);
    if (status != 200) {
        throw std::runtime_error("Model download refused (HTTP " + std::to_string(status) + ")");
    }
    std::vector<std::uint8_t> bytes;
    bytes.reserve(std::size_t(expected_size));
    for (;;) {
        DWORD available{};
        require(WinHttpQueryDataAvailable(request.value, &available), "Model download interrupted");
        if (!available) {
            break;
        }
        const auto offset = bytes.size();
        if (offset + available > expected_size) {
            throw std::runtime_error("Model download is larger than the pinned release");
        }
        bytes.resize(offset + available);
        DWORD read{};
        require(WinHttpReadData(request.value, bytes.data() + offset, available, &read),
                "Model download interrupted");
        bytes.resize(offset + read);
        received(bytes.size());
    }
    return bytes;
}
} // namespace
std::filesystem::path ensure_pose_model(const std::filesystem::path& runtime,
                                        native::PoseModel model,
                                        const std::function<void(std::string)>& report) {
    if (const auto found = native::locate_pose_model(runtime, model); !found.empty()) {
        return found;
    }
    const auto& info = native::pose_model_info(model);
    const auto label = std::string(info.label);
    const auto megabytes = std::to_string((info.asset.size + 500000) / 1000000);
    report("Downloading the " + label + " pose model (" + megabytes + " MB)...");
    unsigned reported_percent = 0;
    const auto bytes = download(wide(info.asset.url), info.asset.size, [&](std::uint64_t count) {
        const auto percent = unsigned(count * 100 / info.asset.size);
        if (percent / 25 != reported_percent / 25) {
            reported_percent = percent;
            report("Downloading the " + label + " pose model: " + std::to_string(percent) + "%");
        }
    });
    const auto stored = native::store_pose_model(model, bytes, native::model_cache_directory());
    report(label + " pose model verified and saved for offline use.");
    return stored;
}
} // namespace mig::app
