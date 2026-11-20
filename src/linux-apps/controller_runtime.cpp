#include "../apps/tracking_policy.hpp"
#include "controller_window.hpp"
#include "pose_models.hpp"
#include <QAction>

namespace mig::linux_ui {
void ControllerWindow::release_keys() {
    output_.cancel([this](int key, bool release) { return keyboard_.key(key, release); },
                   [](char16_t, bool) { return true; });
}
void ControllerWindow::start() {
    stop();
    if (config_.motions.empty()) {
        report("Import a profile before starting.");
        return;
    }
    ensure_pose_model(
        this, runtime_, pose_model_, [this](const QString& text) { report(text); },
        [this] {
            try {
                capture_.start(config_, runtime_, camera_,
                               {pose_model_, app::hand_inference_required(config_)});
                running_ = true;
                report("Starting camera; keep shoulders visible for calibration.");
            } catch (const std::exception& error) {
                report(error.what());
            }
        });
}
void ControllerWindow::stop() {
    capture_.stop();
    running_ = false;
    active_.fill(false);
    flashed_.fill(0);
    last_frame_ = 0;
    release_keys();
    canvas_->snapshot = {};
    canvas_->update();
    report("Stopped. All keys released.");
}
void ControllerWindow::tick() {
    const auto now = native::now_ms();
    const bool output_enabled = keyboard_switch_->isChecked() && !verification_ && !dialog_open_;
    Snapshot snapshot;
    if (capture_.take(snapshot)) {
        if (!snapshot.error.empty()) {
            stop();
            report(QString::fromStdString(snapshot.error));
            return;
        }
        last_frame_ = snapshot.body.timestamp_ms;
        const bool fresh = now - last_frame_ <= 250 && snapshot.grid.valid && !snapshot.paused;
        active_ = fresh ? snapshot.active : std::array<bool, 64>{};
        if (!fresh) {
            release_keys();
        }
        for (const auto& event : snapshot.events) {
            if (!fresh || now - event.timestamp_ms > 250 ||
                event.motion >= config_.motions.size()) {
                continue;
            }
            flashed_[event.motion] = now + 900;
            if (output_enabled) {
                output_.trigger(event.motion, config_.motions[event.motion], now);
            }
        }
        if (canvas_->isVisible() && !isMinimized()) {
            if (snapshot.inspected != bindings_->currentRow()) {
                snapshot.progress = {};
                snapshot.mirrored_progress = {};
            }
            canvas_->snapshot = std::move(snapshot);
            canvas_->update();
        }
    }
    if (output_enabled && running_ && now - last_frame_ <= 250) {
        if (!output_.advance(
                config_.motions, active_, now,
                [this](int key, bool release) { return keyboard_.key(key, release); },
                [this](char16_t unit, bool release) { return release || keyboard_.text(unit); })) {
            keyboard_switch_->setChecked(false);
            report("Keyboard output failed: unsupported key or text in the current X11 layout.");
        }
    } else {
        release_keys();
    }
    if (now - last_frame_ > 250) {
        active_.fill(false);
        if (!canvas_->snapshot.image.isNull()) {
            canvas_->snapshot = {};
            canvas_->update();
        }
    }
    if (compact_ || isMinimized()) {
        return;
    }
    for (int index = 0; index < bindings_->count(); ++index) {
        const QBrush background =
            active_[index] || flashed_[index] > now ? QColor("#267a54") : Qt::transparent;
        auto* item = bindings_->item(index);
        if (item->background() != background) {
            item->setBackground(background);
        }
    }
}
} // namespace mig::linux_ui
