#include "models.hpp"
#include <algorithm>
#include <bit>
#include <cstdlib>
#include <fstream>
#include <random>
#include <stdexcept>
#ifdef _WIN32
#include <shlobj.h>
#endif

namespace mig::native {
namespace {
// FIPS 180-4 SHA-256. Models are hashed once per load, so plain C++ is enough.
class Sha256 {
public:
    void update(std::span<const std::uint8_t> bytes) {
        for (const auto byte : bytes) {
            block_[used_++] = byte;
            if (used_ == block_.size()) {
                compress();
            }
        }
        total_ += bytes.size();
    }
    std::string finish() {
        const auto bits = total_ * 8;
        update(std::array<std::uint8_t, 1>{0x80});
        while (used_ != 56) {
            update(std::array<std::uint8_t, 1>{0});
        }
        std::array<std::uint8_t, 8> length{};
        for (std::size_t i = 0; i < 8; ++i) {
            length[i] = std::uint8_t(bits >> (56 - 8 * i));
        }
        update(length);
        std::string hex;
        for (const auto word : state_) {
            for (int shift = 28; shift >= 0; shift -= 4) {
                hex += "0123456789abcdef"[(word >> shift) & 15];
            }
        }
        return hex;
    }

private:
    static constexpr std::array<std::uint32_t, 64> round_constants{
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
        0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
        0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
        0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
        0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
        0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
        0xc67178f2};
    void compress() {
        std::array<std::uint32_t, 64> w{};
        for (std::size_t i = 0; i < 16; ++i) {
            w[i] = std::uint32_t(block_[i * 4]) << 24 | std::uint32_t(block_[i * 4 + 1]) << 16 |
                   std::uint32_t(block_[i * 4 + 2]) << 8 | block_[i * 4 + 3];
        }
        for (std::size_t i = 16; i < 64; ++i) {
            const auto s0 = std::rotr(w[i - 15], 7) ^ std::rotr(w[i - 15], 18) ^ (w[i - 15] >> 3);
            const auto s1 = std::rotr(w[i - 2], 17) ^ std::rotr(w[i - 2], 19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16] + s0 + w[i - 7] + s1;
        }
        auto [a, b, c, d, e, f, g, h] = state_;
        for (std::size_t i = 0; i < 64; ++i) {
            const auto s1 = std::rotr(e, 6) ^ std::rotr(e, 11) ^ std::rotr(e, 25);
            const auto choice = (e & f) ^ (~e & g);
            const auto t1 = h + s1 + choice + round_constants[i] + w[i];
            const auto s0 = std::rotr(a, 2) ^ std::rotr(a, 13) ^ std::rotr(a, 22);
            const auto majority = (a & b) ^ (a & c) ^ (b & c);
            const auto t2 = s0 + majority;
            h = g;
            g = f;
            f = e;
            e = d + t1;
            d = c;
            c = b;
            b = a;
            a = t1 + t2;
        }
        const std::array<std::uint32_t, 8> added{a, b, c, d, e, f, g, h};
        for (std::size_t i = 0; i < 8; ++i) {
            state_[i] += added[i];
        }
        used_ = 0;
    }
    std::array<std::uint32_t, 8> state_{0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
                                        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19};
    std::array<std::uint8_t, 64> block_{};
    std::size_t used_{};
    std::uint64_t total_{};
};
std::filesystem::path staging_sibling(const std::filesystem::path& target) {
    std::random_device device;
    const auto token = std::uint64_t(device()) << 32 | device();
    return target.parent_path() /
           (target.filename().string() + "." + std::to_string(token) + ".part");
}
} // namespace
const PoseModelInfo& pose_model_info(PoseModel model) noexcept {
    for (const auto& info : pose_models) {
        if (info.model == model) {
            return info;
        }
    }
    return pose_models[1]; // Lite; unreachable for valid enumerators.
}
std::optional<PoseModel> parse_pose_model(std::string_view name) noexcept {
    for (const auto& info : pose_models) {
        if (info.name == name) {
            return info.model;
        }
    }
    return std::nullopt;
}
std::filesystem::path model_cache_directory() {
#ifdef _WIN32
    PWSTR directory{};
    if (FAILED(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &directory))) {
        throw std::runtime_error("Cannot locate the application data folder.");
    }
    const auto result = std::filesystem::path(directory) / L"MIG" / L"models";
    CoTaskMemFree(directory);
    return result;
#else
    if (const auto* directory = std::getenv("XDG_DATA_HOME"); directory && *directory) {
        const std::filesystem::path root(directory);
        if (root.is_absolute()) {
            return root / "mig/models";
        }
    }
    if (const auto* home = std::getenv("HOME"); home && *home) {
        return std::filesystem::path(home) / ".local/share/mig/models";
    }
    throw std::runtime_error("Cannot locate the application data folder.");
#endif
}
std::filesystem::path locate_pose_model(const std::filesystem::path& runtime, PoseModel model) {
    return locate_pose_model(runtime, model, model_cache_directory());
}
std::filesystem::path locate_pose_model(const std::filesystem::path& runtime, PoseModel model,
                                        const std::filesystem::path& cache) {
    const auto file = pose_model_info(model).asset.file;
    for (const auto& candidate : {runtime / "models" / file, cache / file}) {
        if (std::filesystem::is_regular_file(candidate)) {
            return candidate;
        }
    }
    return {};
}
std::string sha256_hex(std::span<const std::uint8_t> bytes) {
    Sha256 hash;
    hash.update(bytes);
    return hash.finish();
}
std::string sha256_hex(const std::filesystem::path& path) {
    std::ifstream stream(path, std::ios::binary);
    if (!stream) {
        throw std::runtime_error("Cannot read model file " + path.string());
    }
    Sha256 hash;
    std::array<char, 65536> buffer{};
    while (stream.read(buffer.data(), std::streamsize(buffer.size())) || stream.gcount() > 0) {
        hash.update(std::span(reinterpret_cast<const std::uint8_t*>(buffer.data()),
                              std::size_t(stream.gcount())));
    }
    return hash.finish();
}
void verify_model_file(const std::filesystem::path& path, const ModelFile& expected) {
    std::error_code error;
    const auto size = std::filesystem::file_size(path, error);
    if (error || size != expected.size || sha256_hex(path) != expected.sha256) {
        throw std::runtime_error(std::string(expected.file) +
                                 " does not match the pinned MediaPipe release: delete it and "
                                 "download it again");
    }
}
std::filesystem::path store_pose_model(PoseModel model, std::span<const std::uint8_t> bytes,
                                       const std::filesystem::path& cache) {
    const auto& asset = pose_model_info(model).asset;
    if (bytes.size() != asset.size || sha256_hex(bytes) != asset.sha256) {
        throw std::runtime_error(std::string(asset.file) +
                                 " download is incomplete or does not match the pinned "
                                 "MediaPipe release");
    }
    std::filesystem::create_directories(cache);
    const auto target = cache / asset.file;
    const auto staging = staging_sibling(target);
    {
        std::ofstream stream(staging, std::ios::binary | std::ios::trunc);
        stream.write(reinterpret_cast<const char*>(bytes.data()), std::streamsize(bytes.size()));
        if (!stream) {
            std::error_code ignored;
            std::filesystem::remove(staging, ignored);
            throw std::runtime_error("Cannot write the model cache: check free disk space");
        }
    }
    std::error_code error;
    std::filesystem::rename(staging, target, error); // Same directory: atomic publication.
    if (error) {
        std::error_code ignored;
        std::filesystem::remove(staging, ignored);
        throw std::runtime_error("Cannot publish the downloaded model: " + error.message());
    }
    return target;
}
} // namespace mig::native
