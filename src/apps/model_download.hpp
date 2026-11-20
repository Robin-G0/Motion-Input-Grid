#pragma once
#include "models.hpp"
#include <filesystem>
#include <functional>
#include <string>

namespace mig::app {
// Return the bundled or cached file for `model`; otherwise download the pinned
// release over HTTPS, verify it and publish it into the user model cache.
// `report` receives progress text. Throws when offline or when integrity fails.
std::filesystem::path ensure_pose_model(const std::filesystem::path& runtime,
                                        native::PoseModel model,
                                        const std::function<void(std::string)>& report);
} // namespace mig::app
