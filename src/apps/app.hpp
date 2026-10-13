#pragma once
#include "../controller/profiles.hpp"
#include "action_output.hpp"
#include "authoring.hpp"
#include "camera.hpp"
#include "editor_tools.hpp"
#include "keybindings.hpp"
#include "paint_buffer.hpp"
#include "pose.hpp"
#include "preview.hpp"
#include "tracking_policy.hpp"
#include <algorithm>
#include <atomic>
#include <commdlg.h>
#include <condition_variable>
#include <deque>
#include <functional>
#include <iostream>
#include <map>
#include <mig/core/session.hpp>
#include <mig/format/configuration.hpp>
#include <mutex>
#include <optional>
#include <thread>
#include <tuple>
#include <windows.h>
#include <windowsx.h>
namespace mig::app {
using namespace mig::native;
#ifdef MIG_CONFIGURATOR
constexpr bool editor = true;
constexpr wchar_t title[] = L"Motion Input Grid Studio";
#else
constexpr bool editor = false;
constexpr wchar_t title[] = L"Motion Input Grid Controller";
#endif
enum {
    Start = 101,
    Stop,
    Calibrate,
    Load,
    Save,
    Commit,
    Clear,
    Undo,
    Trigger,
    Members,
    BrushOrder,
    MotionList,
    ActionId,
    Key,
    TriggerIndex,
    Keys,
    NewMotion,
    TrackHands,
    NewConfig,
    Redo,
    EditInput,
    TestInput,
    DeleteInput,
    RestartTest,
    Theme,
    Logs,
    RemoteControls,
    InputName,
    Mirror,
    Space,
    Duration,
    StepList,
    AddStep,
    DeleteStep,
    StepUp,
    StepDown,
    StepModeId,
    HoldTime,
    Tool,
    ConstraintList,
    ConstraintTypeId,
    PriorityId,
    CellX,
    CellY,
    CellWidth,
    CellHeight,
    UpdateConstraint,
    DeleteConstraint,
    ConstraintUp,
    ConstraintDown,
    FingerScope,
    FingerHand,
    FingerId,
    FingerPoseId,
    AddFinger,
    DeleteFinger,
    FingerList,
    RecordLandmarks,
    RecordToggle,
    ConvertRecording,
    DiscardRecording,
    TrimBegin,
    TrimEnd,
    TrimRecording,
    RestartBinding,
    RecalibrateBinding,
    RecordBinding,
    ApplyControls,
    CopyInput,
    PasteInput,
    DuplicateInput,
    StopTest,
    FileMenu,
    EditMenu,
    ViewMenu,
    ViewGrid,
    ViewHands,
    ViewDots,
    GridViewMode,
    ThemeDark,
    ThemeLight,
    ConstraintsTab,
    FingersTab,
    RecordingTab,
    RecordAll,
    StudioMovements,
    StudioEdit,
    StudioTest,
    MovementTab,
    NameCaption,
    ActionCaption,
    SpaceCaption,
    PaintRequired,
    PaintForbidden,
    PaintTrigger,
    PaintInteraction,
    DrawSelect,
    DrawPencil,
    DrawBucket,
    DrawEraser,
    DrawContour,
    KeyCaption,
    DurationCaption,
    Cooldown,
    CooldownCaption,
    LayerList,
    ToggleLayer,
    DeleteLayer,
    EditorHelp,
    TraceMove,
    TraceDelete,
    LayersTab,
    InteractionHand,
    InteractionGesture,
    InteractionHold,
    InteractionCaption,
    SetInteraction,
    FingerStable,
    FingerGrace,
    FingerTimingCaption,
    InteractionTab,
    EditKeys,
    KeyTokens,
    KeyExpression,
    KeySequenceList,
    KeyError,
    KeyApply,
    KeyCancel,
    BindingSummary,
    ActionModeId,
    RepeatInterval,
    ActionModeCaption,
    RepeatCaption,
    LayerBodyPart,
    SaveLayer,
    LayerCaption,
    ProfileList,
    ProfileName,
    RenameProfile,
    CameraView,
    VerifyView,
    CompactView,
    OpenView,
    ProfileManagement,
    ClearFingers
};
struct Snapshot {
    std::shared_ptr<const VideoFrame> video;
    Frame pose;
#ifdef MIG_NATIVE_HANDS
    hands::Frame hands;
#endif
    Grid grid, reference_grid;
    InputProgress progress, mirrored_progress;
    std::array<bool, 64> actions_active{};
    int inspected{-1};
    float inference_ms{};
    bool hands_active{}, waiting{}, recording{};
};
struct Palette {
    COLORREF background, surface, text, muted, accent, border, primary, hover, selected;
};
struct EditorDocument {
    Motion input;
    Recorder recording;
};
struct App {
    bool review_import(const Configuration& proposed);
    std::unique_ptr<controller::Profiles> profiles;
    bool controller_camera{}, controller_compact{}, controller_verify{}, profile_management{};
    std::atomic<bool> preview_enabled{true};
    RECT expanded_bounds{};
    int verification{-1};
    void restore_profiles();
    void activate_profile(std::size_t index);
    void refresh_profiles();
    void controller_file(bool saving);
    void controller_view(int command);
    void paint_controller_preview(HDC dc, RECT area);
#ifdef MIG_APP_TESTS
    int controller_ui_test();
#endif
    PaintBuffer preview_buffer, editor_buffer;
    HWND window{}, edit_window{}, log_window{}, control_window{}, key_window{}, details_window{};
    HFONT font{}, mono_font{}, heading_font{};
    HBRUSH background_brush{}, surface_brush{};
    bool dark{true}, logs_visible{}, keyboard_enabled{}, updating_controls{};
    bool diagnostic_mode{};
    bool show_grid{}, show_hands{}, show_dots{};
    std::uint64_t shown_log_version{}, log_version{};
    Configuration config;
    std::filesystem::path config_path, directory;
    unsigned camera_index{};
    PoseModel pose_model{PoseModel::Lite};
    std::atomic<bool> running{};
    std::unique_ptr<Camera> camera;
    std::jthread capture_thread, inference_thread;
    std::mutex capture_mutex, state_mutex;
    std::condition_variable capture_ready;
    std::shared_ptr<const VideoFrame> latest;
    std::uint64_t latest_sequence{};
    std::shared_ptr<const Snapshot> snapshot;
    std::string status = "Camera stopped. Open or create a configuration.";
    std::deque<std::string> log;
    std::deque<Event> pending_events;
    // UI-only last accepted trigger times, keyed by stable input ID.
    std::unordered_map<std::string, std::int64_t> triggered_inputs;
    bool reload{}, recalibrate{}, restart_requested{}, record_requested{};
    bool recording_allowed{};
    std::uint64_t profile_revision{};
    int testing{-1};
    std::vector<int> recording_landmarks{15, 16};
    CoordinateSpace recording_space{CoordinateSpace::Calibrated};
    Recorder reviewed_recording;
    Recorder trace_before;
    bool trace_stroke{};
    std::size_t picked_trace{}, picked_sample{};
    std::size_t shown_record_count{};
    std::uint64_t diagnosed_sequence{};
    std::uint64_t painted_capture_sequence{}, painted_pose_sequence{};
    std::string painted_status;
    std::array<bool, 64> painted_highlights{};
    bool painted_fresh{};
    std::optional<Motion> clipboard_input;
    std::size_t selected{};
    Motion draft;
    ui::History<Configuration> document_history;
    ui::History<EditorDocument> draft_history;
    int scope{}, selected_constraint{-1}, selected_finger{-1}, typing_control{};
    bool new_input{}, stroke{};
    ui::RegionSelection region_selection;
    Motion stroke_before;
    std::pair<int, int> last_brush_cell{};
    std::uint64_t serial{};
    ui::ActionOutput keyboard_output;
    std::function<bool(int, bool)> key_sender;
    std::function<bool(char16_t, bool)> text_sender;
    std::vector<KeyboardAction> key_preview;
    std::vector<std::vector<std::string>> key_preview_rows;
    std::string key_error;
    RECT video_rect{}, editor_grid{};
    ui::GridView grid_view;
    std::shared_ptr<const Snapshot> grid_snapshot;
    bool body_view{true};
    int studio_view{}; // 0: movements, 1: edit, 2: test
    bool editor_help{};
    std::array<bool, 34> layer_visible{};
    std::vector<int> layer_members;
    int editing_layer{-1};
    int inspector_tab{};
    bool dialog_open{};
    Palette palette() const noexcept;
    void update_theme();
    void toggle_logs();
    void layout();
    void layout_editor();
    void update_grid_view(const std::shared_ptr<const Snapshot>& result);
    void draw_control(const DRAWITEMSTRUCT& item);
    void paint(HDC dc);
    void paint_editor(HDC dc);
    void refresh_list();
    void select_motion();
    void open_editor(bool creating = false, bool test = false);
    void show_studio_view(int view);
    void refresh_editor();
    void refresh_layers();
    bool layer_change_pending() const;
    void sync_interaction_hand();
    std::vector<SpatialConstraint>& current_constraints();
    std::vector<FingerConstraint>& current_fingers();
    bool editor_layer_selection(int id, int notification);
    bool editor_drawing_tools(int id, int notification);
    bool editor_views(int id, int notification);
    bool editor_navigation(int id, int notification);
    bool editor_settings(int id, int notification);
    bool editor_session_command(int id);
    void edit_authoring(int id);
    void update_constraint();
    void delete_constraint();
    void reorder_constraint(int id);
    void update_interaction();
    void add_finger();
    void delete_finger();
    void delete_layer();
    void editor_command(int id, int notification);
    void change_document(Configuration proposed);
    void undo(bool redo, bool draft_scope);
    void remember_edit(const Motion& before);
    void apply();
    void file_dialog(bool saving);
    void finish_dialog();
    void click(int x, int y);
    void editor_click(int x, int y, bool begin);
    void select_regions(Vec2 point, bool begin);
    void erase_at(int x, int y);
    void set_test(bool enabled);
    void open_controls();
    void apply_controls();
    void request_restart(bool calibration);
    void request_record();
    void set_preview_hands(bool enabled);
    void wake_and_stop_workers();
    void capture_loop();
    void inference_loop();
    void message(std::string value);
    void release_keys();
    bool send_key(int key, bool release);
    bool send_text(char16_t unit, bool release);
    void open_keys();
    void update_key_preview();
    void open_binding_details();
    void stop();
    ~App();
    void start();
    void tick();
    void advance_keyboard(std::int64_t now);
    void refresh_diagnostics(const std::shared_ptr<const Snapshot>& displayed);
    void refresh_logs(const std::vector<std::string>& entries, std::uint64_t version);
};
extern App* application;
std::filesystem::path executable_directory();
std::wstring wide(std::string_view text);
std::string narrow(const std::wstring& text);
LRESULT CALLBACK procedure(HWND window, UINT msg, WPARAM wp, LPARAM lp);
LRESULT CALLBACK editor_procedure(HWND window, UINT msg, WPARAM wp, LPARAM lp);
LRESULT CALLBACK log_procedure(HWND window, UINT msg, WPARAM wp, LPARAM lp);
LRESULT CALLBACK controls_procedure(HWND window, UINT msg, WPARAM wp, LPARAM lp);
LRESULT CALLBACK keys_procedure(HWND window, UINT msg, WPARAM wp, LPARAM lp);
HWND control(HWND parent, const wchar_t* type, const wchar_t* text, int id, int x, int y, int width,
             int height, DWORD style = 0);
void position_control(HWND child, int x, int y, int width, int height);
void choices(HWND parent, int id, std::initializer_list<const wchar_t*> items);
inline RECT motion_button_rect(RECT row, int index) {
    const int width = (row.right - row.left - 36) / 3;
    const auto left = row.left + 12 + index * (width + 6);
    return {left, row.top + 104, left + width, row.top + 132};
}
int selection(HWND parent, int id);
std::string text_value(HWND parent, int id);
int integer_value(HWND parent, int id, int minimum, int maximum);
} // namespace mig::app
