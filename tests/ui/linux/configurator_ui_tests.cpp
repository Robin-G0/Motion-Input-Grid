#include "../../../src/apps/authoring.hpp"
#include "window.hpp"
#include <QApplication>
#include <QComboBox>
#include <QDockWidget>
#include <QLabel>
#include <QLineEdit>
#include <QMouseEvent>
#include <QPushButton>
#include <QSpinBox>
#include <QTabWidget>
#include <mig/format/configuration.hpp>

namespace mig::linux_ui {
bool Window::ui_test() {
    Motion input;
    input.id = input.name = input.action = "test";
    input.steps.push_back({"step1", StepMode::Ordered});
    config_.motions.push_back(input);
    refresh_inputs();
    auto* sections = findChild<QTabWidget*>("studio-sections");
    if (!sections || sections->count() != 3 || !drawing_panel_->isEnabled()) {
        return false;
    }
    sections->setCurrentIndex(1);
    if (drawing_panel_->findChildren<QPushButton*>("zone-tool").size() != 6 ||
        findChild<QComboBox*>("layer-source") || step_help_->text().isEmpty() ||
        findChild<QPushButton*>("delete-step")->isEnabled()) {
        return false;
    }
    for (auto* button : drawing_panel_->findChildren<QPushButton*>()) {
        if (button->text() == "Hand sign") {
            button->click();
        }
    }
    if (!interaction_controls_->isHidden() || !order_controls_->isHidden()) {
        return false;
    }
    for (auto* button : drawing_panel_->findChildren<QPushButton*>()) {
        if (button->text() == "Passage") {
            button->click();
        }
    }
    if (!interaction_controls_->isHidden() || order_controls_->isHidden()) {
        return false;
    }
    canvas_->type = ConstraintType::Trigger;
    const QPointF center(canvas_->width() / 2.0, canvas_->height() / 2.0);
    QMouseEvent click(QEvent::MouseButtonPress, center, center, Qt::LeftButton, Qt::LeftButton,
                      Qt::NoModifier);
    QApplication::sendEvent(canvas_, &click);
    if (config_.motions[0].steps[0].constraints.size() != 1) {
        return false;
    }
    body_field_->setCurrentIndex(body_field_->findData(16));
    if (config_.motions[0].steps[0].constraints[0].landmark != 16) {
        return false;
    }
    canvas_->landmark = 16;
    canvas_->type = ConstraintType::Required;
    const QPointF next = center + QPointF(40, 0);
    QMouseEvent required(QEvent::MouseButtonPress, next, next, Qt::LeftButton, Qt::LeftButton,
                         Qt::NoModifier);
    QApplication::sendEvent(canvas_, &required);
    QApplication::sendEvent(canvas_, &required);
    const auto& cells = config_.motions[0].steps[0].constraints;
    if (cells.size() != 2 || cells[0].type != ConstraintType::Required || cells[0].order != 1 ||
        cells[1].type != ConstraintType::Trigger || cells[1].order != 2) {
        return false;
    }
    if (canvas_->selection.ids.size() != 1 || zone_controls_->isHidden()) {
        return false;
    }
    const auto unchanged = config_;
    canvas_->select = false;
    canvas_->type = ConstraintType::Forbidden;
    canvas_->confirm_overwrite = [] { return false; };
    QApplication::sendEvent(canvas_, &required);
    if (config_ != unchanged) {
        return false;
    }
    canvas_->confirm_overwrite = [] { return true; };
    QApplication::sendEvent(canvas_, &required);
    if (config_.motions[0].steps[0].constraints.size() != 2 ||
        std::none_of(canvas_->current_constraints().begin(), canvas_->current_constraints().end(),
                     [](const auto& cell) { return cell.type == ConstraintType::Forbidden; })) {
        return false;
    }
    config_ = unchanged;
    select_input(0);
    canvas_->type = ConstraintType::Required;
    canvas_->select = false;
    const auto definition = config_;
    canvas_->type = ConstraintType::Interaction;
    const auto conditional_point = center + QPointF(120, 0);
    QMouseEvent conditional_click(QEvent::MouseButtonPress, conditional_point, conditional_point,
                                  Qt::LeftButton, Qt::LeftButton, Qt::NoModifier);
    QApplication::sendEvent(canvas_, &conditional_click);
    if (interaction_controls_->isHidden() || zone_controls_->isHidden()) {
        return false;
    }
    gesture_field_->setCurrentIndex(int(Gesture::OK));
    interaction_hold_field_->setValue(750);
    hand_field_->setCurrentIndex(int(HandSide::Left));
    const auto sign =
        std::find_if(canvas_->current_constraints().begin(), canvas_->current_constraints().end(),
                     [](const auto& cell) { return cell.interaction.has_value(); });
    if (sign == canvas_->current_constraints().end() || sign->interaction->gesture != Gesture::OK ||
        sign->interaction->hold_ms != 750 || sign->interaction->hand != HandSide::Left) {
        return false;
    }
    config_ = definition;
    select_input(0);
    canvas_->type = ConstraintType::Required;
    canvas_->select = false;
    const auto frame_size = canvas_->size();
    show_view(2);
    QApplication::processEvents();
    if (!canvas_->read_only || canvas_->size() != frame_size || config_ != definition ||
        keyboard_switch_->isEnabled() || inspector_pages_->currentIndex() != 1) {
        return false;
    }
    show_view(1);
    QApplication::processEvents();
    if (canvas_->read_only || canvas_->size() != frame_size || config_ != definition) {
        return false;
    }
    step_mode_field_->setCurrentIndex(int(StepMode::Visited));
    if (config_.motions[0].steps[0].mode != StepMode::Visited ||
        config_.motions[0].steps[0].constraints[0].order != 0 || !step_hold_field_->isHidden()) {
        return false;
    }
    step_mode_field_->setCurrentIndex(int(StepMode::Simultaneous));
    if (step_hold_field_->isHidden() || !order_controls_->isHidden()) {
        return false;
    }
    step_hold_field_->setValue(800);
    if (config_.motions[0].steps[0].hold_ms != 800) {
        return false;
    }
    step_mode_field_->setCurrentIndex(int(StepMode::Ordered));
    if (config_.motions[0].steps[0].constraints[0].order != 1 ||
        config_.motions[0].steps[0].constraints[1].order != 2) {
        return false;
    }
    config_ = definition;
    refresh_inputs();
    step_mode_field_->setCurrentIndex(int(StepMode::Ordered));
    edit_settings();
    if (inspector_->currentIndex() != 1 || settings_panel_->window() != this) {
        return false;
    }
    name_field_->setText("Updated movement");
    if (!apply_settings() || config_.motions[0].name != "Updated movement") {
        return false;
    }
    keys_field_->setText("This is not a keyboard shortcut");
    const auto valid_profile = config_;
    if (apply_settings() || config_ != valid_profile || settings_error_->text().isEmpty()) {
        return false;
    }
    refresh_settings();
    inspector_->setCurrentIndex(0);
    edit_json();
    if (json_panel_->window() != this) {
        return false;
    }
    show_view(1);
    if (qEnvironmentVariableIsSet("MIG_UI_SCREENSHOTS")) {
        grab().save("studio-dark.png");
    }
    apply_theme(false);
    if (qEnvironmentVariableIsSet("MIG_UI_SCREENSHOTS")) {
        grab().save("studio-light.png");
    }
    apply_theme(true);
    log_dock_->show();
    if (!log_dock_->isFloating() || !(log_dock_->features() & QDockWidget::DockWidgetMovable) ||
        !(log_dock_->features() & QDockWidget::DockWidgetFloatable)) {
        return false;
    }
    log_dock_->hide();
    const auto json = serialize_configuration(config_);
    return parse_configuration(json) == config_ && canvas_->motion && inputs_->count() == 1;
}
} // namespace mig::linux_ui
