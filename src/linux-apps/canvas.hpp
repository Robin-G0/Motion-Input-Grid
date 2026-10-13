#pragma once
#include "../apps/editor_tools.hpp"
#include "capture.hpp"
#include <QWidget>
#include <functional>
namespace mig::linux_ui {
class Canvas : public QWidget {
public:
    explicit Canvas(QWidget* parent = nullptr);
    Snapshot snapshot;
    Motion* motion{};
    int landmark{15}, order{}, scope{1};
    std::vector<SpatialConstraint>& current_constraints();
    ConstraintType type{ConstraintType::Required};
    Interaction interaction;
    bool erase{}, show_grid{true}, show_dots{true}, full_grid{true};
    bool show_hands{true}, read_only{};
    bool select{};
    ui::RegionSelection selection;
    std::function<void()> changed;
    std::function<void()> selection_changed;
    std::function<bool()> confirm_overwrite;
    std::function<void(const std::string&)> failed;

protected:
    void paintEvent(QPaintEvent*) override;
    void mousePressEvent(QMouseEvent*) override;
    void mouseMoveEvent(QMouseEvent*) override;
    void mouseReleaseEvent(QMouseEvent*) override;
    void keyPressEvent(QKeyEvent*) override;

private:
    void paint_cell(QPointF point);
    void edit_cell(QPointF point);
    QPointF project(Vec2 local) const;
    const Grid& basis() const;
    QRectF area() const;
    Vec2 local(QPointF point) const;
};
} // namespace mig::linux_ui
