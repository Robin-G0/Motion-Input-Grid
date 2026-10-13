#include "controller_window.hpp"
#include "theme.hpp"
#include <QAction>
#include <QEvent>
#include <QGroupBox>
#include <QHBoxLayout>
#include <QLabel>
#include <QMenuBar>
#include <QPushButton>
#include <QStatusBar>
#include <QVBoxLayout>

namespace mig::linux_ui {
ControllerWindow::ControllerWindow(std::string runtime, unsigned camera, bool diagnostic)
    : profiles_(diagnostic ? std::filesystem::temp_directory_path() / "mig-controller-ui-unused"
                           : controller::user_directory()),
      runtime_(std::move(runtime)), camera_(camera) {
    setWindowTitle("MIG Input — Motion Input Grid");
    resize(560, 680);
    auto* center = new QWidget(this);
    auto* layout = new QHBoxLayout(center);
    canvas_ = new Canvas(center);
    canvas_->read_only = true;
    canvas_->full_grid = false;
    canvas_->show_grid = false;
    canvas_->show_dots = false;
    canvas_->show_hands = false;
    canvas_->hide();
    layout->addWidget(canvas_, 1);
    panel_ = new QWidget(center);
    layout->addWidget(panel_);
    setCentralWidget(center);
    build_controls();
    build_views();
    compact_panel_ = new QWidget(center);
    auto* compact_layout = new QHBoxLayout(compact_panel_);
    compact_label_ = new QLabel(compact_panel_);
    compact_label_->setTextFormat(Qt::PlainText);
    compact_label_->setWordWrap(true);
    compact_label_->setMaximumWidth(240);
    compact_layout->addWidget(compact_label_);
    auto* open = new QPushButton("Open", compact_panel_);
    compact_layout->addWidget(open);
    connect(open, &QPushButton::clicked, this, [this] { set_compact(false); });
    layout->addWidget(compact_panel_);
    compact_panel_->hide();
    capture_.preview_enabled = false;
    apply_theme(true);
    connect(&timer_, &QTimer::timeout, this, [this] { tick(); });
    timer_.start(16);
    report("Import a profile, then Start. Keyboard output starts disabled.");
    if (!diagnostic) {
        restore_profiles();
    }
}
ControllerWindow::~ControllerWindow() {
    stop();
}
void ControllerWindow::report(const QString& message) {
    statusBar()->showMessage(message);
}
void ControllerWindow::build_controls() {
    auto* layout = new QVBoxLayout(panel_);
    layout->setContentsMargins(16, 16, 16, 16);
    layout->setSpacing(12);
    auto* heading = new QLabel("MIG Input", panel_);
    heading->setProperty("role", "heading");
    layout->addWidget(heading);
    auto* hint = new QLabel("Run your movements. Keep the controls close.", panel_);
    hint->setProperty("role", "hint");
    hint->setWordWrap(true);
    layout->addWidget(hint);
    layout->addWidget(new QLabel("Profile", panel_));
    profile_list_ = new QComboBox(panel_);
    layout->addWidget(profile_list_);
    connect(profile_list_, &QComboBox::currentIndexChanged, this, [this](int index) {
        if (index < 0) {
            return;
        }
        try {
            activate_profile(std::size_t(index));
        } catch (const std::exception& error) {
            refresh_profiles();
            report(error.what());
        }
    });
    auto* manage = new QPushButton("Manage profile", panel_);
    manage->setCheckable(true);
    layout->addWidget(manage);
    auto* profile_tools = new QGroupBox("Profile files", panel_);
    profile_tools->setObjectName("profile-tools");
    auto* profile_layout = new QHBoxLayout(profile_tools);
    layout->addWidget(profile_tools);
    profile_tools->hide();
    connect(manage, &QPushButton::toggled, profile_tools, &QWidget::setVisible);
    const auto button = [&](const char* name, auto callback) {
        auto* item = new QPushButton(name, panel_);
        profile_layout->addWidget(item);
        connect(item, &QPushButton::clicked, this, callback);
    };
    button("Import…", [this] { import_file(); });
    button("Export…", [this] { export_file(); });
    button("Rename…", [this] { rename_profile(); });
    auto* session = new QGroupBox("Session", panel_);
    layout->addWidget(session);
    auto* session_layout = new QVBoxLayout(session);
    auto* controls = new QHBoxLayout;
    session_layout->addLayout(controls);
    const auto command = [&](const char* name, auto callback) {
        auto* item = new QPushButton(name, panel_);
        controls->addWidget(item);
        connect(item, &QPushButton::clicked, this, callback);
        return item;
    };
    command("Start", [this] { start(); })->setProperty("role", "primary");
    command("Stop", [this] { stop(); });
    command("Recalibrate", [this] {
        if (running_) {
            start();
        }
    });
    keyboard_switch_ = new QCheckBox("Keyboard output (X11)", panel_);
    keyboard_switch_->setEnabled(keyboard_.available());
    keyboard_switch_->setToolTip("Sends bindings to the focused application. Requires X11.");
    session_layout->addWidget(keyboard_switch_);
    connect(keyboard_switch_, &QCheckBox::toggled, this, [this] { release_keys(); });
    auto* bindings_hint = new QLabel(
        "Movements / live feedback\nUse View → Verify bindings to inspect a movement.", panel_);
    bindings_hint->setWordWrap(true);
    bindings_hint->setProperty("role", "hint");
    layout->addWidget(bindings_hint);
    bindings_ = new QListWidget(panel_);
    bindings_->setWordWrap(true);
    bindings_->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    layout->addWidget(bindings_, 1);
    connect(bindings_, &QListWidget::currentRowChanged, this,
            [this](int index) { select_binding(index); });
}
void ControllerWindow::build_views() {
    auto* view = menuBar()->addMenu("View");
    camera_action_ = view->addAction("Camera preview");
    camera_action_->setCheckable(true);
    connect(camera_action_, &QAction::toggled, this, [this](bool enabled) { set_camera(enabled); });
    const auto toggle = [&](const char* label, bool& value) {
        auto* action = view->addAction(label);
        action->setCheckable(true);
        connect(action, &QAction::toggled, this, [this, &value](bool enabled) {
            value = enabled;
            canvas_->update();
        });
    };
    toggle("Grid", canvas_->show_grid);
    toggle("Hand detections", canvas_->show_hands);
    toggle("Body dots", canvas_->show_dots);
    verification_action_ = view->addAction("Verify bindings (keyboard paused)");
    verification_action_->setCheckable(true);
    connect(verification_action_, &QAction::toggled, this,
            [this](bool enabled) { set_verification(enabled); });
    view->addAction("Compact background window", this, [this] { set_compact(true); });
    auto* theme = view->addAction("Dark mode");
    theme->setCheckable(true);
    theme->setChecked(true);
    connect(theme, &QAction::toggled, this, [this](bool enabled) { apply_theme(enabled); });
}
void ControllerWindow::set_camera(bool enabled) {
    canvas_->setVisible(enabled && !compact_);
    capture_.preview_enabled = enabled && !compact_ && !isMinimized();
    centralWidget()->layout()->activate();
    layout()->activate();
    if (!compact_) {
        resize(enabled ? QSize(1100, 760) : QSize(560, 680));
    }
}
void ControllerWindow::set_compact(bool enabled) {
    if (enabled == compact_) {
        return;
    }
    if (enabled) {
        expanded_size_ = size();
    }
    compact_ = enabled;
    const auto state = verification_ ? " / Verification: keyboard paused"
                       : running_    ? " / Running"
                                     : " / Stopped";
    compact_label_->setText(profile_list_->currentText() + state);
    panel_->setVisible(!enabled);
    menuBar()->setVisible(!enabled);
    compact_panel_->setVisible(enabled);
    canvas_->setVisible(!enabled && camera_action_->isChecked());
    capture_.preview_enabled = !enabled && camera_action_->isChecked() && !isMinimized();
    centralWidget()->layout()->activate();
    layout()->activate();
    resize(enabled ? QSize(400, 100) : expanded_size_);
}
void ControllerWindow::set_verification(bool enabled) {
    verification_ = enabled;
    release_keys();
    if (enabled) {
        camera_action_->setChecked(true);
    }
    select_binding(bindings_->currentRow());
    report(enabled ? "Verification: select a binding; white regions react. Keyboard is paused."
                   : "Verification ended. Keyboard setting is restored.");
}
void ControllerWindow::select_binding(int index) {
    canvas_->motion = verification_ && index >= 0 && std::size_t(index) < config_.motions.size()
                          ? &config_.motions[index]
                          : nullptr;
    capture_.verification = canvas_->motion ? index : -1;
    canvas_->snapshot.progress = {};
    canvas_->snapshot.mirrored_progress = {};
    canvas_->update();
}
void ControllerWindow::changeEvent(QEvent* event) {
    QMainWindow::changeEvent(event);
    if (event->type() == QEvent::WindowStateChange) {
        capture_.preview_enabled = camera_action_->isChecked() && !compact_ && !isMinimized();
    }
}
void ControllerWindow::apply_theme(bool dark) {
    apply_widget_theme(*this, dark);
}
} // namespace mig::linux_ui
