#include "theme.hpp"
#include "../apps/design_tokens.hpp"
#include <QFont>
#include <QLabel>

namespace mig::linux_ui {
void apply_widget_theme(QWidget& window, bool dark) {
    const auto tokens = ui::design::palette(dark);
    const auto hex = [](std::uint32_t value) {
        return QString("#%1").arg(value, 6, 16, QLatin1Char('0'));
    };
    const auto text = hex(tokens.ink), surface = hex(tokens.surface), base = hex(tokens.paper);
    const auto thumb = hex(tokens.border), hover = hex(tokens.muted);
    const auto accent = hex(tokens.accent), selected = hex(tokens.selected);
    QPalette colors;
    colors.setColor(QPalette::Window, QColor(base));
    colors.setColor(QPalette::Base, QColor(surface));
    colors.setColor(QPalette::AlternateBase, QColor(base));
    colors.setColor(QPalette::Text, QColor(text));
    colors.setColor(QPalette::WindowText, QColor(text));
    colors.setColor(QPalette::ButtonText, QColor(text));
    colors.setColor(QPalette::Button, QColor(surface));
    colors.setColor(QPalette::Highlight, QColor(selected));
    colors.setColor(QPalette::HighlightedText, QColor(text));
    colors.setColor(QPalette::ToolTipBase, QColor(surface));
    colors.setColor(QPalette::ToolTipText, QColor(text));
    for (auto role : {QPalette::Text, QPalette::WindowText, QPalette::ButtonText}) {
        colors.setColor(QPalette::Disabled, role, QColor(hover));
    }
    window.setPalette(colors);
    window.setFont(QFont("Sans Serif", 10));
    window.setStyleSheet(
        QString(
            "QWidget { color: %1; background-color: %2; }"
            "QLabel[role='heading'] { color: %1; font-family: 'DejaVu Serif'; font-size: 26px; }"
            "QLabel[role='hint'] { color: %5; background: transparent; }"
            "QGroupBox { border: 1px solid %4; border-radius: 8px; margin-top: 18px;"
            "padding: 16px 10px 10px; font-weight: 600; }"
            "QGroupBox::title { subcontrol-origin: margin; left: 12px; padding: 0 5px; }"
            "QListWidget, QComboBox, QPlainTextEdit, QLineEdit, QSpinBox { background: %3; }"
            "QPushButton, QComboBox, QSpinBox, QLineEdit, QPlainTextEdit { border: 1px solid %4;"
            "border-radius: 5px; padding: 8px; }"
            "QPushButton:hover, QComboBox:hover, QSpinBox:hover { border-color: %6; }"
            "QPushButton:focus, QComboBox:focus, QSpinBox:focus, QLineEdit:focus {"
            "border: 2px solid %6; padding: 7px; }"
            "QPushButton[role='primary'] { background: #245e51; color: white; border-color: "
            "#245e51; }"
            "QPushButton[role='primary']:hover { background: #174a3e; }"
            "QPushButton[role='danger'] { color: %8; }"
            "QPushButton[zone='required'] { border-color: #30c387; }"
            "QPushButton[zone='forbidden'] { border-color: #f25769; }"
            "QPushButton[zone='trigger'] { border-color: #e5b929; }"
            "QPushButton[zone='interaction'] { border-color: #b870f5; }"
            "QPushButton:disabled { color: %5; background: %2; }"
            "QPushButton:checked { background: %7; border-color: %6; }"
            "QListWidget { border: none; }"
            "QListWidget::item { color: %1; border: 1px solid %4; border-radius: 5px;"
            "padding: 12px; margin: 4px 0; }"
            "QListWidget::item:selected { color: %1; background: %7; border-color: %6; }"
            "QTabWidget::pane { border: none; }"
            "QTabBar::tab { padding: 10px 14px; border-bottom: 2px solid transparent; }"
            "QTabBar::tab:selected { color: %6; border-bottom-color: %6; }"
            "QToolBar { border: none; border-bottom: 1px solid %4; spacing: 8px; padding: 8px; }"
            "QToolTip { color: %1; background: %3; border: 1px solid %4; padding: 8px; }"
            "QScrollBar { background: %2; border: none; }"
            "QScrollBar:vertical { width: 12px; margin: 2px 0; }"
            "QScrollBar:horizontal { height: 12px; margin: 0 2px; }"
            "QScrollBar::handle { background: %4; border-radius: 4px; }"
            "QScrollBar::handle:vertical { min-height: 24px; }"
            "QScrollBar::handle:horizontal { min-width: 24px; }"
            "QScrollBar::handle:hover { background: %5; }"
            "QScrollBar::handle:pressed { background: %6; }"
            "QScrollBar::add-line, QScrollBar::sub-line { width: 0; height: 0; }"
            "QScrollBar::add-page, QScrollBar::sub-page { background: none; }"
            "QAbstractScrollArea::corner { background: %2; border: none; }")
            .arg(text, base, surface, thumb, hover, accent, selected,
                 dark ? "#ffaaa6" : "#a32726"));
    // Toolbar widget actions may retain their own palette instead of inheriting it.
    for (auto* label : window.findChildren<QLabel*>()) {
        if (label->property("role") == "heading") {
            label->setPalette(colors);
            label->setStyleSheet(QString("color: %1; background: transparent; font-family: 'DejaVu "
                                         "Serif'; font-size: 26px;")
                                     .arg(text));
        }
    }
}
} // namespace mig::linux_ui
