#include "app.hpp"
namespace mig::app {
void App::erase_at(int x, int y) {
    const int landmark = landmarks[selection(edit_window, Members)].index;
    const auto erase = [&](auto& regions) {
        std::vector<std::string> removed;
        ui::line(last_brush_cell.first, last_brush_cell.second, x, y, [&](int cx, int cy) {
            for (const auto& region : regions) {
                if (region.landmark == landmark &&
                    ui::contains(region.cell, {float(cx), float(cy)})) {
                    removed.push_back(region.id);
                }
            }
        });
        ui::erase_regions(regions, removed);
    };
    erase(current_constraints());
    region_selection.clear();
    selected_constraint = selected_finger = -1;
}
void App::select_regions(Vec2 point, bool begin) {
    if (begin) {
        stroke_before = draft;
        stroke = true;
        region_selection.begin(point, (GetKeyState(VK_CONTROL) & 0x8000) != 0);
    }
    region_selection.update(current_constraints(), point,
                            landmarks[selection(edit_window, Members)].index);
    selected_constraint = -1;
    const auto& regions = current_constraints();
    for (std::size_t index = 0; index < regions.size(); ++index) {
        if (region_selection.includes(regions[index].id)) {
            selected_constraint = int(index);
            break;
        }
    }
    if (selected_constraint >= 0) {
        inspector_tab = regions[selected_constraint].type == ConstraintType::Interaction ? 4 : 0;
        editor_help = false;
    }
    InvalidateRect(edit_window, nullptr, FALSE);
}
} // namespace mig::app
