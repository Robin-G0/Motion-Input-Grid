#include "profiles.hpp"
#include "../format/src/atomic_file.hpp"
#include <algorithm>
#include <cstdlib>
#include <fstream>
#include <nlohmann/json.hpp>
#include <set>
#include <utility>
#ifdef _WIN32
#include <shlobj.h>
#endif

namespace mig::controller {
namespace {
void validate_name(const std::string& name) {
    if (name.empty() || name.size() > 256 || name.find_first_not_of(" \t\r\n") == name.npos ||
        name.find_first_of("\r\n") != name.npos) {
        throw std::runtime_error("Profile name must contain 1 to 256 bytes on one line.");
    }
}
void validate_id(const std::string& id) {
    if (id.empty() || id.size() > 16 || id.find_first_not_of("0123456789") != id.npos) {
        throw std::runtime_error("Invalid saved profile identifier.");
    }
}
void validate_model_name(const std::string& name) {
    if (name.size() > 16 || name.find_first_not_of("abcdefghijklmnopqrstuvwxyz") != name.npos) {
        throw std::runtime_error("Invalid saved pose model name.");
    }
}
} // namespace
Profiles::Profiles(std::filesystem::path directory) : directory_(std::move(directory)) {}
std::filesystem::path user_directory() {
#ifdef _WIN32
    PWSTR directory{};
    if (FAILED(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &directory))) {
        throw std::runtime_error("Cannot locate the application data folder.");
    }
    const auto result = std::filesystem::path(directory) / L"MIG" / L"controller";
    CoTaskMemFree(directory);
    return result;
#else
    if (const auto* directory = std::getenv("XDG_DATA_HOME"); directory && *directory) {
        const std::filesystem::path root(directory);
        if (root.is_absolute()) {
            return root / "mig/controller";
        }
    }
    if (const auto* home = std::getenv("HOME"); home && *home) {
        return std::filesystem::path(home) / ".local/share/mig/controller";
    }
    throw std::runtime_error("Cannot locate the application data folder.");
#endif
}
void Profiles::restore() {
    const auto path = directory_ / "profiles.json";
    if (!std::filesystem::exists(path)) {
        return;
    }
    std::ifstream stream(path, std::ios::binary);
    std::string bytes(65537, '\0');
    stream.read(bytes.data(), std::streamsize(bytes.size()));
    if (!stream || stream.bad()) {
        if (!stream.eof()) {
            throw std::runtime_error("Cannot read saved profiles.");
        }
    }
    const auto length = stream.gcount();
    if (length > 65536) {
        throw std::runtime_error("Saved profiles exceed 64 KiB.");
    }
    bytes.resize(std::size_t(length));
    const auto document =
        nlohmann::json::parse(bytes, [](int depth, nlohmann::json::parse_event_t, nlohmann::json&) {
            if (depth > 8) {
                throw std::runtime_error("Saved profiles nesting exceeds 8 levels.");
            }
            return true;
        });
    if (document.at("version") != 1 || !document.at("profiles").is_array() ||
        document.at("profiles").size() > 64) {
        throw std::runtime_error("Invalid saved profile list.");
    }
    std::vector<Profile> entries;
    std::set<std::string> ids;
    for (const auto& item : document.at("profiles")) {
        Profile entry{item.at("id").get<std::string>(), item.at("name").get<std::string>()};
        validate_id(entry.id);
        validate_name(entry.name);
        if (!ids.insert(entry.id).second) {
            throw std::runtime_error("Duplicate saved profile identifier.");
        }
        entries.push_back(std::move(entry));
    }
    const auto selected = document.at("selected");
    if (!selected.is_number_integer() || selected < -1 || selected >= int(entries.size())) {
        throw std::runtime_error("Invalid selected profile.");
    }
    std::string pose_model = document.value("pose_model", "");
    validate_model_name(pose_model);
    entries_ = std::move(entries);
    selected_ = selected.get<int>();
    pose_model_ = std::move(pose_model);
}
void Profiles::persist(const std::vector<Profile>& entries, int selected) const {
    nlohmann::json document{
        {"version", 1}, {"selected", selected}, {"profiles", nlohmann::json::array()}};
    for (const auto& entry : entries) {
        document["profiles"].push_back({{"id", entry.id}, {"name", entry.name}});
    }
    if (!pose_model_.empty()) {
        document["pose_model"] = pose_model_;
    }
    std::filesystem::create_directories(directory_);
    format::detail::replace_document(directory_ / "profiles.json", document.dump(4) + "\n");
}
std::size_t Profiles::import(const std::filesystem::path& source, std::string name) {
    return import(load_configuration(source), std::move(name));
}
std::size_t Profiles::import(Configuration config, std::string name) {
    validate_name(name);
    if (entries_.size() >= 64) {
        throw std::runtime_error("Maximum 64 profiles.");
    }
    auto proposed = entries_;
    unsigned number = 1;
    const auto occupied = [&](unsigned number) {
        const auto id = std::to_string(number);
        return std::any_of(entries_.begin(), entries_.end(),
                           [&](const auto& entry) { return entry.id == id; }) ||
               std::filesystem::exists(directory_ / (id + ".json"));
    };
    while (occupied(number)) {
        ++number;
    }
    proposed.push_back({std::to_string(number), std::move(name)});
    std::filesystem::create_directories(directory_);
    const auto destination = directory_ / (proposed.back().id + ".json");
    save_configuration(config, destination);
    try {
        persist(proposed, int(proposed.size() - 1));
    } catch (...) {
        std::error_code ignored;
        std::filesystem::remove(destination, ignored);
        throw;
    }
    entries_ = std::move(proposed);
    selected_ = int(entries_.size() - 1);
    return std::size_t(selected_);
}
void Profiles::rename(std::size_t index, std::string name) {
    validate_name(name);
    auto proposed = entries_;
    proposed.at(index).name = std::move(name);
    persist(proposed, selected_);
    entries_ = std::move(proposed);
}
void Profiles::select(std::size_t index) {
    if (index >= entries_.size()) {
        throw std::out_of_range("Profile index is out of range.");
    }
    if (selected_ == int(index)) {
        return;
    }
    persist(entries_, int(index));
    selected_ = int(index);
}
std::filesystem::path Profiles::file(std::size_t index) const {
    return directory_ / (entries_.at(index).id + ".json");
}
Configuration Profiles::load(std::size_t index) const {
    return load_configuration(file(index));
}
void Profiles::export_file(std::size_t index, const std::filesystem::path& destination) const {
    save_configuration(load(index), destination);
}
const std::vector<Profile>& Profiles::entries() const noexcept {
    return entries_;
}
int Profiles::selected() const noexcept {
    return selected_;
}
const std::string& Profiles::pose_model() const noexcept {
    return pose_model_;
}
void Profiles::set_pose_model(std::string name) {
    validate_model_name(name);
    const auto previous = std::exchange(pose_model_, std::move(name));
    try {
        persist(entries_, selected_);
    } catch (...) {
        pose_model_ = previous;
        throw;
    }
}
} // namespace mig::controller
