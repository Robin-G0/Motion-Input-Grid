#include "app.hpp"
#include "preview_drawing.hpp"
#include <cmath>
namespace mig::app {
using namespace preview_drawing;
void App::paint(HDC dc) {
    RECT client{};
    GetClientRect(window, &client);
    FillRect(dc, &client, background_brush);
    SelectObject(dc, font);
    SetBkMode(dc, TRANSPARENT);
    SetTextColor(dc, palette().text);
    const auto write = [&](int x, int y, const std::wstring& text) {
        TextOutW(dc, x, y, text.c_str(), int(text.size()));
    };
    const RECT title_bar{0, 0, client.right, 96},
        sidebar{client.right - 332, 96, client.right, client.bottom - 32};
    FillRect(dc, &title_bar, surface_brush);
    FillRect(dc, &sidebar, surface_brush);
    SetTextColor(dc, palette().text);
    SelectObject(dc, heading_font ? heading_font : font);
    write(24, 6, L"Motion Input Grid Studio");
    SelectObject(dc, font);
    SetTextColor(dc, palette().muted);

    write(client.right - 316, 96, L"MOVEMENTS");
    if (config.motions.empty()) {
        write(client.right - 316, 112, L"No movements yet.");
        write(client.right - 316, 138, L"Create a movement to get started.");
    }
    const auto divider = CreatePen(PS_SOLID, 1, palette().border);
    const auto old_pen = SelectObject(dc, divider);
    MoveToEx(dc, 0, 47, nullptr);
    LineTo(dc, client.right, 47);
    MoveToEx(dc, client.right - 333, 96, nullptr);
    LineTo(dc, client.right - 333, client.bottom - 32);
    SelectObject(dc, old_pen);
    DeleteObject(divider);
    std::shared_ptr<const VideoFrame> video;
    std::shared_ptr<const Snapshot> result;
    std::string message;
    {
        std::lock_guard lock(capture_mutex);
        video = latest;
    }
    {
        std::lock_guard lock(state_mutex);
        result = snapshot;
        message = status;
    }
    const RECT area{24, 144, client.right - 356, client.bottom - 92};
    FillRect(dc, &area, surface_brush);
    video_rect = area;
    if (video && video->width > 0 && video->height > 0) {
        const float fit = std::min(float(area.right - area.left) / video->width,
                                   float(area.bottom - area.top) / video->height);
        const int width = int(video->width * fit), height = int(video->height * fit);
        video_rect = {area.left + (area.right - area.left - width) / 2,
                      area.top + (area.bottom - area.top - height) / 2, 0, 0};
        video_rect.right = video_rect.left + width;
        video_rect.bottom = video_rect.top + height;
        BITMAPINFO bitmap{};
        bitmap.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
        bitmap.bmiHeader.biWidth = video->width;
        bitmap.bmiHeader.biHeight = -video->height;
        bitmap.bmiHeader.biPlanes = 1;
        bitmap.bmiHeader.biBitCount = 32;
        bitmap.bmiHeader.biCompression = BI_RGB;
        StretchDIBits(dc, video_rect.right - 1, video_rect.top, -width, height, 0, 0, video->width,
                      video->height, video->bgrx.data(), &bitmap, DIB_RGB_COLORS, SRCCOPY);
    }
    // Optional diagnostics are clipped to the full-frame, mirrored preview.
    if (video && result && result->video && now_ms() - result->pose.timestamp_ms <= 250 &&
        result->pose.aspect > 0 && video->width == result->video->width &&
        video->height == result->video->height) {
        const ui::PreviewTransform preview{float(video_rect.left), float(video_rect.top),
                                           float(video_rect.right - video_rect.left),
                                           float(video_rect.bottom - video_rect.top),
                                           result->pose.aspect};
        const auto pixel = [&](Vec2 metric) {
            const auto point = preview.screen(metric);
            return POINT{LONG(std::lround(point.x)), LONG(std::lround(point.y))};
        };
        const int saved = SaveDC(dc);
        IntersectClipRect(dc, video_rect.left, video_rect.top, video_rect.right, video_rect.bottom);
        const auto& basis = selected < config.motions.size() &&
                                    config.motions[selected].space == CoordinateSpace::Calibrated
                                ? result->reference_grid
                                : result->grid;
        if (show_grid && basis.valid) {
            const auto pen = CreatePen(PS_SOLID, 1, RGB(105, 165, 190));
            const auto previous = SelectObject(dc, pen);
            for (int cell = Grid::min_cell; cell <= Grid::max_cell; ++cell) {
                for (bool vertical : {true, false}) {
                    const auto first =
                        pixel(basis.metric(vertical ? Vec2{float(cell), float(Grid::min_cell)}
                                                    : Vec2{float(Grid::min_cell), float(cell)}));
                    const auto last =
                        pixel(basis.metric(vertical ? Vec2{float(cell), float(Grid::max_cell)}
                                                    : Vec2{float(Grid::max_cell), float(cell)}));
                    MoveToEx(dc, first.x, first.y, nullptr);
                    LineTo(dc, last.x, last.y);
                }
            }
            SelectObject(dc, previous);
            DeleteObject(pen);
        }
        if (show_dots) {
            const auto pen = CreatePen(PS_SOLID, 1, RGB(48, 195, 135));
            const auto brush = CreateSolidBrush(RGB(48, 195, 135));
            const auto previous_pen = SelectObject(dc, pen),
                       previous_brush = SelectObject(dc, brush);
            for (int landmark = 0; landmark < 34; ++landmark) {
                const auto point = body_point(result->pose, landmark);
                if (point.confidence < .6f || !std::isfinite(point.position.x) ||
                    !std::isfinite(point.position.y)) {
                    continue;
                }
                const auto location =
                    pixel({point.position.x * result->pose.aspect, point.position.y});
                Ellipse(dc, location.x - 3, location.y - 3, location.x + 4, location.y + 4);
            }
            SelectObject(dc, previous_brush);
            SelectObject(dc, previous_pen);
            DeleteObject(brush);
            DeleteObject(pen);
        }
#ifdef MIG_NATIVE_HANDS
        if (show_hands) {
            draw_hands(dc, *result, pixel);
        }
#endif
        RestoreDC(dc, saved);
    }
    SetTextColor(dc, palette().muted);
    if (!video) {
        RECT placeholder = area;
        placeholder.top = (area.top + area.bottom) / 2 - 24;
        DrawTextW(
            dc,
            L"Start the camera when you are ready.\nKeep both shoulders visible for calibration.",
            -1, &placeholder, DT_CENTER | DT_WORDBREAK);
    }
    if (result) {
        std::wstring hand_status =
            result->hands_active ? L"Hands: looking for hands" : L"Hands: off";
#ifdef MIG_NATIVE_HANDS
        if (result->hands_active && now_ms() - result->pose.timestamp_ms <= 500) {
            hand_status = L"Hands: " + std::to_wstring(result->hands.count);
            for (int side = 0; side < 2; ++side) {
                const auto& hand = result->pose.fingers[side];
                hand_status += side == 0 ? L" | L:" : L" R:";
                if (std::all_of(hand.begin(), hand.end(),
                                [](const auto& p) { return p.confidence >= .6f; })) {
                    const auto sign = observed_gesture(hand, result->pose.hand_contacts[side]);
                    if (sign != Gesture::None) {
                        hand_status += wide(std::string(gesture_names[int(sign)]));
                    } else {
                        hand_status += L"other";
                    }
                } else {
                    hand_status += L"unknown";
                }
            }
        } else if (result->hands_active) {
            hand_status = L"Hands: stale observations";
        }
#endif
        write(client.right - 316, client.bottom - 62, hand_status);
        write(24, client.bottom - 66,
              std::wstring(pose_model == PoseModel::Lite ? L"Pose Lite" : L"Pose Full") +
                  L"  |  inference " + std::to_wstring(int(result->inference_ms)) +
                  L" ms  |  result age " + std::to_wstring(now_ms() - result->pose.timestamp_ms) +
                  L" ms" + (result->recording ? L"  |  RECORDING" : L"") +
                  (result->waiting ? L"  |  Waiting to resume" : L""));
    }
    const auto status_brush = CreateSolidBrush(palette().surface);
    RECT status_bar{0, client.bottom - 32, client.right, client.bottom};
    FillRect(dc, &status_bar, status_brush);
    DeleteObject(status_brush);
    SetTextColor(dc, palette().text);
    RECT status_text{16, client.bottom - 32, client.right - 16, client.bottom};
    const auto status_label = wide(message);
    DrawTextW(dc, status_label.c_str(), -1, &status_text,
              DT_SINGLELINE | DT_VCENTER | DT_END_ELLIPSIS);
}
void App::update_grid_view(const std::shared_ptr<const Snapshot>& result) {
    if (stroke) {
        return; // Keep the complete projection stable during one drawing operation.
    }
    const auto& rect = editor_grid;
    grid_view = {};
    grid_view.left = float(rect.left);
    grid_view.top = float(rect.top);
    grid_view.side = float(rect.right - rect.left);
    grid_snapshot = result;
    if (!body_view || !result || !result->video || !result->grid.valid ||
        now_ms() - result->pose.timestamp_ms > 250) {
        return;
    }
    const auto& video = *result->video;
    if (video.width <= 1 || video.height <= 1) {
        return;
    }
    const float fit = std::min(float(rect.right - rect.left) / video.width,
                               float(rect.bottom - rect.top) / video.height);
    const float width = video.width * fit, height = video.height * fit;
    grid_view.preview = {rect.left + (rect.right - rect.left - width) * .5f,
                         rect.top + (rect.bottom - rect.top - height) * .5f, width, height,
                         result->pose.aspect};
    grid_view.grid = draft.space == CoordinateSpace::Body ? result->grid : result->reference_grid;
    grid_view.live = grid_view.grid.valid && grid_view.grid.scale > 0;
}
void App::paint_editor(HDC dc) {
    RECT client{};
    GetClientRect(edit_window, &client);
    const int inspector_offset = int(client.right) - 1040;
    FillRect(dc, &client, background_brush);
    SelectObject(dc, font);
    SetBkMode(dc, TRANSPARENT);
    std::shared_ptr<const Snapshot> result;
    RECT inspector{570 + inspector_offset, 0, client.right - 20, client.bottom - 20};
    FillRect(dc, &inspector, surface_brush);
    SetTextColor(dc, palette().muted);
    const auto current_layers = ui::layers(draft);
    const int heading_y = 108;
    const wchar_t* heading = studio_view == 2     ? L"TEST / LIVE FEEDBACK"
                             : inspector_tab == 5 ? L"MOVEMENT / IDENTITY & ACTION"
                             : editor_help        ? L"DRAWING HELP"
                             : inspector_tab == 3 ? L"BODY PARTS / MANAGE EXISTING ZONES"
                             : inspector_tab == 0 ? L"ZONES / CURRENT STEP"
                             : inspector_tab == 1 ? L"Finger rules / scope and anatomy"
                             : inspector_tab == 4 ? L"Interaction / hand sign and hold time"
                                                  : L"Recording / review before conversion";
    TextOutW(dc, 580 + inspector_offset, heading_y, heading, int(wcslen(heading)));
    if (studio_view != 2 && (editor_help || (current_layers.empty() && inspector_tab == 3))) {
        const auto hint = [&](int y, const wchar_t* text) {
            TextOutW(dc, 580 + inspector_offset, y, text, int(wcslen(text)));
        };
        if (editor_help) {
            hint(heading_y + 40, L"Choose a body part, a colour, then draw on the grid.");
            hint(heading_y + 68, L"Green: pass through. Red: avoid. Yellow: fire action.");
            hint(heading_y + 96, L"Place the coloured cells where the tracked point should go.");
            hint(heading_y + 124,
                 L"Select: drag a rectangle. Ctrl keeps selection; Delete removes it.");
            hint(heading_y + 152, L"Each body part has a layer; together they form the input.");
            hint(heading_y + 180, L"Same number: alternatives. Reach any 1, then any 2.");
        } else {
            hint(heading_y + 56, L"No layers yet. Choose a body part and draw.");
            hint(heading_y + 84, L"Drawing help is available below.");
        }
    }
    SelectObject(dc, heading_font ? heading_font : font);
    SetTextColor(dc, palette().text);
    RECT movement_title{24, 12, 390, 48};
    const auto movement_name = wide(draft.name.empty() ? "New movement" : draft.name);
    DrawTextW(dc, movement_name.c_str(), -1, &movement_title, DT_SINGLELINE | DT_END_ELLIPSIS);
    SelectObject(dc, font);
    if (studio_view == 2) {
        RECT help{580 + inspector_offset, 144, client.right - 24, 216};
        const wchar_t* text = L"Start the camera, then follow the coloured zones.\nTesting never "
                              L"sends keyboard input.";
        DrawTextW(dc, text, -1, &help, DT_WORDBREAK);
    }
    const int list_height = std::max(80, int(client.bottom) - 520);
    if (studio_view != 2) {
        TextOutW(dc, 312, 66, L"Point for new / selected zones", 30);
    }
    if (studio_view != 2 && inspector_tab == 0 && !editor_help) {
        RECT explanation{580 + inspector_offset, 218, client.right - 24, 256};
        const wchar_t* text = scope == 0
            ? L"These conditions apply throughout the movement."
            : L"Steps run one after another. Route order applies to the cells inside this step.";
        DrawTextW(dc, text, -1, &explanation, DT_WORDBREAK);
        if (selected_constraint >= 0) {
        for (const auto [text, x] :
             {std::pair{L"X", 580}, {L"Y", 690}, {L"Width", 800}, {L"Height", 910}}) {
            TextOutW(dc, x + inspector_offset, 312 + list_height, text, int(wcslen(text)));
        }
        }
    } else if (studio_view != 2 && inspector_tab == 2 && !editor_help) {
        TextOutW(dc, 580 + inspector_offset, client.bottom - 152, L"Trim samples [start, end)", 24);
    }
    std::vector<RecordedTrace> traces;
    int test_index;
    {
        std::lock_guard lock(state_mutex);
        result = snapshot;
        traces = reviewed_recording.traces();
        test_index = testing;
    }
    update_grid_view(result);
    if (grid_view.live) {
        result = grid_snapshot;
    }
    const auto& rect = editor_grid;
    FillRect(dc, &rect, surface_brush);
    const auto pixel = [&](Vec2 point) {
        const auto p = grid_view.screen(point);
        return POINT{LONG(std::lround(p.x)), LONG(std::lround(p.y))};
    };
    const int saved = SaveDC(dc);
    IntersectClipRect(dc, rect.left, rect.top, rect.right, rect.bottom);
    if (grid_view.live && result && result->video) {
        const auto& video = *result->video;
        const auto& view = grid_view.preview;
        BITMAPINFO bitmap{};
        bitmap.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
        bitmap.bmiHeader.biWidth = video.width;
        bitmap.bmiHeader.biHeight = -video.height;
        bitmap.bmiHeader.biPlanes = 1;
        bitmap.bmiHeader.biBitCount = 32;
        StretchDIBits(dc, int(view.left + view.width) - 1, int(view.top), -int(view.width),
                      int(view.height), 0, 0, video.width, video.height, video.bgrx.data(), &bitmap,
                      DIB_RGB_COLORS, SRCCOPY);
    }
    const auto grid_pen = CreatePen(PS_SOLID, 1, palette().border);
    const auto previous_pen = SelectObject(dc, grid_pen);
    for (int cell = Grid::min_cell; cell <= Grid::max_cell; ++cell) {
        const auto a = pixel({float(cell), float(Grid::min_cell)}),
                   b = pixel({float(cell), float(Grid::max_cell)});
        const auto c = pixel({float(Grid::min_cell), float(cell)}),
                   d = pixel({float(Grid::max_cell), float(cell)});
        MoveToEx(dc, a.x, a.y, nullptr);
        LineTo(dc, b.x, b.y);
        MoveToEx(dc, c.x, c.y, nullptr);
        LineTo(dc, d.x, d.y);
    }
    SelectObject(dc, previous_pen);
    DeleteObject(grid_pen);
    std::vector<const SpatialConstraint*> all;
    const auto labels = ui::constraint_labels(draft);
    for (const auto& item : draft.constraints) {
        all.push_back(&item);
    }
    for (std::size_t step_index = 0; step_index < draft.steps.size(); ++step_index) {
        const auto& step = draft.steps[step_index];
        for (const auto& item : step.constraints) {
            all.push_back(&item);
        }
    }
    const InputProgress* progress = nullptr;
    if (result && test_index >= 0 && std::size_t(test_index) < config.motions.size() &&
        config.motions[test_index] == draft && !new_input) {
        progress = &ui::displayed_progress(result->progress, result->mirrored_progress);
    }
    const int focused_landmark = landmarks[selection(edit_window, Members)].index;
    std::vector<std::size_t> paint_order;
    for (int focused = 0; focused < 2; ++focused) {
        for (std::size_t i = 0; i < all.size(); ++i) {
            if ((all[i]->landmark == focused_landmark) == (focused != 0)) {
                paint_order.push_back(i);
            }
        }
    }
    for (const auto index : paint_order) {
        const auto& item = *all[index];
        if (!layer_visible[item.landmark]) {
            continue;
        }
        auto cell = item.cell;
        if (progress && progress->mirrored) {
            cell.x = 9 - cell.x - cell.width;
        }
        const POINT corners[]{pixel({float(cell.x), float(cell.y)}),
                              pixel({float(cell.x + cell.width), float(cell.y)}),
                              pixel({float(cell.x + cell.width), float(cell.y + cell.height)}),
                              pixel({float(cell.x), float(cell.y + cell.height)})};
        const auto color = constraint_color(item.type);
        const auto fill = CreateSolidBrush(
            blended(color, palette().surface, item.priority == Priority::High ? 0.50f : 0.10f));
        RECT region{corners[0].x, corners[0].y, corners[0].x, corners[0].y};
        for (const auto p : corners) {
            region.left = std::min(region.left, p.x);
            region.right = std::max(region.right, p.x);
            region.top = std::min(region.top, p.y);
            region.bottom = std::max(region.bottom, p.y);
        }
        auto state = ConstraintStatus::Missing;
        if (progress && index < progress->constraints.size()) {
            state = progress->constraints[index];
        }
        const bool highlighted =
            state != ConstraintStatus::Missing && state != ConstraintStatus::LandmarkLost;
        const auto& editable = current_constraints();
        const bool selected_cell =
            region_selection.includes(item.id) ||
            (selected_constraint >= 0 && std::size_t(selected_constraint) < editable.size() &&
             &editable[selected_constraint] == &item);
        const auto pen = CreatePen(
            item.priority == Priority::Low && !highlighted ? PS_DOT : PS_SOLID,
            highlighted || selected_cell ? 3 : 1,
            state == ConstraintStatus::Forbidden || state == ConstraintStatus::FingerInvalid ||
                    state == ConstraintStatus::SignMismatch
                ? RGB(255, 70, 90)
            : state == ConstraintStatus::HandMissing ? RGB(255, 210, 60)
            : selected_cell                          ? palette().accent
            : highlighted
                ? palette().text
                : blended(color, palette().surface, item.priority == Priority::Low ? .5f : 1.f));
        const auto old = SelectObject(dc, pen);
        const auto brush = SelectObject(dc, grid_view.live || item.landmark != focused_landmark
                                                ? GetStockObject(NULL_BRUSH)
                                                : fill);
        Polygon(dc, corners, 4);
        SelectObject(dc, brush);
        SelectObject(dc, old);
        DeleteObject(pen);
        DeleteObject(fill);
        SetTextColor(dc, color);
        if (item.priority == Priority::High) {
            SetTextColor(dc, item.landmark == focused_landmark ? palette().text : palette().muted);
            const auto label = wide(labels[index]);
            DrawTextW(dc, label.c_str(), int(label.size()), &region,
                      DT_CENTER | DT_VCENTER | DT_SINGLELINE);
        }
    }
    if (region_selection.dragging) {
        const auto first = region_selection.origin, last = region_selection.end;
        const POINT corners[]{pixel(first), pixel({last.x, first.y}), pixel(last),
                              pixel({first.x, last.y})};
        const auto pen = CreatePen(PS_DOT, 1, palette().accent);
        const auto old_pen = SelectObject(dc, pen);
        const auto old_brush = SelectObject(dc, GetStockObject(NULL_BRUSH));
        Polygon(dc, corners, 4);
        SelectObject(dc, old_brush);
        SelectObject(dc, old_pen);
        DeleteObject(pen);
    }
    for (const auto& trace : traces) {
        if (!layer_visible[trace.landmark]) {
            continue;
        }
        const auto pen = CreatePen(PS_SOLID, 2, RGB(120, 150, 255));
        const auto old = SelectObject(dc, pen);
        for (std::size_t index = 0; index < trace.points.size(); ++index) {
            const auto point = pixel({trace.points[index][0], trace.points[index][1]});
            if (!index) {
                MoveToEx(dc, point.x, point.y, nullptr);
            } else {
                LineTo(dc, point.x, point.y);
            }
        }
        SelectObject(dc, old);
        DeleteObject(pen);
    }
    if (result && result->grid.valid && now_ms() - result->pose.timestamp_ms <= 250) {
        const auto& basis =
            draft.space == CoordinateSpace::Body ? result->grid : result->reference_grid;
        const auto body_pen =
            CreatePen(PS_SOLID, 2, blended(palette().text, palette().surface, .6f));
        const auto old_pen = SelectObject(dc, body_pen);
        for (const auto [a, b] : {std::pair{11, 12},
                                  {11, 13},
                                  {13, 15},
                                  {12, 14},
                                  {14, 16},
                                  {11, 23},
                                  {12, 24},
                                  {23, 24},
                                  {23, 25},
                                  {25, 27},
                                  {24, 26},
                                  {26, 28}}) {
            const auto first = body_point(result->pose, a), second = body_point(result->pose, b);
            if (first.confidence < .6f || second.confidence < .6f) {
                continue;
            }
            const auto p =
                pixel(basis.local({first.position.x * result->pose.aspect, first.position.y}));
            const auto q =
                pixel(basis.local({second.position.x * result->pose.aspect, second.position.y}));
            MoveToEx(dc, p.x, p.y, nullptr);
            LineTo(dc, q.x, q.y);
        }
        SelectObject(dc, old_pen);
        DeleteObject(body_pen);
#ifdef MIG_NATIVE_HANDS
        draw_hands(dc, *result, [&](Vec2 metric) { return pixel(basis.local(metric)); });
#endif
        std::array<bool, 34> shown{};
        const auto selected_landmark = landmarks[selection(edit_window, Members)];
        const int physical_landmark = progress && progress->mirrored
                                          ? mirrored_landmark(selected_landmark.index)
                                          : selected_landmark.index;
        for (auto landmark : landmarks) {
            if (shown[landmark.index]) {
                continue;
            }
            shown[landmark.index] = true;
            const auto observed = body_point(result->pose, landmark.index);
            if (observed.confidence < 0.6f) {
                continue;
            }
            const auto point = pixel(
                basis.local({observed.position.x * result->pose.aspect, observed.position.y}));
            const auto brush = CreateSolidBrush(palette().accent);
            const auto old = SelectObject(dc, brush);
            Ellipse(dc, point.x - 4, point.y - 4, point.x + 5, point.y + 5);
            SelectObject(dc, old);
            DeleteObject(brush);
            SetTextColor(dc, palette().text);
            if (landmark.index == physical_landmark) {
                const auto text = wide(ui::landmark_label(physical_landmark));
                TextOutW(dc, point.x + 7, point.y, text.c_str(), int(text.size()));
            }
        }
    }
    RestoreDC(dc, saved);
    SetTextColor(dc, palette().muted);
    const auto view_text = grid_view.live ? L"Body view / live shoulder scale"
                           : body_view    ? L"Full grid / waiting for camera calibration"
                                          : L"Full grid / authoring";
    RECT view_label{234, client.bottom - 88, 550, client.bottom - 66};
    DrawTextW(dc, view_text, -1, &view_label, DT_SINGLELINE | DT_END_ELLIPSIS);
    SetTextColor(dc, palette().muted);
    std::wstring summary =
        L"Required: green | Forbidden: red | Trigger: yellow | Interaction: purple";

    if (progress && studio_view == 2) {
        summary = L"Step " + std::to_wstring(progress->step + 1) + L"/" +
                  std::to_wstring(draft.steps.size()) +
                  (progress->failed      ? L"  INVALID"
                   : progress->triggered ? L"  TRIGGERED"
                   : progress->active    ? L"  In progress"
                                         : L"  Waiting for entry / finger rules") +
                  (progress->mirrored ? L"  Mirrored" : L"") +
                  (!progress->active && !progress->triggered && ui::needs_fingers(draft)
                       ? L"  Finger rules not yet validated"
                   : progress->fingers_valid ? L"  Fingers valid / unconstrained"
                                             : L"  Input/step finger rule not satisfied (Details)");
        std::size_t index = 0;
        bool explained = false;
        const auto explain = [&](const auto& constraints) {
            for (const auto& cell : constraints) {
                const auto current = index++;
                if (explained || !cell.interaction || current >= progress->constraints.size()) {
                    continue;
                }
                const auto state = progress->constraints[current];
                if (state != ConstraintStatus::Holding && state != ConstraintStatus::HandMissing &&
                    state != ConstraintStatus::SignMismatch) {
                    continue;
                }
                const auto& settings = *cell.interaction;
                const int side = progress->mirrored ? 1 - int(settings.hand) : int(settings.hand);
                summary += side == 0 ? L" | Left " : L" | Right ";
                summary += wide(gesture_names[int(settings.gesture)]);
                if (state == ConstraintStatus::Holding) {
                    summary += L" holding " +
                               std::to_wstring(progress->interaction_elapsed_ms[current]) + L"/" +
                               std::to_wstring(settings.hold_ms) + L" ms";
                } else if (state == ConstraintStatus::HandMissing) {
                    summary += L": hand/fingers not detected";
                } else if (result) {
                    summary += L": detected " +
                               wide(gesture_names[int(observed_gesture(
                                   result->pose.fingers[side], result->pose.hand_contacts[side]))]);
                }
                explained = true;
            }
        };
        explain(draft.constraints);
        for (const auto& step : draft.steps) {
            explain(step.constraints);
        }
        RECT status_rect{580 + inspector_offset, 180, client.right - 24, client.bottom - 24};
        DrawTextW(dc, summary.c_str(), -1, &status_rect, DT_SINGLELINE | DT_END_ELLIPSIS);
    }
}
} // namespace mig::app
