#include <chrono>
#include <fstream>
#include <iostream>
#include <memory>
#include <mig/format/configuration.hpp>
#include <mutex>
#include <stdexcept>
#include <thread>
#include <vector>
#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>

void verify_locked_replacement(const mig::Configuration& configuration,
                               const std::filesystem::path& path) {
    std::unique_ptr<void, decltype(&CloseHandle)> handle(
        CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr,
                    OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr),
        &CloseHandle);
    if (handle.get() == INVALID_HANDLE_VALUE) {
        handle.release();
        throw std::runtime_error("Cannot lock configuration for replacement test");
    }
    std::jthread release([handle = std::move(handle)]() mutable {
        std::this_thread::sleep_for(std::chrono::milliseconds(50));
        handle.reset();
    });
    mig::save_configuration(configuration, path);
    if (mig::load_configuration(path) != configuration) {
        throw std::runtime_error("Replacement after temporary file lock lost configuration");
    }
}
#endif

int main(int argc, char** argv) {
    try {
        if (argc != 2) {
            throw std::runtime_error("Require test output path");
        }
        const std::filesystem::path path = argv[1];
        const auto empty = mig::parse_configuration("{\"schema_version\":2,\"inputs\":[]}");
        if (!empty.motions.empty() ||
            mig::parse_configuration(mig::serialize_configuration(empty)) != empty) {
            throw std::runtime_error("In-memory configuration roundtrip failed");
        }
        for (const auto& invalid :
             {std::string("{\"schema_version\":1,\"inputs\":[]}"),
              std::string(1024 * 1024 + 1, ' '),
              std::string("{\"schema_version\":2,\"inputs\":[],\"unknown\":true}")}) {
            bool rejected = false;
            try {
                mig::parse_configuration(invalid);
            } catch (const std::exception&) {
                rejected = true;
            }
            if (!rejected) {
                throw std::runtime_error("In-memory import must retain strict validation");
            }
        }
        mig::Motion definition;
        definition.id = definition.name = definition.action = "roundtrip";
        definition.keyboard = {{mig::KeyboardActionType::Chord, {17, 16, 75}, {}}};
        definition.cooldown_ms = 750;
        mig::Step route{"route", mig::StepMode::Ordered};
        route.constraints = {{"start", 15, {4, 5}},
                             {"fire", 15, {4, 3}, mig::ConstraintType::Trigger}};
        definition.steps = {route};
        const mig::Configuration original{{definition}};
        // Escaped JSON NUL must not become a truncated identifier/action at the C ABI.
        const auto encoded = mig::serialize_configuration(original);
        for (const auto field : {"id", "name", "action"}) {
            auto document = encoded;
            const auto value =
                document.find(std::string("\"") + field + "\": \"") + std::string(field).size() + 5;
            document.insert(value, "\\u0000");
            bool rejected = false;
            try {
                mig::parse_configuration(document);
            } catch (const std::exception&) {
                rejected = true;
            }
            if (!rejected) {
                throw std::runtime_error("Escaped NUL in profile text accepted");
            }
        }
        mig::save_configuration(original, path);
        for (auto mode :
             {mig::ActionMode::SinglePress, mig::ActionMode::Hold, mig::ActionMode::Repeat}) {
            auto mode_profile = original;
            mode_profile.motions[0].action_mode = mode;
            mode_profile.motions[0].repeat_interval_ms = 375;
            mig::save_configuration(mode_profile, path);
            if (mig::load_configuration(path) != mode_profile) {
                throw std::runtime_error("Action mode/interval JSON roundtrip failed");
            }
        }
        mig::save_configuration(original, path);
        mig::save_configuration(original, path); // Atomic replacement of an existing profile.
#ifdef _WIN32
        verify_locked_replacement(original, path);
#endif
        auto marker = path;
        marker += ".tmp";
        {
            std::ofstream output(marker);
            output << "user-owned marker";
        }
        std::mutex writer_error_mutex;
        std::string writer_error;
        {
            std::vector<std::jthread> writers;
            for (int writer = 0; writer < 4; ++writer) {
                writers.emplace_back([&] {
                    try {
                        for (int save = 0; save < 4; ++save) {
                            mig::save_configuration(original, path);
                        }
                    } catch (const std::exception& error) {
                        std::lock_guard lock(writer_error_mutex);
                        writer_error = error.what();
                    }
                });
            }
        }
        if (!writer_error.empty()) {
            throw std::runtime_error("Concurrent save failed: " + writer_error);
        }
        std::string marker_text;
        {
            std::ifstream input(marker);
            std::getline(input, marker_text);
        }
        if (marker_text != "user-owned marker") {
            throw std::runtime_error("Unrelated temporary file overwritten");
        }
        std::filesystem::remove(marker);
        const auto restored = mig::load_configuration(path);
        auto sequence_profile = original;
        sequence_profile.motions[0].keyboard = {{mig::KeyboardActionType::Text, {}, "Hello world"},
                                                {mig::KeyboardActionType::Chord, {13}, {}},
                                                {mig::KeyboardActionType::Chord, {17, 67}, {}},
                                                {mig::KeyboardActionType::Chord, {67}, {}},
                                                {mig::KeyboardActionType::Chord, {67}, {}}};
        mig::save_configuration(sequence_profile, path);
        if (mig::load_configuration(path) != sequence_profile) {
            throw std::runtime_error("Ordered text/shortcut/repeated-key JSON roundtrip failed");
        }
        auto interaction_profile = original;
        auto& interaction_cell = interaction_profile.motions[0].steps[0].constraints[1];
        interaction_cell.type = mig::ConstraintType::Interaction;
        interaction_cell.interaction =
            mig::Interaction{mig::HandSide::Right, mig::Gesture::OK, 60000};
        interaction_profile.controls.record_toggle = {mig::Gesture::OpenPalm, mig::HandSide::Left};
        mig::save_configuration(interaction_profile, path);
        if (mig::load_configuration(path) != interaction_profile) {
            throw std::runtime_error("Interaction and extended hand gesture JSON roundtrip failed");
        }
        auto grouped = original;
        grouped.motions[0].steps[0].constraints[0].order = 1;
        grouped.motions[0].steps[0].constraints[1].order = 2;
        auto alternate = grouped.motions[0].steps[0].constraints[0];
        alternate.id = "alternative_start";
        alternate.cell.x += 1;
        grouped.motions[0].steps[0].constraints.insert(
            grouped.motions[0].steps[0].constraints.begin() + 1, alternate);
        mig::save_configuration(grouped, path);
        if (mig::load_configuration(path) != grouped) {
            throw std::runtime_error("Alternative order groups lost during JSON roundtrip");
        }
        mig::save_configuration(original, path);
        {
            std::ifstream input(path);
            const std::string saved((std::istreambuf_iterator<char>(input)), {});
            if (saved.find("\"schema_version\": 2") == std::string::npos) {
                throw std::runtime_error("Writer must emit schema v2");
            }
        }
        if (restored.track_hands) {
            throw std::runtime_error("Body-only default changed");
        }
        auto hands_profile = original;
        hands_profile.track_hands = true;
        mig::save_configuration(hands_profile, path);
        if (!mig::load_configuration(path).track_hands) {
            throw std::runtime_error("Hands request lost");
        }
        const auto rejects = [&](const std::string& document) {
            {
                std::ofstream output(path);
                output << document;
            }
            try {
                mig::load_configuration(path);
            } catch (const std::exception&) {
                return;
            }
            throw std::runtime_error("Invalid JSON contract accepted");
        };
        rejects(R"({"schema_version":1,"tracking":{"hands":1},"motions":[]})");
        rejects(R"({"schema_version":1,"tracking":true,"motions":[]})");
        rejects(R"({"schema_version":1.0,"motions":[]})");
        rejects(std::string(1024 * 1024 + 1, ' '));
        rejects(std::string(40, '[') + "0" + std::string(40, ']'));
        rejects(
            R"({"schema_version":1,"motions":[{"id":"bad","member":"left_wrist","trigger_index":1.5,"path":[[0,0],[1,1]]}]})");
        rejects(
            R"({"schema_version":1,"motions":[{"id":"bad","member":"left_wrist","trigger_index":1,"key":4294967296,"path":[[0,0],[1,1]]}]})");
        if (restored.motions[0].id != "roundtrip" ||
            restored.motions[0].keyboard != definition.keyboard || restored != original) {
            throw std::runtime_error("JSON roundtrip failed");
        }
        {
            std::ofstream output(path);
            output << R"({"schema_version":9,"motions":[]})";
        }
        bool rejected = false;
        try {
            mig::load_configuration(path);
        } catch (...) {
            rejected = true;
        }
        if (!rejected) {
            throw std::runtime_error("Unsupported schema accepted");
        }
        rejects(
            R"({"schema_version":1,"motions":[{"id":"old","member":"left_wrist","path":[[4,5],[4,3]],"trigger_index":1}]})");
        rejects(
            R"({"schema_version":2,"inputs":[{"id":"old","name":"old","action":"old","legacy_path":{"member":"left_wrist","path":[[4,5],[4,3]],"trigger_index":1}}]})");
        rejects(R"({"schema_version":2,"tracking":{"hands":1},"inputs":[]})");
        rejects(R"({"schema_version":2.0,"inputs":[]})");
        rejects(
            R"({"schema_version":2,"inputs":[{"id":"bad","name":"bad","action":"bad","steps":[{"id":"s","mode":"visited","constraints":[{"id":"c","landmark":"left_wrist","cell":[4,5],"type":"interaction","priority":"high"}]}]}]})");
        rejects(
            R"({"schema_version":2,"inputs":[{"id":"bad","name":"bad","action":"bad","steps":[{"id":"s","mode":"visited","constraints":[{"id":"c","landmark":"left_wrist","cell":[4,5],"type":"interaction","priority":"high","interaction":{"hand":"left","gesture":"none","hold_ms":0}}]}]}]})");
        rejects(
            R"({"schema_version":2,"inputs":[{"id":"old","name":"old","action":"old","key":32}]})");
        rejects(
            R"({"schema_version":2,"inputs":[{"id":"old","name":"old","action":"old","keys":[32]}]})");
        rejects(
            R"({"schema_version":2,"inputs":[{"id":"bad","name":"bad","action":"bad","keyboard":[{"keys":[17,17]}]}]})");
        rejects(
            R"({"schema_version":2,"inputs":[{"id":"bad","name":"bad","action":"bad","keyboard":[{"keys":[256]}]}]})");
        rejects(
            R"({"schema_version":2,"inputs":[{"id":"bad","name":"bad","action":"bad","keyboard":[{"keys":[13],"text":"x"}]}]})");
        mig::Motion generic;
        generic.id = generic.name = generic.action = "jump";
        mig::Step step;
        step.id = "rise";
        step.mode = mig::StepMode::Simultaneous;
        step.constraints = {{"head", 33, {4, 1}},
                            {"shoulder", 11, {4, 1}},
                            {"trigger", 12, {5, 1}, mig::ConstraintType::Trigger}};
        step.fingers = {{mig::HandSide::Right, mig::Finger::Index, mig::FingerPose::Extended}};
        generic.steps.push_back(step);
        generic.mirror = true;
        mig::Configuration modern{{generic}};
        modern.controls.restart = {mig::Gesture::Thumb, mig::HandSide::Left};
        modern.track_hands = true;
        mig::save_configuration(modern, path);
        if (mig::load_configuration(path) != modern) {
            throw std::runtime_error("Generic multi-landmark/finger/control roundtrip failed");
        }
        const auto invalid = [&](mig::Configuration candidate) {
            try {
                mig::save_configuration(candidate, path);
            } catch (const std::exception&) {
                return;
            }
            throw std::runtime_error("Invalid generic configuration accepted");
        };
        auto invalid_cooldown = modern;
        invalid_cooldown.motions[0].cooldown_ms = -1;
        invalid(invalid_cooldown);
        invalid_cooldown.motions[0].cooldown_ms = 10001;
        invalid(invalid_cooldown);
        auto wrong = modern;
        for (int field = 0; field < 6; ++field) {
            auto candidate = modern;
            auto& input = candidate.motions[0];
            auto& constraint = input.steps[0].constraints[0];
            std::string* values[] = {&input.id,          &input.name,    &input.action,
                                     &input.steps[0].id, &constraint.id, &constraint.tolerance_for};
            values[field]->push_back('\0');
            bool rejected = false;
            try {
                mig::Engine engine(candidate);
            } catch (const std::exception&) {
                rejected = true;
            }
            if (!rejected) {
                throw std::runtime_error("C++ profile text containing NUL accepted");
            }
            invalid(candidate);
        }
        wrong.motions[0].keyboard = {{mig::KeyboardActionType::Chord, {17, 17}, {}}};
        invalid(wrong);
        wrong = modern;
        wrong.motions[0].keyboard = {{mig::KeyboardActionType::Chord, {256}, {}}};
        invalid(wrong);
        wrong = modern;
        wrong.controls.record_toggle = wrong.controls.restart;
        invalid(wrong);
        wrong = modern;
        wrong.motions[0].steps[0].constraints[0].cell.x = mig::Grid::max_cell;
        invalid(wrong);
        wrong = modern;
        wrong.motions[0].steps[0].constraints[0].landmark = 99;
        invalid(wrong);
        wrong = modern;
        wrong.motions[0].steps[0].constraints[0].priority = mig::Priority::Low;
        wrong.motions[0].steps[0].constraints[0].tolerance_for = "missing";
        invalid(wrong);
        wrong = modern;
        wrong.controls.post_gesture_delay_ms = 999;
        invalid(wrong);
        mig::save_configuration({}, path);
        if (!mig::load_configuration(path).motions.empty()) {
            throw std::runtime_error("New empty document roundtrip failed");
        }
        std::filesystem::remove(path);
        std::cout << "Configuration roundtrip, replacement and validation passed\n";
        return 0;
    } catch (const std::exception& e) {
        std::cerr << e.what() << '\n';
        return 1;
    }
}
