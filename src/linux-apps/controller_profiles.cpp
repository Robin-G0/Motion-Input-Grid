#include "../apps/authoring.hpp"
#include "controller_window.hpp"
#include "import_review.hpp"
#include "pose_models.hpp"
#include <QFileDialog>
#include <QInputDialog>
#include <QSignalBlocker>

namespace mig::linux_ui {
namespace {
class PauseOutput {
public:
    explicit PauseOutput(bool& paused) : paused_(paused) {
        paused_ = true;
    }
    ~PauseOutput() {
        paused_ = false;
    }

private:
    bool& paused_;
};
void validate_profile(const Configuration& profile) {
    Engine engine(profile);
#ifndef MIG_NATIVE_HANDS
    if (profile.track_hands) {
        throw std::runtime_error("This profile needs the hands-enabled controller.");
    }
#endif
}
} // namespace
void ControllerWindow::restore_profiles() {
    try {
        profiles_.restore();
        if (const auto remembered = native::parse_pose_model(profiles_.pose_model())) {
            pose_model_ = *remembered;
            check_pose_model(pose_model_actions_, pose_model_);
        }
        if (profiles_.selected() >= 0) {
            auto proposed = profiles_.load(std::size_t(profiles_.selected()));
            validate_profile(proposed);
            config_ = std::move(proposed);
        }
        refresh_profiles();
        refresh_bindings();
    } catch (const std::exception& error) {
        refresh_profiles();
        report(error.what());
    }
}
void ControllerWindow::refresh_profiles() {
    const QSignalBlocker blocker(profile_list_);
    profile_list_->clear();
    for (const auto& profile : profiles_.entries()) {
        profile_list_->addItem(QString::fromStdString(profile.name));
    }
    profile_list_->setCurrentIndex(profiles_.selected());
}
void ControllerWindow::refresh_bindings() {
    canvas_->motion = nullptr;
    bindings_->clear();
    for (const auto& input : config_.motions) {
        const auto name = input.name.empty() ? input.id : input.name;
        const auto keys = ui::binding_label(input.keyboard);
        bindings_->addItem(
            QString::fromStdString(name + "\n" + ui::binding_summary(input) + "\nKeys: " + keys));
    }
    if (!config_.motions.empty()) {
        bindings_->setCurrentRow(0);
    }
    select_binding(bindings_->currentRow());
}
void ControllerWindow::activate_profile(std::size_t index) {
    auto proposed = profiles_.load(index);
    validate_profile(proposed);
    profiles_.select(index);
    const bool restart = running_;
    stop();
    config_ = std::move(proposed);
    refresh_profiles();
    refresh_bindings();
    if (restart) {
        start();
    }
    report("Profile selected. Camera and keyboard settings are kept.");
}
void ControllerWindow::load(const std::string& path) {
    const std::filesystem::path source(path);
    const auto proposed = load_configuration(source);
    validate_profile(proposed);
    const auto utf8_name = source.stem().u8string();
    keyboard_switch_->setChecked(false);
    release_keys();
    if (!review_import(this, proposed)) {
        return;
    }
    const std::string name(utf8_name.begin(), utf8_name.end());
    const auto index = profiles_.import(proposed, name);
    activate_profile(index);
}
void ControllerWindow::import_file() {
    PauseOutput pause(dialog_open_);
    release_keys();
    const auto path = QFileDialog::getOpenFileName(this, "Import profile", {}, "JSON (*.json)");
    if (path.isEmpty()) {
        return;
    }
    try {
        load(path.toStdString());
    } catch (const std::exception& error) {
        report(error.what());
    }
}
void ControllerWindow::export_file() {
    if (profiles_.selected() < 0) {
        report("Import a profile first.");
        return;
    }
    PauseOutput pause(dialog_open_);
    release_keys();
    const auto path = QFileDialog::getSaveFileName(this, "Export profile", {}, "JSON (*.json)");
    if (path.isEmpty()) {
        return;
    }
    try {
        profiles_.export_file(std::size_t(profiles_.selected()), path.toStdString());
        report("Profile exported.");
    } catch (const std::exception& error) {
        report(error.what());
    }
}
void ControllerWindow::rename_profile() {
    if (profiles_.selected() < 0) {
        return;
    }
    PauseOutput pause(dialog_open_);
    release_keys();
    bool accepted = false;
    const auto name = QInputDialog::getText(this, "Rename profile", "Name", QLineEdit::Normal,
                                            profile_list_->currentText(), &accepted);
    if (!accepted) {
        return;
    }
    try {
        profiles_.rename(std::size_t(profiles_.selected()), name.toStdString());
        refresh_profiles();
    } catch (const std::exception& error) {
        report(error.what());
    }
}
} // namespace mig::linux_ui
