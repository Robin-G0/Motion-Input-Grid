#include "app.hpp"

namespace mig::app {
void App::message(std::string value) {
    std::lock_guard lock(state_mutex);
    status = std::move(value);
    log.push_back(status);
    ++log_version;
    if (log.size() > 256) {
        log.pop_front();
    }
}

void App::stop() {
    wake_and_stop_workers();
    if (camera) {
        camera->shutdown(); // Cancel the asynchronous sample wait before joining.
    }
    if (capture_thread.joinable()) {
        capture_thread.join();
    }
    if (inference_thread.joinable()) {
        inference_thread.join();
    }
    camera.reset();
    {
        std::lock_guard lock(capture_mutex);
        latest.reset();
        latest_sequence = 0;
    }
    {
        std::lock_guard lock(state_mutex);
        snapshot.reset();
        pending_events.clear();
        triggered_inputs.clear();
    }
    release_keys();
    message("Camera stopped. All outputs released.");
}

void App::wake_and_stop_workers() {
    {
        std::lock_guard lock(capture_mutex);
        running = false;
    }
    capture_ready.notify_all();
}

void App::set_preview_hands(bool enabled) {
#ifndef MIG_NATIVE_HANDS
    if (enabled) {
        throw std::runtime_error(
            "This build has no hand inference; use the hands-enabled binaries.");
    }
#endif
    release_keys();
    {
        std::lock_guard lock(state_mutex);
        config.track_hands = enabled;
        ++profile_revision;
        pending_events.clear();
        snapshot.reset();
    }
    for (auto parent : {window, edit_window}) {
        if (parent) {
            SetDlgItemTextW(parent, TrackHands, enabled ? L"Hands: On" : L"Hands: Off");
        }
    }
}

App::~App() {
    stop();
    if (font) {
        DeleteObject(font);
    }
    if (mono_font) {
        DeleteObject(mono_font);
    }
    if (heading_font) {
        DeleteObject(heading_font);
    }
    if (background_brush) {
        DeleteObject(background_brush);
    }
    if (surface_brush) {
        DeleteObject(surface_brush);
    }
}

void App::start() {
    stop();
    try {
        camera = std::make_unique<Camera>(camera_index);
    } catch (const std::exception& e) {
        message(e.what());
        return;
    }
    running = true;
    message("Loading native MediaPipe model...");
    try {
        capture_thread = std::jthread(&App::capture_loop, this);
        inference_thread = std::jthread(&App::inference_loop, this);
    } catch (...) {
        stop();
        throw;
    }
}
} // namespace mig::app
