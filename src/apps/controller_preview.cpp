#include "app.hpp"
#include "preview_drawing.hpp"
#include <cmath>
namespace mig::app {
using namespace preview_drawing;
namespace {
template <class Project> void draw_grid(HDC dc, const Grid& basis, Project pixel) {
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
template <class Project>
void draw_regions(HDC dc, const Motion& input, const InputProgress& progress, const Grid& basis,
                  Project pixel) {
    std::size_t index = 0;
    const auto cells = [&](const auto& constraints) {
        for (const auto& constraint : constraints) {
            auto cell = constraint.cell;
            if (progress.mirrored) {
                cell.x = 9 - cell.x - cell.width;
            }
            const auto state = index < progress.constraints.size() ? progress.constraints[index]
                                                                   : ConstraintStatus::Missing;
            ++index;
            const bool reacting = state == ConstraintStatus::Validated ||
                                  state == ConstraintStatus::Triggered ||
                                  state == ConstraintStatus::Holding;
            const bool invalid =
                state == ConstraintStatus::Forbidden || state == ConstraintStatus::FingerInvalid ||
                state == ConstraintStatus::HandMissing || state == ConstraintStatus::SignMismatch ||
                state == ConstraintStatus::LandmarkLost;
            const auto color = invalid    ? RGB(242, 87, 105)
                               : reacting ? RGB(255, 255, 255)
                                          : constraint_color(constraint.type);
            const auto pen = CreatePen(PS_SOLID, reacting ? 3 : 2, color);
            const auto old_pen = SelectObject(dc, pen);
            const auto old_brush = SelectObject(dc, GetStockObject(NULL_BRUSH));
            const POINT corners[]{
                pixel(basis.metric({float(cell.x), float(cell.y)})),
                pixel(basis.metric({float(cell.x + cell.width), float(cell.y)})),
                pixel(basis.metric({float(cell.x + cell.width), float(cell.y + cell.height)})),
                pixel(basis.metric({float(cell.x), float(cell.y + cell.height)}))};
            Polygon(dc, corners, 4);
            SelectObject(dc, old_brush);
            SelectObject(dc, old_pen);
            DeleteObject(pen);
            const auto center =
                pixel(basis.metric({cell.x + cell.width / 2.f, cell.y + cell.height / 2.f}));
            RECT label{center.x - 25, center.y - 10, center.x + 25, center.y + 10};
            SetTextColor(dc, color);
            const auto order = std::to_wstring(constraint.order);
            DrawTextW(dc, order.c_str(), -1, &label, DT_CENTER | DT_SINGLELINE);
        }
    };
    cells(input.constraints);
    for (const auto& step : input.steps) {
        cells(step.constraints);
    }
}
template <class Project> void draw_body(HDC dc, const Frame& pose, Project pixel) {
    const auto pen = CreatePen(PS_SOLID, 1, RGB(48, 195, 135));
    const auto brush = CreateSolidBrush(RGB(48, 195, 135));
    const auto previous_pen = SelectObject(dc, pen), previous_brush = SelectObject(dc, brush);
    for (int landmark = 0; landmark < 34; ++landmark) {
        const auto point = body_point(pose, landmark);
        if (point.confidence < .6f || !std::isfinite(point.position.x) ||
            !std::isfinite(point.position.y)) {
            continue;
        }
        const auto location = pixel({point.position.x * pose.aspect, point.position.y});
        Ellipse(dc, location.x - 3, location.y - 3, location.x + 4, location.y + 4);
    }
    SelectObject(dc, previous_brush);
    SelectObject(dc, previous_pen);
    DeleteObject(brush);
    DeleteObject(pen);
}
} // namespace
void App::paint_controller_preview(HDC dc, RECT area) {
    std::shared_ptr<const VideoFrame> video;
    std::shared_ptr<const Snapshot> result;
    {
        std::lock_guard lock(capture_mutex);
        video = latest;
    }
    {
        std::lock_guard lock(state_mutex);
        result = snapshot;
    }
    FillRect(dc, &area, reinterpret_cast<HBRUSH>(GetStockObject(BLACK_BRUSH)));
    video_rect = area;
    if (video && !video->bgrx.empty() && video->width > 0 && video->height > 0) {
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
            draw_grid(dc, basis, pixel);
        }
        if (controller_verify && result->inspected == int(selected) &&
            selected < config.motions.size() && basis.valid) {
            draw_regions(dc, config.motions[selected],
                         ui::displayed_progress(result->progress, result->mirrored_progress), basis,
                         pixel);
        }
        if (show_dots) {
            draw_body(dc, result->pose, pixel);
        }
#ifdef MIG_NATIVE_HANDS
        if (show_hands) {
            draw_hands(dc, *result, pixel);
        }
#endif
        RestoreDC(dc, saved);
    }
}
void App::paint(HDC dc) {
    RECT client{};
    GetClientRect(window, &client);
    FillRect(dc, &client, background_brush);
    SelectObject(dc, font);
    SetBkMode(dc, TRANSPARENT);
    SetTextColor(dc, palette().text);
    if (controller_compact) {
        const auto name = profiles && profiles->selected() >= 0
                              ? wide(profiles->entries()[profiles->selected()].name)
                              : L"No profile";
        RECT label{16, 12, client.right - 112, 44};
        DrawTextW(dc, name.c_str(), -1, &label, DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);
    } else {
        SelectObject(dc, heading_font ? heading_font : font);
        TextOutW(dc, 16, 16, L"MIG Input", 9);
        SelectObject(dc, font);
        SetTextColor(dc, palette().muted);
        TextOutW(dc, 16, 56, L"Your movements, ready to run.", 29);
        const int session_y = profile_management ? 212 : 128;
        TextOutW(dc, 16, session_y, L"SESSION", 7);
        TextOutW(dc, 16, session_y + 64, L"MOVEMENTS / LIVE FEEDBACK", 25);
        if (controller_camera) {
            paint_controller_preview(dc,
                                     {16, session_y + 92, client.right - 332, client.bottom - 50});
        }
    }
    std::string value;
    {
        std::lock_guard lock(state_mutex);
        value = status;
    }
    if (controller_verify) {
        value = "Verification: select a binding. Keyboard output is paused.";
    }
    const auto label = wide(value);
    RECT bar{16, client.bottom - 36, client.right - 16, client.bottom - 8};
    SetTextColor(dc, palette().muted);
    DrawTextW(dc, label.c_str(), -1, &bar, DT_SINGLELINE | DT_VCENTER | DT_END_ELLIPSIS);
}
} // namespace mig::app
