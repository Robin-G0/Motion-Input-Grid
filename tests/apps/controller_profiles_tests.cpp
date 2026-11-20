#include "../../src/controller/profiles.hpp"
#include <fstream>
#include <iostream>

namespace {
void check(bool condition, const char* message) {
    if (!condition) {
        throw std::runtime_error(message);
    }
}
template <class Operation> void rejects(Operation operation) {
    bool rejected = false;
    try {
        operation();
    } catch (const std::exception&) {
        rejected = true;
    }
    check(rejected, "Invalid operation was accepted.");
}
} // namespace
int main(int argc, char** argv) {
    using mig::controller::Profiles;
    try {
        check(argc == 3, "Expected temporary directory and sample profile.");
        const auto directory = std::filesystem::path(argv[1]);
        std::filesystem::remove_all(directory);
        std::filesystem::create_directories(directory);
        const auto source = directory / "source.json";
        const auto original = mig::load_configuration(argv[2]);
        mig::save_configuration(original, source);
        Profiles profiles(directory / "managed");
        profiles.restore();
        const auto first = profiles.import(source, "Game one");
        const auto second = profiles.import(source, "Game two");
        profiles.rename(first, "Renamed game");
        profiles.rename(second, std::string(256, 'x'));
        rejects([&] { profiles.rename(second, std::string(257, 'x')); });
        profiles.select(first);
        std::filesystem::remove(source);
        Profiles restored(directory / "managed");
        restored.restore();
        check(restored.selected() == int(first) && restored.entries().size() == 2 &&
                  restored.entries()[first].name == "Renamed game" &&
                  restored.load(first) == original,
              "Profile selection/name/copy did not survive restart.");
        check(restored.pose_model().empty(), "No pose model is stored until chosen.");
        restored.set_pose_model("heavy");
        rejects([&] { restored.set_pose_model("Heavy!"); });
        Profiles reopened(directory / "managed");
        reopened.restore();
        check(reopened.pose_model() == "heavy" && reopened.selected() == int(first),
              "The chosen pose model did not survive restart.");
        restored.export_file(second, source);
        check(mig::load_configuration(source) == original, "Export changed the configuration.");
        std::ofstream(source) << "invalid JSON";
        rejects([&] { restored.import(source, "Broken"); });
        rejects([&] { restored.rename(first, "  "); });
        rejects([&] { restored.select(64); });
        check(restored.selected() == int(first) && restored.entries().size() == 2,
              "Invalid operation replaced the selected profile.");
        std::ofstream(directory / "managed/profiles.json")
            << R"({"version":1,"selected":0,"profiles":[{"id":"../source","name":"bad"}]})";
        rejects([&] { restored.restore(); });
        check(restored.entries().size() == 2, "Failed restore mutated existing profiles.");
        std::filesystem::remove_all(directory);
        std::cout << "Managed profile persistence and invalid-operation preservation passed.\n";
        return 0;
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
