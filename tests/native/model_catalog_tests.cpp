#include "models.hpp"
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <vector>

namespace {
void check(bool condition, const char* message) {
    if (!condition) {
        throw std::runtime_error(message);
    }
}
template <class Operation> void rejects(Operation operation, const char* message) {
    bool rejected = false;
    try {
        operation();
    } catch (const std::exception&) {
        rejected = true;
    }
    check(rejected, message);
}
std::vector<std::uint8_t> bytes(std::string_view text) {
    return {text.begin(), text.end()};
}
} // namespace
int main(int argc, char** argv) {
    using namespace mig::native;
    try {
        check(argc == 2 || argc == 3, "Expected a temporary directory and optional native deps.");
        const std::filesystem::path directory = argv[1];
        std::filesystem::remove_all(directory);
        std::filesystem::create_directories(directory);
        // FIPS 180-4 vectors: the empty message and "abc".
        check(sha256_hex(bytes("")) ==
                  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
              "SHA-256 of the empty message is wrong.");
        check(sha256_hex(bytes("abc")) ==
                  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
              "SHA-256 of abc is wrong.");
        const std::vector<std::uint8_t> block(1000, 'a');
        std::vector<std::uint8_t> million;
        for (int i = 0; i < 1000; ++i) {
            million.insert(million.end(), block.begin(), block.end());
        }
        check(sha256_hex(million) ==
                  "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0",
              "SHA-256 of one million a is wrong.");
        check(parse_pose_model("lite") == PoseModel::Lite &&
                  parse_pose_model("full") == PoseModel::Full &&
                  parse_pose_model("heavy") == PoseModel::Heavy && !parse_pose_model("Lite") &&
                  !parse_pose_model(""),
              "Model names must parse exactly.");
        for (const auto& info : pose_models) {
            check(pose_model_info(info.model).name == info.name && info.asset.sha256.size() == 64 &&
                      info.asset.url.ends_with(info.asset.file) && info.asset.size > 0,
                  "Catalog entries must be complete.");
        }
        const auto runtime = directory / "runtime";
        const auto cache = directory / "cache";
        check(locate_pose_model(runtime, PoseModel::Heavy, cache).empty(),
              "Missing models must resolve to an empty path.");
        const auto heavy = pose_model_info(PoseModel::Heavy).asset;
        std::filesystem::create_directories(cache);
        std::ofstream(cache / heavy.file, std::ios::binary) << "cached";
        check(locate_pose_model(runtime, PoseModel::Heavy, cache) == cache / heavy.file,
              "Cached models must be found.");
        std::filesystem::create_directories(runtime / "models");
        std::ofstream(runtime / "models" / heavy.file, std::ios::binary) << "bundled";
        check(locate_pose_model(runtime, PoseModel::Heavy, cache) ==
                  runtime / "models" / heavy.file,
              "Bundled models take precedence over the cache.");
        rejects([&] { verify_model_file(cache / heavy.file, heavy); },
                "A file with the wrong size or digest must be rejected.");
        rejects([&] { verify_model_file(directory / "absent.task", heavy); },
                "A missing file must be rejected.");
        const ModelFile small{"small.task", 3,
                              "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
                              ""};
        std::ofstream(directory / "small.task", std::ios::binary) << "abc";
        verify_model_file(directory / "small.task", small);
        rejects([&] { store_pose_model(PoseModel::Lite, bytes("truncated"), cache); },
                "Truncated downloads must not enter the cache.");
        check(!std::filesystem::exists(cache / pose_model_info(PoseModel::Lite).asset.file),
              "Rejected downloads must leave no file behind.");
        bool staging_left = false;
        for (const auto& entry : std::filesystem::directory_iterator(cache)) {
            staging_left = staging_left || entry.path().extension() == ".part";
        }
        check(!staging_left, "Rejected downloads must leave no staging file.");
        if (argc == 3) {
            // Real pinned files, when the bootstrap directory is available.
            const auto lite = pose_model_info(PoseModel::Lite).asset;
            std::ifstream stream(std::filesystem::path(argv[2]) / "models" / lite.file,
                                 std::ios::binary);
            std::vector<std::uint8_t> contents((std::istreambuf_iterator<char>(stream)),
                                               std::istreambuf_iterator<char>());
            if (contents.size() == lite.size) {
                const auto stored = store_pose_model(PoseModel::Lite, contents, cache);
                check(stored == cache / lite.file &&
                          locate_pose_model(runtime, PoseModel::Lite, cache) == stored,
                      "A verified download must be published into the cache.");
                verify_model_file(stored, lite);
            }
        }
        std::filesystem::remove_all(directory);
        std::cout << "Model catalog, SHA-256, lookup order and cache publication passed.\n";
        return 0;
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
