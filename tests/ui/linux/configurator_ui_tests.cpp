#include "../../../src/apps/authoring.hpp"
#include "window.hpp"
#include <QApplication>
#include <QDockWidget>
#include <QMouseEvent>
#include <QPushButton>
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
    if (!sections || sections->count() != 2 || !drawing_panel_->isEnabled()) {
        return false;
    }
    sections->setCurrentIndex(1);
    for (auto* button : drawing_panel_->findChildren<QPushButton*>()) {
        if (button->text() == "Interaction") {
            button->click();
        }
    }
    if (interaction_controls_->isHidden() || !order_controls_->isHidden()) {
        return false;
    }
    for (auto* button : drawing_panel_->findChildren<QPushButton*>()) {
        if (button->text() == "Required") {
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
    ui::reassign_layer(config_.motions[0], 15, 16);
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
    if (qEnvironmentVariableIsSet("MIG_UI_SCREENSHOTS")) {
        grab().save("studio-dark.png");
    }
    apply_theme(false);
    if (qEnvironmentVariableIsSet("MIG_UI_SCREENSHOTS")) {
        grab().save("studio-light.png");
    }
    apply_theme(true);
    log_dock_->show();
    log_dock_->hide();
    const auto json = serialize_configuration(config_);
    return parse_configuration(json) == config_ && canvas_->motion && inputs_->count() == 1;
}
} // namespace mig::linux_ui
