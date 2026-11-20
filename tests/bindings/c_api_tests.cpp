#include <cstdlib>
#include <cstring>
#include <iostream>
#include <limits>
#include <mig/c/api.h>
#include <vector>

void check(bool condition, const char* message) {
    if (!condition) {
        std::cerr << message << '\n';
        std::exit(1);
    }
}
int main() {
    check(mig_abi_version() == 1 && mig_packet_size() == sizeof(mig_packet), "ABI mismatch");
    check(!mig_create("{}"), "Invalid profile accepted");
    check(std::strlen(mig_last_error()) > 0, "Missing native error");
    auto* tracker = mig_create("{\"schema_version\":2,\"inputs\":[]}");
    check(tracker, "Empty profile rejected");
    const uint8_t* pixels = reinterpret_cast<const uint8_t*>(1);
    unsigned width = 1, height = 1;
    check(!mig_camera_image(tracker, &pixels, &width, &height) && !pixels && !width && !height,
          "Preview available without camera");
    check(!mig_camera_image(nullptr, nullptr, &width, &height), "Invalid preview query");
    check(mig_camera_start_model(tracker, "missing-runtime", 0, "unknown") == -1 &&
              std::strlen(mig_last_error()) > 0,
          "Unknown pose model name accepted");
    check(mig_camera_start_model(nullptr, "missing-runtime", 0, "lite") == -1,
          "Null tracker accepted for model capture");
    mig_camera_stop(tracker);
    const auto size = mig_export(tracker, nullptr, 0);
    std::vector<char> original(size), after(size);
    check(mig_export(tracker, original.data(), size) == size, "Export failed");
    check(mig_load(tracker, "{}") == -1, "Import accepted invalid JSON");
    mig_export(tracker, after.data(), size);
    check(original == after, "Failed import changed profile");
    mig_packet packet{};
    packet.timestamp_ms = 20;
    packet.sequence = 1;
    packet.aspect = 1;
    packet.body[15 * 8] = .3f;
    packet.body[15 * 8 + 1] = .4f;
    packet.body[15 * 8 + 2] = -.1f;
    packet.body[15 * 8 + 3] = 1;
    check(mig_update(tracker, &packet) == 0, "Valid packet failed");
    float point[4]{};
    check(mig_coordinate(tracker, 15, 0, point) == 1 && point[0] == .3f, "XYZ missing");
    check(mig_coordinate(tracker, 15, 1, point) == 0, "World data invented");
    check(mig_coordinate(tracker, 99, 0, point) == 0, "Invalid index accepted");
    packet.aspect = std::numeric_limits<float>::quiet_NaN();
    check(mig_update(tracker, &packet) == -1, "Invalid metadata accepted");
    check(mig_coordinate(tracker, 15, 0, point) == 0, "Invalid frame retained coordinates");
    check(!mig_event_action(tracker, 999), "Invalid event index accepted");
    mig_destroy(tracker);
    mig_destroy(nullptr);
}
