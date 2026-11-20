#pragma once
#include "../apps/action_output.hpp"
#include "../controller/profiles.hpp"
#include "canvas.hpp"
#include "keyboard.hpp"
#include <QActionGroup>
#include <QCheckBox>
#include <QComboBox>
#include <QLabel>
#include <QListWidget>
#include <QMainWindow>
#include <QTimer>

namespace mig::linux_ui {
class ControllerWindow : public QMainWindow {
public:
    ControllerWindow(std::string runtime, unsigned camera, bool diagnostic = false);
    ~ControllerWindow();
    void load(const std::string& path);
    // Remembers the choice and restarts a running session with the new model.
    void set_pose_model(native::PoseModel model);
#ifdef MIG_APP_TESTS
    bool ui_test();
#endif

protected:
    void changeEvent(QEvent* event) override;

private:
    void build_controls();
    void build_views();
    void restore_profiles();
    void refresh_profiles();
    void refresh_bindings();
    void activate_profile(std::size_t index);
    void select_binding(int index);
    void import_file();
    void export_file();
    void rename_profile();
    void set_camera(bool enabled);
    void set_compact(bool enabled);
    void set_verification(bool enabled);
    void apply_theme(bool dark);
    void start();
    void stop();
    void tick();
    void release_keys();
    void report(const QString& message);
    controller::Profiles profiles_;
    Configuration config_;
    Capture capture_;
    Keyboard keyboard_;
    ui::ActionOutput output_;
    QTimer timer_;
    Canvas* canvas_{};
    QWidget* panel_{};
    QWidget* compact_panel_{};
    QLabel* compact_label_{};
    QComboBox* profile_list_{};
    QListWidget* bindings_{};
    QCheckBox* keyboard_switch_{};
    QAction* camera_action_{};
    QAction* verification_action_{};
    QActionGroup* pose_model_actions_{};
    std::string runtime_;
    unsigned camera_{};
    native::PoseModel pose_model_{native::PoseModel::Lite};
    bool running_{}, compact_{}, verification_{}, dialog_open_{};
    QSize expanded_size_;
    std::array<bool, 64> active_{};
    std::array<std::int64_t, 64> flashed_{};
    std::int64_t last_frame_{};
};
} // namespace mig::linux_ui
