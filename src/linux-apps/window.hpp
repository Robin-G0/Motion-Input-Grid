#pragma once
#include "../apps/action_output.hpp"
#include "canvas.hpp"
#include "keyboard.hpp"
#include <QCheckBox>
#include <QListWidget>
#include <QMainWindow>
#include <QPlainTextEdit>
#include <QTimer>
namespace mig::linux_ui {
class Window : public QMainWindow {
public:
    Window(std::string runtime, unsigned camera);
    ~Window();
#ifdef MIG_APP_TESTS
    bool ui_test();
#endif
    void load(const std::string& path);

private:
    void build_menus();
    void build_sidebar();
    void refresh_inputs();
    void select_input(int index);
    void edit_settings();
    void edit_json();
    void start();
    void stop();
    void tick();
    void apply_theme(bool dark);
    void report(const QString& message);
    Configuration config_;
    Canvas* canvas_{};
    QListWidget* inputs_{};
    QPlainTextEdit* logs_{};
    QDockWidget* log_dock_{};
    QCheckBox* keyboard_switch_{};
    QWidget* drawing_panel_{};
    QWidget* interaction_controls_{};
    QWidget* order_controls_{};
    Capture capture_;
    Keyboard keyboard_;
    ui::ActionOutput output_;
    QTimer timer_;
    std::string runtime_;
    unsigned camera_{};
    bool running_{}, dark_{true};
    std::array<bool, 64> active_{};
    std::array<std::int64_t, 64> flashed_{};
    std::int64_t last_frame_{};
};
} // namespace mig::linux_ui
