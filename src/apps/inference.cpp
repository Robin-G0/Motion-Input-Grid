#include "app.hpp"
#include "model_download.hpp"
namespace mig::app {
void App::inference_loop() {
    try {
        ensure_pose_model(directory, pose_model, [this](std::string text) { message(text); });
        Pose pose(directory, false, pose_model);
        Configuration initial;
        int test_index;
        {
            std::lock_guard lock(state_mutex);
            initial = config;
            test_index = testing;
            reload = recalibrate = false;
        }
        const auto engine_profile = [](Configuration profile, int test) {
            if (test >= 0 && std::size_t(test) < profile.motions.size()) {
                auto chosen = profile.motions[test];
                profile.motions = {std::move(chosen)};
            }
            return profile;
        };
        Engine engine(engine_profile(initial, test_index));
        engine.set_test_mode(test_index >= 0);
        GestureControls controls(initial.controls);
        Recorder recorder;
        CoordinateSpace record_basis = CoordinateSpace::Calibrated;
        std::uint64_t previous{};
        std::int64_t previous_time = -1;
        while (running) {
            std::shared_ptr<const VideoFrame> frame;
            std::uint64_t sequence{};
            {
                std::unique_lock lock(capture_mutex);
                capture_ready.wait(lock, [&] { return !running || latest_sequence != previous; });
                if (!running) {
                    break;
                }
                frame = latest;
                sequence = latest_sequence;
            }
            previous = sequence;
            if (frame->capture_ms <= previous_time) {
                continue;
            }
            previous_time = frame->capture_ms;
            bool request_hands{}, record_toggle{}, allow_recording{};
            bool stopped_recording = false;
            CoordinateSpace requested_basis;
            std::vector<int> record_points;
            std::uint64_t revision{};
            {
                std::lock_guard lock(state_mutex);
                request_hands =
                    editor ? hand_tracking_requested(config) : hand_inference_required(config);
                revision = profile_revision;
                test_index = testing;
                allow_recording = recording_allowed;
                if (reload) {
                    engine = Engine(engine_profile(config, test_index));
                    engine.set_test_mode(test_index >= 0);
                    controls = GestureControls(config.controls);
                    recorder.stop();
                    stopped_recording = true;
                    reload = false;
                    pending_events.clear();
                }
                if (recalibrate || restart_requested) {
                    if (recalibrate) {
                        engine.recalibrate();
                        stopped_recording = recorder.active();
                        recorder.stop();
                    } else {
                        engine.restart();
                    }
                    controls.pause(frame->capture_ms);
                    recalibrate = restart_requested = false;
                    pending_events.clear();
                }
                record_toggle = record_requested;
                record_requested = false;
                if (allow_recording && !recorder.active()) {
                    record_points = recording_landmarks;
                }
                requested_basis = recording_space;
            }
            pose.set_hands_enabled(request_hands);
            auto result = std::make_shared<Snapshot>();
            result->video = frame;
            const auto start = now_ms();
            result->pose =
                pose.infer(frame->rgb, frame->width, frame->height, frame->capture_ms, sequence);
#ifdef MIG_NATIVE_HANDS
            result->hands = pose.hand_frame();
#endif
            result->inference_ms = float(now_ms() - start);
            result->hands_active = pose.hands_enabled();
            const bool fresh = now_ms() - result->pose.timestamp_ms <= 250;
            auto events = engine.update(result->pose, now_ms());
            const bool command_fresh = now_ms() - result->pose.timestamp_ms <= 500;
            const auto actions =
                command_fresh ? controls.update(result->pose, engine.interaction_hands()) : 0;
            if (actions & unsigned(ControlAction::Recalibrate)) {
                engine.recalibrate();
                stopped_recording = recorder.active();
                recorder.stop();
            } else if (actions & unsigned(ControlAction::Restart)) {
                engine.restart();
            }
            record_toggle = record_toggle || (actions & unsigned(ControlAction::RecordToggle));
            const bool recording_rejected =
                record_toggle && allow_recording && !recorder.active() && record_points.empty();
            if (record_toggle && allow_recording && !recording_rejected) {
                if (recorder.active()) {
                    recorder.stop();
                    stopped_recording = true;
                } else {
                    record_basis = requested_basis;
                    recorder.begin(record_points);
                }
                controls.pause(frame->capture_ms);
                engine.restart();
            }
            if (!allow_recording && recorder.active()) {
                recorder.stop();
                stopped_recording = true;
            }
            // During recovery keep calibration live, but discard all recognition state/events.
            result->waiting = controls.suppressed(frame->capture_ms);
            if (result->waiting) {
                engine.restart();
                events = {};
            }
            result->grid = engine.grid();
            result->reference_grid = engine.reference_grid();
            for (std::size_t index = 0; index < engine.configuration().motions.size(); ++index) {
                result->actions_active[index] = engine.action_active(index);
            }
            int inspected = test_index >= 0 ? 0 : -1;
            if constexpr (!editor) {
                std::lock_guard lock(state_mutex);
                inspected = verification;
            }
            if (inspected >= 0 && std::size_t(inspected) < engine.configuration().motions.size()) {
                result->inspected = inspected;
                result->progress = engine.progress(std::size_t(inspected));
                result->mirrored_progress = engine.progress(std::size_t(inspected), true);
            }
            const bool was_recording = recorder.active();
            if (!result->waiting) {
                recorder.sample(result->pose, record_basis == CoordinateSpace::Body
                                                  ? result->grid
                                                  : result->reference_grid);
            }
            stopped_recording = stopped_recording || (was_recording && !recorder.active());
            result->recording = recorder.active();
            {
                std::lock_guard lock(state_mutex);
                if (revision != profile_revision || reload || recalibrate || restart_requested ||
                    request_hands != (editor ? hand_tracking_requested(config)
                                             : hand_inference_required(config))) {
                    continue;
                }
                snapshot = result;
                if (stopped_recording) {
                    reviewed_recording = recorder;
                }
                if (result->waiting) {
                    pending_events.clear();
                    status = "Waiting 1 second after command.";
                } else {
                    status =
                        result->grid.valid
                            ? (test_index >= 0 ? "Test ready. Restart clears progress; Recalibrate "
                                                 "replaces the body anchor."
                                               : "Tracking ready.")
                        : result->grid.calibrated
                            ? "Tracking lost / shoulders not visible"
                            : "Calibration: face the camera; keep shoulders stable for 1 second.";
                }
                if (!result->waiting && fresh) {
                    for (const auto event : events) {
                        const std::size_t index =
                            test_index >= 0 ? std::size_t(test_index) : event.motion;
                        if (test_index < 0 && pending_events.size() < 64) {
                            pending_events.push_back({index, event.timestamp_ms});
                        }
                        const auto& input = config.motions[index];
                        triggered_inputs[input.id] = now_ms();
                        log.push_back(
                            "Triggered: " + (input.action.empty() ? input.id : input.action) +
                            " [" + input.id + "]");
                        ++log_version;
                        if (log.size() > 256) {
                            log.pop_front();
                        }
                    }
                }
                if (recording_rejected) {
                    status = "Recording not started: select body parts in the Recording tab.";
                }
                if (actions) {
                    std::string commands;
                    for (const auto [action, name] :
                         {std::pair{ControlAction::Restart, "Restart"},
                          {ControlAction::Recalibrate, "Recalibrate"},
                          {ControlAction::RecordToggle, "Record toggle"}}) {
                        if (actions & unsigned(action)) {
                            if (!commands.empty()) {
                                commands += ", ";
                            }
                            commands += name;
                        }
                    }
                    if ((actions & unsigned(ControlAction::RecordToggle)) && !allow_recording) {
                        commands += " ignored: open an input editor to record";
                    } else if (recording_rejected) {
                        commands += " ignored: select recording body parts";
                    }
                    log.push_back("Hand gesture: " + commands + "; one-second recovery.");
                    ++log_version;
                    if (log.size() > 256) {
                        log.pop_front();
                    }
                }
            }
        }
    } catch (const std::exception& error) {
        message(error.what());
        wake_and_stop_workers();
    }
}
} // namespace mig::app
