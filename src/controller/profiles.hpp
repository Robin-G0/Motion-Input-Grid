#pragma once
#include <filesystem>
#include <mig/format/configuration.hpp>
#include <string>
#include <vector>

namespace mig::controller {
struct Profile {
    std::string id;
    std::string name;
};
class Profiles {
public:
    explicit Profiles(std::filesystem::path directory);
    void restore();
    std::size_t import(const std::filesystem::path& source, std::string name);
    std::size_t import(Configuration config, std::string name);
    void rename(std::size_t index, std::string name);
    void select(std::size_t index);
    Configuration load(std::size_t index) const;
    void export_file(std::size_t index, const std::filesystem::path& destination) const;
    const std::vector<Profile>& entries() const noexcept;
    int selected() const noexcept;
    // Pose model identifier chosen in the Controller ("lite", "full", "heavy");
    // empty when the user never chose one. Applications parse and validate it.
    const std::string& pose_model() const noexcept;
    void set_pose_model(std::string name);

private:
    void persist(const std::vector<Profile>& entries, int selected) const;
    std::filesystem::path file(std::size_t index) const;
    std::filesystem::path directory_;
    std::vector<Profile> entries_;
    int selected_{-1};
    std::string pose_model_;
};
std::filesystem::path user_directory();
} // namespace mig::controller
