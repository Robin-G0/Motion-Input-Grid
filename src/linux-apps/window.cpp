#include "window.hpp"
#include "../apps/authoring.hpp"
#include "import_review.hpp"
#include "theme.hpp"
#include <QAction>
#include <QButtonGroup>
#include <QComboBox>
#include <QDialog>
#include <QDialogButtonBox>
#include <QDockWidget>
#include <QFileDialog>
#include <QFormLayout>
#include <QGridLayout>
#include <QGroupBox>
#include <QInputDialog>
#include <QLabel>
#include <QLineEdit>
#include <QMenuBar>
#include <QMessageBox>
#include <QPushButton>
#include <QScrollArea>
#include <QSignalBlocker>
#include <QSpinBox>
#include <QSplitter>
#include <QStatusBar>
#include <QTabBar>
#include <QTabWidget>
#include <QToolBar>
#include <QVBoxLayout>
#include <mig/format/configuration.hpp>
namespace mig::linux_ui {
Window::Window(std::string runtime, unsigned camera)
    : runtime_(std::move(runtime)), camera_(camera) {
    setWindowTitle("Motion Input Grid Studio");
    resize(1200, 850);
    canvas_ = new Canvas(this);
    canvas_->failed = [this](const std::string& message) {
        report(QString::fromStdString(message));
    };

    log_dock_ = new QDockWidget("Logs", this);
    logs_ = new QPlainTextEdit(log_dock_);
    logs_->setReadOnly(true);
    logs_->setMaximumBlockCount(256);
    log_dock_->setWidget(logs_);
    log_dock_->setFeatures(QDockWidget::DockWidgetClosable | QDockWidget::DockWidgetMovable |
                           QDockWidget::DockWidgetFloatable);
    addDockWidget(Qt::BottomDockWidgetArea, log_dock_);
    log_dock_->hide();
    log_dock_->setFloating(true);
    log_dock_->resize(640, 320);
    build_sidebar();
    build_menus();
    apply_theme(true);
    connect(&timer_, &QTimer::timeout, this, [this] { tick(); });
    timer_.start(20);
    report("Draw in Full grid, edit settings, then save your profile. Camera starts explicitly.");
}
Window::~Window() {
    stop();
}
void Window::report(const QString& message) {
    statusBar()->showMessage(message);
    logs_->appendPlainText(message);
    if (test_logs_) {
        test_logs_->appendPlainText(message);
    }
}
void Window::apply_theme(bool dark) {
    dark_ = dark;
    apply_widget_theme(*this, dark);
}
void Window::build_menus() {
    auto* file = menuBar()->addMenu("File");
    file->addAction("Open", this, [this] {
        const auto path = QFileDialog::getOpenFileName(this, "Open profile", {}, "JSON (*.json)");
        if (!path.isEmpty()) {
            load(path.toStdString());
        }
    });
    file->addAction("Save", this, [this] {
        if (!apply_settings()) {
            show_view(1);
            return;
        }
        stop();
        const auto path = QFileDialog::getSaveFileName(this, "Save profile", {}, "JSON (*.json)");
        if (path.isEmpty()) {
            return;
        }
        try {
            save_configuration(config_, path.toStdString());
            report("Profile saved.");
        } catch (const std::exception& error) {
            report(error.what());
        }
    });
    file->addSeparator();
    file->addAction("Complete JSON profile…", this, [this] { edit_json(); });
    auto* view = menuBar()->addMenu("View");
    const auto toggle = [&](const char* name, bool& value) {
        auto* action = view->addAction(name);
        action->setCheckable(true);
        action->setChecked(value);
        connect(action, &QAction::toggled, this, [this, &value](bool checked) {
            value = checked;
            canvas_->update();
        });
    };
    toggle("Grid", canvas_->show_grid);
    toggle("Detection dots", canvas_->show_dots);
    toggle("Full grid / camera body view", canvas_->full_grid);
    view->addAction(log_dock_->toggleViewAction());
    auto* theme = view->addAction("Dark mode");
    theme->setCheckable(true);
    theme->setChecked(true);
    connect(theme, &QAction::toggled, this, [this](bool checked) { apply_theme(checked); });
}
void Window::build_sidebar() {
    pages_ = new QStackedWidget(this);
    setCentralWidget(pages_);
    sections_ = new QTabWidget(pages_);
    sections_->setObjectName("studio-sections");
    pages_->addWidget(sections_);
    auto* movements = new QWidget(sections_);
    sections_->addTab(movements, "Movements");
    auto* edit = new QWidget(sections_);
    auto* edit_layout = new QVBoxLayout(edit);
    edit_layout->setContentsMargins(0, 0, 0, 0);
    auto* workspace = new QSplitter(Qt::Horizontal, edit);
    workspace_ = workspace;
    edit_layout->addWidget(workspace);
    sections_->addTab(edit, "Edit");
    // Test uses this same workspace and frame: no camera-dependent resizing.
    auto* test = new QWidget(sections_);
    sections_->addTab(test, "Test");
    auto* test_layout = new QVBoxLayout(test);
    test_layout->setContentsMargins(0, 0, 0, 0);
    workspace->addWidget(canvas_);
    auto* panel = new QWidget(workspace);
    panel->setMinimumWidth(420);
    panel->setMaximumWidth(480);
    workspace->addWidget(panel);
    workspace->setStretchFactor(0, 1);
    auto* inspector_layout = new QVBoxLayout(panel);
    inspector_layout->setContentsMargins(12, 12, 12, 12);
    inspector_pages_ = new QStackedWidget(panel);
    inspector_layout->addWidget(inspector_pages_);
    inspector_ = new QTabWidget(inspector_pages_);
    inspector_pages_->addWidget(inspector_);
    auto* journal = new QWidget(inspector_pages_);
    auto* journal_layout = new QVBoxLayout(journal);
    auto* journal_title = new QLabel("Actions & feedback", journal);
    journal_title->setProperty("role", "heading");
    journal_layout->addWidget(journal_title);
    auto* journal_hint =
        new QLabel("Follow the coloured zones. Testing never sends keyboard input.", journal);
    journal_hint->setWordWrap(true);
    journal_layout->addWidget(journal_hint);
    test_logs_ = new QPlainTextEdit(journal);
    test_logs_->setReadOnly(true);
    test_logs_->setMaximumBlockCount(256);
    journal_layout->addWidget(test_logs_, 1);
    auto* clear_journal = new QPushButton("Clear journal", journal);
    journal_layout->addWidget(clear_journal);
    connect(clear_journal, &QPushButton::clicked, test_logs_, &QPlainTextEdit::clear);
    inspector_pages_->addWidget(journal);
    auto* scroll = new QScrollArea(inspector_);
    scroll->setWidgetResizable(true);
    scroll->setFrameShape(QFrame::NoFrame);
    scroll->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    drawing_panel_ = new QWidget(scroll);
    drawing_panel_->setEnabled(false);
    scroll->setWidget(drawing_panel_);
    inspector_->addTab(scroll, "Zones");
    settings_panel_ = new QWidget(inspector_);
    inspector_->addTab(settings_panel_, "Movement");
    inspector_->tabBar()->hide();
    auto* context_navigation = new QHBoxLayout;
    auto* movement_settings = new QPushButton("Movement settings", panel);
    auto* back_to_zones = new QPushButton("Back to zones", panel);
    context_navigation->addWidget(movement_settings);
    context_navigation->addWidget(back_to_zones);
    inspector_layout->insertLayout(0, context_navigation);
    connect(movement_settings, &QPushButton::clicked, this, [this] { edit_settings(); });
    connect(back_to_zones, &QPushButton::clicked, this, [this] { inspector_->setCurrentIndex(0); });
    auto* form = new QFormLayout(settings_panel_);
    form->setSpacing(12);
    name_field_ = new QLineEdit(settings_panel_);
    action_field_ = new QLineEdit(settings_panel_);
    keys_field_ = new QLineEdit(settings_panel_);
    keys_field_->setPlaceholderText("Ctrl + C _ Enter");
    action_mode_field_ = new QComboBox(settings_panel_);
    for (const auto mode : action_mode_names) {
        action_mode_field_->addItem(QString::fromUtf8(mode.data(), int(mode.size())));
    }
    repeat_field_ = new QSpinBox(settings_panel_);
    repeat_field_->setRange(20, 60000);
    cooldown_field_ = new QSpinBox(settings_panel_);
    cooldown_field_->setRange(0, 10000);
    duration_field_ = new QSpinBox(settings_panel_);
    duration_field_->setRange(0, 10000);
    duration_field_->setSpecialValueText("No limit");
    space_field_ = new QComboBox(settings_panel_);
    space_field_->addItems({"Follows the body", "Initial position"});
    mirror_field_ = new QCheckBox("Accept mirrored movement", settings_panel_);
    form->addRow("Name", name_field_);
    form->addRow("Action", action_field_);
    form->addRow("Keyboard sequence", keys_field_);
    form->addRow("Action mode", action_mode_field_);
    form->addRow("Repeat interval (ms)", repeat_field_);
    form->addRow("Cooldown (ms)", cooldown_field_);
    form->addRow("Maximum duration (ms)", duration_field_);
    form->addRow("Coordinate reference", space_field_);
    form->addRow(mirror_field_);
    settings_error_ = new QLabel(settings_panel_);
    settings_error_->setWordWrap(true);
    settings_error_->setProperty("role", "error");
    form->addRow(settings_error_);
    auto* apply = new QPushButton("Apply movement", settings_panel_);
    apply->setProperty("role", "primary");
    form->addRow(apply);
    const auto show_repeat = [this, form] {
        const bool visible = action_mode_field_->currentIndex() == int(ActionMode::Repeat);
        repeat_field_->setVisible(visible);
        form->labelForField(repeat_field_)->setVisible(visible);
    };
    connect(action_mode_field_, &QComboBox::currentIndexChanged, this, show_repeat);
    connect(apply, &QPushButton::clicked, this, [this] { apply_settings(); });
    auto* session = new QToolBar("Session", this);
    session->setMovable(false);
    addToolBar(Qt::TopToolBarArea, session);
    auto* title = new QLabel("Motion Input Grid Studio", session);
    title->setProperty("role", "heading");
    session->addWidget(title);
    session->addSeparator();
    const auto command = [&](const char* name, auto callback) {
        auto* control = new QPushButton(name, session);
        session->addWidget(control);
        connect(control, &QPushButton::clicked, this, callback);
        return control;
    };
    command("Open profile", [this] {
        const auto path = QFileDialog::getOpenFileName(this, "Open profile", {}, "JSON (*.json)");
        if (!path.isEmpty()) {
            load(path.toStdString());
        }
    });
    command("Start camera", [this] { start(); })->setProperty("role", "primary");
    command("Stop camera", [this] { stop(); });
    command("Recalibrate", [this] {
        if (running_) {
            start();
        }
    });
    keyboard_switch_ = new QCheckBox("Keyboard output (X11)", session);
    keyboard_switch_->setEnabled(keyboard_.available());
    keyboard_switch_->setToolTip("Optional XTest output. Testing never sends keys.");
    session->addWidget(keyboard_switch_);
    connect(keyboard_switch_, &QCheckBox::toggled, this, [this](bool enabled) {
        if (!enabled) {
            output_.cancel([this](int key, bool release) { return keyboard_.key(key, release); },
                           [](char16_t, bool) { return true; });
        }
    });
    auto* layout = new QVBoxLayout(movements);
    layout->setContentsMargins(24, 24, 24, 24);
    layout->setSpacing(16);
    auto* heading = new QLabel("Your movements", movements);
    heading->setProperty("role", "heading");
    layout->addWidget(heading);
    auto* hint = new QLabel(
        "Create a movement or open a JSON profile. Select a card to edit its zones or test it.",
        movements);
    hint->setWordWrap(true);
    hint->setProperty("role", "hint");
    layout->addWidget(hint);
    inputs_ = new QListWidget(movements);
    layout->addWidget(inputs_, 1);
    connect(inputs_, &QListWidget::currentRowChanged, this, [this](int row) { select_input(row); });
    connect(inputs_, &QListWidget::itemClicked, this, [this] {
        inspector_->setCurrentIndex(0);
        show_view(1);
    });
    const auto button = [&](const char* name, auto callback) {
        auto* control = new QPushButton(name, panel);
        layout->addWidget(control);
        connect(control, &QPushButton::clicked, this, callback);
        return control;
    };
    button("New movement", [this] {
        stop();
        if (config_.motions.size() >= 64) {
            report("Maximum 64 movements.");
            return;
        }
        Motion input;
        unsigned number = 1;
        do {
            input.id = "input" + std::to_string(number++);
        } while (std::any_of(config_.motions.begin(), config_.motions.end(),
                             [&](const auto& item) { return item.id == input.id; }));
        input.name = "New movement";
        input.action = input.id;
        input.steps.push_back({"step1", StepMode::Ordered});
        config_.motions.push_back(input);
        refresh_inputs();
        inputs_->setCurrentRow(int(config_.motions.size() - 1));
        edit_settings();
    })->setProperty("role", "primary");
    button("Edit", [this] { show_view(1); });
    button("Test", [this] { show_view(2); });
    button("Delete movement", [this] {
        stop();
        const int row = inputs_->currentRow();
        if (row >= 0) {
            config_.motions.erase(config_.motions.begin() + row);
            refresh_inputs();
        }
    })->setProperty("role", "danger");
    connect(sections_, &QTabWidget::currentChanged, this, [this](int view) { show_view(view); });
    auto* drawing = new QVBoxLayout(drawing_panel_);
    drawing->setContentsMargins(0, 12, 0, 0);
    drawing->setSpacing(12);
    const auto section = [&](const char* name) {
        auto* group = new QGroupBox(name, drawing_panel_);
        drawing->addWidget(group);
        layout = new QVBoxLayout(group);
        layout->setSpacing(8);
        return group;
    };
    section("Current step");
    step_field_ = new QComboBox(panel);
    layout->addWidget(step_field_);
    auto* step_actions = new QHBoxLayout;
    auto* add_step = new QPushButton("Add step", panel);
    add_step->setObjectName("add-step");
    auto* delete_step = new QPushButton("Delete step", panel);
    delete_step->setProperty("role", "danger");
    step_actions->addWidget(add_step);
    step_actions->addWidget(delete_step);
    layout->addLayout(step_actions);
    step_help_ = new QLabel(panel);
    step_help_->setWordWrap(true);
    step_help_->setProperty("role", "hint");
    layout->addWidget(step_help_);
    delete_step->setObjectName("delete-step");
    step_mode_field_ = new QComboBox(panel);
    step_mode_field_->addItems({"Any order", "Simultaneous", "In order"});
    layout->addWidget(step_mode_field_);
    step_hold_field_ = new QSpinBox(panel);
    step_hold_field_->setRange(0, 1000);
    step_hold_field_->setSuffix(" ms hold");
    layout->addWidget(step_hold_field_);
    connect(step_field_, &QComboBox::currentIndexChanged, this, [this](int index) {
        if (index < 0) {
            return;
        }
        stop();
        canvas_->scope = index;
        canvas_->selection.clear();
        refresh_step();
        refresh_zone();
    });
    connect(step_mode_field_, &QComboBox::currentIndexChanged, this, [this](int mode) {
        if (!canvas_->motion || canvas_->scope <= 0) {
            return;
        }
        stop();
        auto& step = canvas_->motion->steps[canvas_->scope - 1];
        ui::set_route_mode(step, StepMode(mode));
        refresh_step();
    });
    connect(step_hold_field_, &QSpinBox::valueChanged, this, [this](int value) {
        if (!canvas_->motion || canvas_->scope <= 0) {
            return;
        }
        stop();
        canvas_->motion->steps[canvas_->scope - 1].hold_ms = value;
    });
    connect(add_step, &QPushButton::clicked, this, [this] {
        if (!canvas_->motion || canvas_->motion->steps.size() >= 64) {
            return;
        }
        stop();
        unsigned serial = unsigned(canvas_->motion->steps.size() + 1);
        std::string id;
        do {
            id = "step" + std::to_string(serial++);
        } while (std::any_of(canvas_->motion->steps.begin(), canvas_->motion->steps.end(),
                             [&](const auto& step) { return step.id == id; }));
        canvas_->motion->steps.push_back({id, StepMode::Ordered});
        canvas_->scope = int(canvas_->motion->steps.size());
        select_input(inputs_->currentRow());
    });
    connect(delete_step, &QPushButton::clicked, this, [this] {
        if (!canvas_->motion || canvas_->scope <= 0 || canvas_->motion->steps.size() <= 1) {
            return;
        }
        stop();
        canvas_->motion->steps.erase(canvas_->motion->steps.begin() + canvas_->scope - 1);
        canvas_->scope = std::min(canvas_->scope, int(canvas_->motion->steps.size()));
        select_input(inputs_->currentRow());
    });
    section("Movement / tracked point");
    auto* body = body_field_ = new QComboBox(panel);
    for (const auto& part : landmarks) {
        body->addItem(QString::fromStdString(ui::landmark_label(part.index)), part.index);
    }
    body->setCurrentIndex(body->findData(15));
    layout->addWidget(body);
    connect(body, &QComboBox::currentIndexChanged, this, [this, body] {
        const auto target = body->currentData().toInt();
        try {
            if (canvas_->motion && target != canvas_->landmark) {
                const auto layers = ui::layers(*canvas_->motion);
                if (std::any_of(layers.begin(), layers.end(), [this](const auto& layer) {
                        return layer.landmark == canvas_->landmark;
                    })) {
                    ui::reassign_layer(*canvas_->motion, canvas_->landmark, target);
                }
            }
        } catch (const std::exception& error) {
            const QSignalBlocker blocker(body);
            body->setCurrentIndex(body->findData(canvas_->landmark));
            report(QString::fromUtf8(error.what()));
            return;
        }
        stop();
        canvas_->landmark = target;
        canvas_->selection.clear();
        refresh_zone();
        canvas_->update();
        report("Tracked point updated in this movement. Save to keep it on disk.");
    });
    section("Drawing tools");
    auto* tools = new QGridLayout;
    layout->addLayout(tools);
    auto* tool_group = new QButtonGroup(this);
    const auto tool = [&](const char* name, int index, auto callback) {
        auto* control = new QPushButton(name, panel);
        control->setCheckable(true);
        control->setObjectName("zone-tool");
        tool_group->addButton(control);
        tools->addWidget(control, index / 2, index % 2);
        connect(control, &QPushButton::clicked, this, callback);
        return control;
    };
    const char* labels[]{"Passage", "Cancel", "Action", "Hand sign"};
    const char* roles[]{"required", "forbidden", "trigger", "interaction"};
    const char* hints[]{"Green: pass through this zone.", "Red: avoid this zone.",
                        "Yellow: finish the movement here.",
                        "Purple: perform a hand sign, with an optional hold."};
    for (int type = 0; type < 4; ++type) {
        auto* brush = tool(labels[type], type, [this, type] {
            stop();
            canvas_->type = ConstraintType(type);
            canvas_->erase = false;
            canvas_->select = false;
            canvas_->selection.clear();
            interaction_controls_->hide();
            zone_controls_->hide();
            order_controls_->setVisible(
                type == int(ConstraintType::Required) && canvas_->motion && canvas_->scope > 0 &&
                !canvas_->motion->steps.empty() &&
                canvas_->motion->steps[std::max(0, canvas_->scope - 1)].mode == StepMode::Ordered);
        });
        brush->setChecked(type == int(ConstraintType::Required));
        brush->setProperty("zone", roles[type]);
        brush->setToolTip(hints[type]);
    }
    tool("Select", 4, [this] {
        stop();
        canvas_->select = true;
        canvas_->erase = false;
        interaction_controls_->hide();
        order_controls_->hide();
    })->setToolTip("Drag to select zones; Ctrl keeps the previous selection.");
    auto* fingers = button("Clear all finger rules", [this] {
        stop();
        if (canvas_->motion) {
            const int index = inputs_->currentRow();
            ui::clear_fingers(*canvas_->motion);
            refresh_inputs();
            inputs_->setCurrentRow(index);
        }
    });
    tool("Erase", 5, [this] {
        stop();
        canvas_->erase = true;
        canvas_->select = false;
        canvas_->selection.clear();
        interaction_controls_->hide();
        zone_controls_->hide();
        order_controls_->hide();
    });
    order_controls_ = section("Route numbering");
    auto* route_hint = new QLabel(
        "Cells are numbered as you draw: reach 1, then 2, then 3. Each tracked point has its "
        "own route. This is separate from the movement steps.",
        panel);
    route_hint->setWordWrap(true);
    layout->addWidget(route_hint);
    zone_controls_ = section("Selected zone / geometry");
    auto* geometry = new QGridLayout;
    layout->addLayout(geometry);
    const char* geometry_names[]{"X", "Y", "Width", "Height"};
    for (std::size_t i = 0; i < zone_geometry_.size(); ++i) {
        auto* field = zone_geometry_[i] = new QSpinBox(zone_controls_);
        field->setRange(i < 2 ? Grid::min_cell : 1, i < 2 ? Grid::max_cell - 1 : Grid::cell_count);
        geometry->addWidget(new QLabel(geometry_names[i], zone_controls_), 0, int(i));
        geometry->addWidget(field, 1, int(i));
        connect(field, &QSpinBox::valueChanged, this, [this] {
            if (!canvas_->motion || canvas_->selection.ids.size() != 1) {
                return;
            }
            for (auto& cell : canvas_->current_constraints()) {
                if (!canvas_->selection.includes(cell.id)) {
                    continue;
                }
                const Cell proposed{zone_geometry_[0]->value(), zone_geometry_[1]->value(),
                                    zone_geometry_[2]->value(), zone_geometry_[3]->value()};
                if (proposed.x + proposed.width > Grid::max_cell ||
                    proposed.y + proposed.height > Grid::max_cell) {
                    report("The zone must stay inside the grid.");
                    refresh_zone();
                    return;
                }
                cell.cell = proposed;
                stop();
                canvas_->update();
                break;
            }
        });
    }
    zone_controls_->hide();
    interaction_controls_ = section("Selected conditional trigger / hand sign");
    interaction_controls_->hide();
    auto* gesture = gesture_field_ = new QComboBox(panel);
    auto* hand = hand_field_ = new QComboBox(panel);
    hand->addItems({"Left hand", "Right hand"});
    layout->addWidget(hand);
    connect(hand, &QComboBox::currentIndexChanged, this, [this](int value) {
        canvas_->interaction.hand = HandSide(value);
        for (auto& cell : canvas_->current_constraints()) {
            if (canvas_->selection.includes(cell.id) && cell.interaction) {
                cell.interaction->hand = HandSide(value);
                for (auto& margin : canvas_->current_constraints()) {
                    if (margin.tolerance_for == cell.id) {
                        margin.interaction = cell.interaction;
                    }
                }
            }
        }
        stop();
    });
    for (const auto name : gesture_names) {
        gesture->addItem(QString::fromUtf8(name.data(), int(name.size())));
    }
    gesture->setCurrentIndex(int(Gesture::V));
    layout->addWidget(gesture);
    connect(gesture, &QComboBox::currentIndexChanged, this, [this](int value) {
        canvas_->interaction.gesture = Gesture(value);
        for (auto& cell : canvas_->current_constraints()) {
            if (canvas_->selection.includes(cell.id) && cell.interaction) {
                cell.interaction->gesture = Gesture(value);
                for (auto& margin : canvas_->current_constraints()) {
                    if (margin.tolerance_for == cell.id) {
                        margin.interaction = cell.interaction;
                    }
                }
            }
        }
        stop();
    });
    auto* hold = interaction_hold_field_ = new QSpinBox(panel);
    hold->setRange(0, maximum_interaction_hold_ms);
    hold->setSuffix(" ms hold");
    layout->addWidget(hold);
    connect(hold, &QSpinBox::valueChanged, this, [this](int value) {
        canvas_->interaction.hold_ms = value;
        for (auto& cell : canvas_->current_constraints()) {
            if (canvas_->selection.includes(cell.id) && cell.interaction) {
                cell.interaction->hold_ms = value;
                for (auto& margin : canvas_->current_constraints()) {
                    if (margin.tolerance_for == cell.id) {
                        margin.interaction = cell.interaction;
                    }
                }
            }
        }
        stop();
    });
    // Destructive finger editing belongs with movement settings, away from drawing tools.
    form->addRow(fingers);
    drawing->addStretch();
    canvas_->changed = [this] {
        if (running_) {
            stop();
        }
        config_.track_hands |= canvas_->type == ConstraintType::Interaction;
        canvas_->interaction.hand = canvas_->landmark == 16 ? HandSide::Right : HandSide::Left;
    };
    canvas_->selection_changed = [this] { refresh_zone(); };
    canvas_->confirm_overwrite = [this] {
        stop();
        return QMessageBox::question(
                   this, "Replace zone?",
                   "This cell already belongs to a different coloured zone. Replace that zone?",
                   QMessageBox::Yes | QMessageBox::No, QMessageBox::No) == QMessageBox::Yes;
    };
}
void Window::refresh_zone() {
    if (canvas_->select) {
        for (auto* button : drawing_panel_->findChildren<QPushButton*>("zone-tool")) {
            if (button->text() == "Select") {
                button->setChecked(true);
            }
        }
    }
    order_controls_->setVisible(
        canvas_->motion && canvas_->scope > 0 &&
        canvas_->scope <= int(canvas_->motion->steps.size()) &&
        canvas_->motion->steps[canvas_->scope - 1].mode == StepMode::Ordered &&
        canvas_->type == ConstraintType::Required && !canvas_->select && !canvas_->erase);
    const SpatialConstraint* selected = nullptr;
    const SpatialConstraint* zone = nullptr;
    if (canvas_->motion) {
        for (const auto& cell : canvas_->current_constraints()) {
            if (canvas_->selection.ids.size() == 1 && canvas_->selection.includes(cell.id)) {
                zone = &cell;
            }
            if (canvas_->selection.includes(cell.id) && cell.interaction) {
                selected = &cell;
                break;
            }
        }
    }
    zone_controls_->setVisible(zone != nullptr);
    if (zone) {
        const int values[]{zone->cell.x, zone->cell.y, zone->cell.width, zone->cell.height};
        for (std::size_t i = 0; i < zone_geometry_.size(); ++i) {
            const QSignalBlocker blocker(zone_geometry_[i]);
            zone_geometry_[i]->setValue(values[i]);
        }
    }
    interaction_controls_->setVisible(selected != nullptr);
    if (selected) {
        const QSignalBlocker gesture_blocker(gesture_field_), hold_blocker(interaction_hold_field_),
            hand_blocker(hand_field_);
        gesture_field_->setCurrentIndex(int(selected->interaction->gesture));
        interaction_hold_field_->setValue(selected->interaction->hold_ms);
        hand_field_->setCurrentIndex(int(selected->interaction->hand));
    }
}
void Window::refresh_inputs() {
    canvas_->motion = nullptr;
    inputs_->clear();
    for (const auto& input : config_.motions) {
        inputs_->addItem(QString::fromStdString(input.name + "\n" + ui::binding_summary(input)));
    }
    if (!config_.motions.empty()) {
        inputs_->setCurrentRow(0);
    }
    canvas_->update();
}
void Window::select_input(int index) {
    canvas_->selection.clear();
    canvas_->motion =
        index >= 0 && index < int(config_.motions.size()) ? &config_.motions[index] : nullptr;
    drawing_panel_->setEnabled(canvas_->motion != nullptr);
    if (canvas_->motion) {
        const auto layers = ui::layers(*canvas_->motion);
        if (!layers.empty()) {
            canvas_->landmark = layers.front().landmark;
        }
    }
    const QSignalBlocker body_blocker(body_field_);
    body_field_->setCurrentIndex(body_field_->findData(canvas_->landmark));
    refresh_zone();
    refresh_settings();
    if (step_field_) {
        const QSignalBlocker blocker(step_field_);
        step_field_->clear();
        step_field_->addItem("Global conditions");
        if (canvas_->motion) {
            canvas_->scope = std::min(canvas_->scope, int(canvas_->motion->steps.size()));
            for (std::size_t i = 0; i < canvas_->motion->steps.size(); ++i) {
                step_field_->addItem(
                    QString("Step %1 of %2").arg(i + 1).arg(canvas_->motion->steps.size()));
            }
        }
        step_field_->setCurrentIndex(canvas_->scope);
        refresh_step();
    }
    canvas_->update();
}
void Window::refresh_step() {
    const bool step = canvas_->motion && canvas_->scope > 0;
    step_help_->setText(
        step
            ? "Steps run one after another. Choose how to reach the cells inside this step: in "
              "order, any order, or all at the same time. One step is enough for a simple movement."
            : "Global conditions apply throughout the movement. Place action and hand sign zones "
              "inside a step.");
    findChild<QPushButton*>("add-step")
        ->setEnabled(canvas_->motion && canvas_->motion->steps.size() < 64);
    findChild<QPushButton*>("delete-step")->setEnabled(step && canvas_->motion->steps.size() > 1);
    step_mode_field_->setVisible(step);
    const QSignalBlocker mode_blocker(step_mode_field_), hold_blocker(step_hold_field_);
    if (step) {
        const auto& value = canvas_->motion->steps[canvas_->scope - 1];
        step_mode_field_->setCurrentIndex(int(value.mode));
        step_hold_field_->setValue(value.hold_ms);
    }
    step_hold_field_->setVisible(step && canvas_->motion->steps[canvas_->scope - 1].mode ==
                                             StepMode::Simultaneous);
    order_controls_->setVisible(
        step && canvas_->motion->steps[canvas_->scope - 1].mode == StepMode::Ordered &&
        canvas_->type == ConstraintType::Required && !canvas_->select && !canvas_->erase);
    canvas_->update();
}
void Window::load(const std::string& path) {
    try {
        auto proposed = load_configuration(path);
        stop();
        keyboard_switch_->setChecked(false);
        if (!review_import(this, proposed)) {
            return;
        }
        config_ = std::move(proposed);
        refresh_inputs();
        report("Profile loaded.");
    } catch (const std::exception& error) {
        report(error.what());
    }
}
bool Window::apply_settings() {
    if (!canvas_->motion) {
        return true;
    }
    try {
        auto draft = *canvas_->motion;
        draft.name = name_field_->text().toStdString();
        draft.action = action_field_->text().toStdString();
        draft.keyboard = ui::parse_binding(keys_field_->text().toStdString());
        draft.mirror = mirror_field_->isChecked();
        draft.space = CoordinateSpace(space_field_->currentIndex());
        draft.action_mode = ActionMode(action_mode_field_->currentIndex());
        draft.repeat_interval_ms = repeat_field_->value();
        draft.cooldown_ms = cooldown_field_->value();
        draft.max_duration_ms = duration_field_->value();
        if (draft.name.empty() || draft.action.empty()) {
            throw std::runtime_error("Enter a name and action before applying.");
        }
        settings_error_->clear();
        if (draft == *canvas_->motion) {
            return true;
        }
        stop();
        const int row = inputs_->currentRow();
        Configuration proposed = config_;
        proposed.motions[row] = draft;
        validate(proposed);
        config_ = std::move(proposed);
        refresh_inputs();
        inputs_->setCurrentRow(row);
        report("Movement applied. Save the profile to keep your changes.");
        return true;
    } catch (const std::exception& error) {
        settings_error_->setText(error.what());
        return false;
    }
}
void Window::show_view(int view) {
    if (!apply_settings()) {
        const QSignalBlocker blocker(sections_);
        sections_->setCurrentIndex(1);
        auto* target = sections_->widget(1);
        workspace_->setParent(target);
        target->layout()->addWidget(workspace_);
        workspace_->show();
        canvas_->read_only = false;
        inspector_pages_->setCurrentIndex(0);
        inspector_->setCurrentIndex(1);
        return;
    }
    if (view != 0 && !canvas_->motion) {
        report("Create or select a movement first.");
        const QSignalBlocker blocker(sections_);
        sections_->setCurrentIndex(0);
        return;
    }
    pages_->setCurrentWidget(sections_);
    if (sections_->currentIndex() != view) {
        const QSignalBlocker blocker(sections_);
        sections_->setCurrentIndex(view);
    }
    auto* target = sections_->widget(view == 2 ? 2 : 1);
    if (workspace_->parentWidget() != target) {
        workspace_->setParent(target);
        target->layout()->addWidget(workspace_);
    }
    workspace_->show();
    if (view == 2 && !canvas_->read_only) {
        editing_full_grid_ = canvas_->full_grid;
        canvas_->full_grid = false;
    } else if (view != 2 && canvas_->read_only) {
        canvas_->full_grid = editing_full_grid_;
    }
    canvas_->read_only = view == 2;
    inspector_pages_->setCurrentIndex(view == 2 ? 1 : 0);
    if (view == 2) {
        keyboard_switch_->setChecked(false);
        log_dock_->hide();
        report("Test: follow the coloured zones. Keyboard output is disabled.");
    } else {
        log_dock_->hide();
    }
    keyboard_switch_->setEnabled(view != 2 && keyboard_.available());
    canvas_->update();
}
void Window::refresh_settings() {
    settings_panel_->setEnabled(canvas_->motion != nullptr);
    settings_error_->clear();
    if (!canvas_->motion) {
        return;
    }
    const auto& motion = *canvas_->motion;
    name_field_->setText(QString::fromStdString(motion.name));
    action_field_->setText(QString::fromStdString(motion.action));
    keys_field_->setText(QString::fromStdString(ui::binding_label(motion.keyboard)));
    action_mode_field_->setCurrentIndex(int(motion.action_mode));
    space_field_->setCurrentIndex(int(motion.space));
    mirror_field_->setChecked(motion.mirror);
    repeat_field_->setValue(motion.repeat_interval_ms);
    cooldown_field_->setValue(int(motion.cooldown_ms));
    duration_field_->setValue(int(motion.max_duration_ms));
}
void Window::edit_settings() {
    if (!canvas_->motion) {
        report("Select a movement first.");
        return;
    }
    show_view(1);
    inspector_->setCurrentIndex(1);
}
void Window::edit_json() {
    stop();
    if (!json_panel_) {
        json_panel_ = new QWidget(pages_);
        auto* layout = new QVBoxLayout(json_panel_);
        layout->setContentsMargins(24, 24, 24, 24);
        auto* heading = new QLabel("Complete configuration", json_panel_);
        heading->setProperty("role", "heading");
        layout->addWidget(heading);
        json_source_ = new QPlainTextEdit(json_panel_);
        layout->addWidget(json_source_, 1);
        json_error_ = new QLabel(json_panel_);
        json_error_->setWordWrap(true);
        json_error_->setProperty("role", "error");
        layout->addWidget(json_error_);
        auto* actions = new QHBoxLayout;
        auto* back = new QPushButton("Back to Studio", json_panel_);
        auto* apply = new QPushButton("Apply JSON", json_panel_);
        apply->setProperty("role", "primary");
        actions->addWidget(back);
        actions->addStretch();
        actions->addWidget(apply);
        layout->addLayout(actions);
        connect(back, &QPushButton::clicked, this, [this] { pages_->setCurrentWidget(sections_); });
        connect(apply, &QPushButton::clicked, this, [this] {
            try {
                config_ = parse_configuration(json_source_->toPlainText().toStdString());
                refresh_inputs();
                show_view(0);
                report("JSON applied. Save the profile to keep your changes.");
            } catch (const std::exception& error) {
                json_error_->setText(error.what());
            }
        });
        pages_->addWidget(json_panel_);
    }
    json_source_->setPlainText(QString::fromStdString(serialize_configuration(config_)));
    json_error_->clear();
    pages_->setCurrentWidget(json_panel_);
}
void Window::start() {
    stop();
    try {
        validate(config_);
        capture_.start(config_, runtime_, camera_);
        running_ = true;
        report("Starting camera; keep shoulders visible for calibration.");
    } catch (const std::exception& error) {
        report(error.what());
    }
}
void Window::stop() {
    capture_.stop();
    running_ = false;
    active_.fill(false);
    output_.cancel([this](int key, bool release) { return keyboard_.key(key, release); },
                   [](char16_t, bool) { return true; });
    canvas_->snapshot = {};
    canvas_->update();
}
void Window::tick() {
    const auto now = native::now_ms();
    Snapshot snapshot;
    if (capture_.take(snapshot)) {
        if (!snapshot.error.empty()) {
            stop();
            report(QString::fromStdString(snapshot.error));
            return;
        }
        last_frame_ = snapshot.body.timestamp_ms;
        active_ = snapshot.active;
        if (snapshot.paused) {
            output_.cancel([this](int key, bool release) { return keyboard_.key(key, release); },
                           [](char16_t, bool) { return true; });
        }
        for (const auto& event : snapshot.events) {
            if (now - event.timestamp_ms > 250) {
                continue;
            }
            const auto input = event.motion;
            flashed_[input] = now + 900;
            report(QString::fromStdString("Action: " + config_.motions[input].action));
            if (keyboard_switch_->isChecked()) {
                output_.trigger(input, config_.motions[input], now);
            }
        }
        canvas_->snapshot = std::move(snapshot);
        canvas_->update();
    }
    const auto send = [this](int key, bool release) { return keyboard_.key(key, release); };
    if (keyboard_switch_->isChecked() && running_ && now - last_frame_ <= 250) {
        if (!output_.advance(config_.motions, active_, now, send,
                             [this](char16_t character, bool release) {
                                 return release || keyboard_.text(character);
                             })) {
            keyboard_switch_->setChecked(false);
            report("Keyboard output failed: unsupported key/text in the current X11 layout.");
        }
    } else {
        output_.cancel(send, [](char16_t, bool) { return true; });
        active_.fill(false);
    }
    for (int index = 0; index < inputs_->count(); ++index) {
        const QBrush background =
            flashed_[index] > now || active_[index] ? QColor("#267a54") : Qt::transparent;
        auto* item = inputs_->item(index);
        if (item->background() != background) {
            item->setBackground(background);
        }
    }
}
} // namespace mig::linux_ui
