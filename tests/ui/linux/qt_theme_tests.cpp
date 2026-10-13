#include "../../../src/linux-apps/theme.hpp"
#include <QApplication>
#include <QScrollBar>
#include <QStyleOptionSlider>
#include <iostream>

namespace {
void check_bar(QScrollBar& bar, QColor track, QColor thumb) {
    QStyleOptionSlider option;
    option.initFrom(&bar);
    option.orientation = bar.orientation();
    option.minimum = bar.minimum();
    option.maximum = bar.maximum();
    option.sliderPosition = bar.value();
    option.sliderValue = bar.value();
    option.pageStep = bar.pageStep();
    option.singleStep = bar.singleStep();
    const auto handle = bar.style()->subControlRect(QStyle::CC_ScrollBar, &option,
                                                    QStyle::SC_ScrollBarSlider, &bar);
    const auto image = bar.grab().toImage();
    if (image.pixelColor(1, 1) != track || image.pixelColor(handle.center()) != thumb) {
        throw std::runtime_error("Qt scrollbar colors did not follow the selected theme.");
    }
    const auto before = bar.value();
    bar.triggerAction(QAbstractSlider::SliderSingleStepAdd);
    if (bar.value() != before + 1) {
        throw std::runtime_error("Themed Qt scrollbar lost scrolling behavior.");
    }
}
} // namespace
int main(int argc, char** argv) {
    QApplication application(argc, argv);
    try {
        QWidget window;
        window.move(-10000, -10000);
        window.resize(220, 220);
        QScrollBar vertical(Qt::Vertical, &window), horizontal(Qt::Horizontal, &window);
        vertical.setGeometry(10, 10, 12, 180);
        horizontal.setGeometry(30, 190, 180, 12);
        for (auto* bar : {&vertical, &horizontal}) {
            bar->setRange(0, 100);
            bar->setPageStep(10);
            bar->setValue(40);
        }
        window.show();
        for (const bool dark : {true, false, true}) {
            mig::linux_ui::apply_widget_theme(window, dark);
            application.processEvents();
            const QColor track(dark ? "#0b101a" : "#f7f4ed");
            const QColor thumb(dark ? "#354043" : "#cdcfc5");
            check_bar(vertical, track, thumb);
            check_bar(horizontal, track, thumb);
        }
        std::cout << "Qt scrollbar pixels, dark/light changes and scrolling passed.\n";
        return 0;
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
