#include "pose.hpp"
#include "observations.hpp"
#ifdef _WIN32
#include <windows.h>
#else
#include <dlfcn.h>
#endif
#define MP_EXPORT
#include <mediapipe/tasks/c/vision/pose_landmarker/pose_landmarker.h>
#ifdef MIG_NATIVE_HANDS
#include <mediapipe/tasks/c/vision/hand_landmarker/hand_landmarker.h>
#include <mig/hands/fingers.hpp>
#endif
#include <algorithm>
#include <cstring>
#include <stdexcept>

namespace mig::native {
namespace {
auto options_host_system() {
#ifdef _WIN32
    return HOST_SYSTEM_WINDOWS;
#else
    return HOST_SYSTEM_LINUX;
#endif
}
std::string utf8_path(const std::filesystem::path& path) {
    const auto text = path.u8string();
    return {reinterpret_cast<const char*>(text.data()), text.size()};
}
} // namespace
struct Pose::Impl {
    std::filesystem::path directory;
#ifdef _WIN32
    HMODULE module{};
#else
    void* module{};
#endif
    PoseModel model{};
    MpPoseLandmarkerPtr handle{};
    decltype(&MpPoseLandmarkerCreate) create{};
    decltype(&MpPoseLandmarkerClose) close{};
    decltype(&MpPoseLandmarkerDetectForVideo) detect{};
    decltype(&MpPoseLandmarkerCloseResult) close_result{};
    decltype(&MpImageCreateFromUint8Data) image_create{};
    decltype(&MpImageFree) image_free{};
#ifdef MIG_NATIVE_HANDS
    MpHandLandmarkerPtr hand_handle{};
    decltype(&MpHandLandmarkerCreate) hand_create{};
    decltype(&MpHandLandmarkerClose) hand_close{};
    decltype(&MpHandLandmarkerDetectForVideo) hand_detect{};
    decltype(&MpHandLandmarkerCloseResult) hand_close_result{};
    hands::Frame hands{};
#endif
    ~Impl() {
#ifdef MIG_NATIVE_HANDS
        if (hand_handle && hand_close) {
            hand_close(hand_handle, nullptr);
        }
#endif
        if (handle && close) {
            close(handle, nullptr);
        }
        if (module) {
#ifdef _WIN32
            FreeLibrary(module);
#else
            dlclose(module);
#endif
        }
    }
    template <class T> void symbol(T& target, const char* name) {
#ifdef _WIN32
        target = reinterpret_cast<T>(GetProcAddress(module, name));
#else
        target = reinterpret_cast<T>(dlsym(module, name));
#endif
        if (!target) {
            throw std::runtime_error(std::string("Missing MediaPipe function: ") + name);
        }
    }
};
Pose::Pose(const std::filesystem::path& dir, bool enable_hands, PoseModel model_variant)
    : impl_(std::make_unique<Impl>()) {
#ifndef MIG_NATIVE_HANDS
    if (enable_hands) {
        throw std::runtime_error("Hand tracking was disabled at build time");
    }
#endif
    impl_->directory = std::filesystem::absolute(dir);
#ifdef _WIN32
    const auto dll = impl_->directory / "libmediapipe.dll";
    impl_->module = LoadLibraryExW(dll.c_str(), nullptr,
                                   LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_SYSTEM32);
    if (!impl_->module) {
        throw std::runtime_error("Cannot load native MediaPipe DLL (Windows error " +
                                 std::to_string(GetLastError()) + ")");
    }
#else
    const auto shared_library = impl_->directory / "libmediapipe.so";
    impl_->module = dlopen(shared_library.c_str(), RTLD_NOW | RTLD_LOCAL);
    if (!impl_->module) {
        throw std::runtime_error(std::string("Cannot load MediaPipe: ") + dlerror());
    }
#endif
    impl_->symbol(impl_->create, "MpPoseLandmarkerCreate");
    impl_->symbol(impl_->close, "MpPoseLandmarkerClose");
    impl_->symbol(impl_->detect, "MpPoseLandmarkerDetectForVideo");
    impl_->symbol(impl_->close_result, "MpPoseLandmarkerCloseResult");
    impl_->symbol(impl_->image_create, "MpImageCreateFromUint8Data");
    impl_->symbol(impl_->image_free, "MpImageFree");
    const auto& info = pose_model_info(model_variant);
    const auto model_file = locate_pose_model(impl_->directory, model_variant);
    if (model_file.empty()) {
        throw std::runtime_error(std::string(info.label) +
                                 " pose model is not installed: download it or choose another");
    }
    verify_model_file(model_file, info.asset);
    impl_->model = model_variant;
    const auto model = utf8_path(model_file);
    PoseLandmarkerOptions options{};
    options.base_options.model_asset_path = model.c_str();
    options.base_options.delegate = CPU;
    options.base_options.host_environment = HOST_ENVIRONMENT_UNKNOWN;
#ifdef _WIN32
    options.base_options.host_system = HOST_SYSTEM_WINDOWS;
#else
    options.base_options.host_system = HOST_SYSTEM_LINUX;
#endif
    options.running_mode = VIDEO;
    options.num_poses = 1;
    const auto status = impl_->create(&options, &impl_->handle, nullptr);
    if (status != kMpOk || !impl_->handle) {
        throw std::runtime_error("MediaPipe model creation failed, status " +
                                 std::to_string(status));
    }
    set_hands_enabled(enable_hands);
}

void Pose::set_hands_enabled(bool enabled) {
#ifdef MIG_NATIVE_HANDS
    if (enabled == (impl_->hand_handle != nullptr)) {
        return;
    }
    impl_->hands = {};
    if (!enabled) {
        impl_->hand_close(impl_->hand_handle, nullptr);
        impl_->hand_handle = nullptr;
        return;
    }
    {
        impl_->symbol(impl_->hand_create, "MpHandLandmarkerCreate");
        impl_->symbol(impl_->hand_close, "MpHandLandmarkerClose");
        impl_->symbol(impl_->hand_detect, "MpHandLandmarkerDetectForVideo");
        impl_->symbol(impl_->hand_close_result, "MpHandLandmarkerCloseResult");
        const auto hand_file = impl_->directory / "models" / hand_model.file;
        verify_model_file(hand_file, hand_model);
        const auto hand_path = utf8_path(hand_file);
        HandLandmarkerOptions hand_options{};
        hand_options.base_options.delegate = CPU;
        hand_options.base_options.host_environment = HOST_ENVIRONMENT_UNKNOWN;
        hand_options.base_options.host_system = options_host_system();
        hand_options.base_options.model_asset_path = hand_path.c_str();
        hand_options.running_mode = VIDEO;
        hand_options.num_hands = 2;
        MpHandLandmarkerPtr new_handle{};
        const auto hand_status = impl_->hand_create(&hand_options, &new_handle, nullptr);
        if (hand_status != kMpOk || !new_handle) {
            if (new_handle) {
                impl_->hand_close(new_handle, nullptr);
            }
            throw std::runtime_error("MediaPipe hand model creation failed, status " +
                                     std::to_string(hand_status));
        }
        impl_->hand_handle = new_handle;
    }
#else
    if (enabled) {
        throw std::runtime_error("Hand tracking was disabled at build time");
    }
#endif
}
PoseModel Pose::model() const noexcept {
    return impl_->model;
}
bool Pose::hands_enabled() const noexcept {
#ifdef MIG_NATIVE_HANDS
    return impl_->hand_handle != nullptr;
#else
    return false;
#endif
}
Pose::~Pose() = default;
#ifdef MIG_NATIVE_HANDS
const hands::Frame& Pose::hand_frame() const noexcept {
    return impl_->hands;
}
#endif
Frame Pose::infer(std::span<const std::uint8_t> rgb, int w, int h, std::int64_t t,
                  std::uint64_t sequence) {
    if (w <= 0 || h <= 0 || w > 4096 || h > 4096 || rgb.size() != std::size_t(w) * h * 3) {
        throw std::runtime_error("Invalid RGB buffer");
    }
#ifdef MIG_NATIVE_HANDS
    impl_->hands = {}; // Never retain landmarks from a lost hand or failed inference.
    impl_->hands.timestamp_ms = t;
    impl_->hands.sequence = sequence;
    impl_->hands.aspect = float(w) / h;
#endif
    MpImagePtr image{};
    struct ImageGuard {
        Impl* impl;
        MpImagePtr& image;
        ~ImageGuard() {
            if (image) {
                impl->image_free(image);
            }
        }
    } guard{impl_.get(), image};
    const auto status = impl_->image_create(kMpImageFormatSrgb, w, h, rgb.data(),
                                            static_cast<int>(rgb.size()), &image, nullptr);
    if (status != kMpOk || !image) {
        throw std::runtime_error("MediaPipe image creation failed");
    }
    PoseLandmarkerResult result{};
    struct ResultGuard {
        Impl* impl;
        PoseLandmarkerResult* result;
        ~ResultGuard() {
            impl->close_result(result);
        }
    } cleanup{impl_.get(), &result};
    const auto detected = impl_->detect(impl_->handle, image, nullptr, t, &result, nullptr);
    if (detected != kMpOk) {
        throw std::runtime_error("MediaPipe inference failed, status " + std::to_string(detected));
    }
    auto frame = detail::body_observations(result, t, sequence, float(w) / h);
#ifdef MIG_NATIVE_HANDS
    if (impl_->hand_handle) {
        HandLandmarkerResult hand_result{};
        struct HandResultGuard {
            Impl* impl;
            HandLandmarkerResult* result;
            ~HandResultGuard() {
                impl->hand_close_result(result);
            }
        } hand_cleanup{impl_.get(), &hand_result};
        const auto hand_status =
            impl_->hand_detect(impl_->hand_handle, image, nullptr, t, &hand_result, nullptr);
        if (hand_status != kMpOk) {
            throw std::runtime_error("MediaPipe hand inference failed, status " +
                                     std::to_string(hand_status));
        }
        impl_->hands = detail::hand_observations(hand_result, t, sequence, float(w) / h);
        const auto observations = hands::hand_observations(impl_->hands, frame);
        frame.fingers = observations.fingers;
        frame.hand_contacts = observations.contacts;
    }
#endif
    return frame;
}
} // namespace mig::native
