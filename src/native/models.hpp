#pragma once
#include <array>
#include <cstdint>
#include <filesystem>
#include <optional>
#include <span>
#include <string>
#include <string_view>

namespace mig::native {
enum class PoseModel { Full, Lite, Heavy };
// One pinned MediaPipe Tasks release (Apache-2.0, published by Google). Files are
// accepted only when their size and SHA-256 match these constants.
struct ModelFile {
    std::string_view file;
    std::uint64_t size;
    std::string_view sha256;
    std::string_view url;
};
struct PoseModelInfo {
    PoseModel model;
    std::string_view name;  // Command-line, settings and API identifier.
    std::string_view label; // Short display label.
    ModelFile asset;
};
inline constexpr std::array<PoseModelInfo, 3> pose_models{
    {{PoseModel::Full,
      "full",
      "Full",
      {"pose_landmarker_full.task", 9398198,
       "5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1",
       "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/"
       "float16/1/pose_landmarker_full.task"}},
     {PoseModel::Lite,
      "lite",
      "Lite",
      {"pose_landmarker_lite.task", 5777746,
       "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a",
       "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/"
       "float16/1/pose_landmarker_lite.task"}},
     {PoseModel::Heavy,
      "heavy",
      "Heavy",
      {"pose_landmarker_heavy.task", 30664242,
       "64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b",
       "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/"
       "float16/1/pose_landmarker_heavy.task"}}}};
inline constexpr ModelFile hand_model{
    "hand_landmarker.task", 7819105,
    "fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1",
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/"
    "hand_landmarker.task"};
const PoseModelInfo& pose_model_info(PoseModel model) noexcept;
std::optional<PoseModel> parse_pose_model(std::string_view name) noexcept;
// Downloaded models live outside the runtime directory, which may be read-only
// or integrity-locked. Windows: %LOCALAPPDATA%/MIG/models; Linux: XDG data.
std::filesystem::path model_cache_directory();
// The bundled runtime/models file wins; otherwise the cache copy. Empty when absent.
std::filesystem::path locate_pose_model(const std::filesystem::path& runtime, PoseModel model);
std::filesystem::path locate_pose_model(const std::filesystem::path& runtime, PoseModel model,
                                        const std::filesystem::path& cache);
std::string sha256_hex(std::span<const std::uint8_t> bytes);
std::string sha256_hex(const std::filesystem::path& path);
// Throw unless the file has the pinned size and digest.
void verify_model_file(const std::filesystem::path& path, const ModelFile& expected);
// Verify downloaded bytes, then publish them atomically as cache/<file>.
std::filesystem::path store_pose_model(PoseModel model, std::span<const std::uint8_t> bytes,
                                       const std::filesystem::path& cache);
} // namespace mig::native
