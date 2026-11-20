#pragma once
#include "models.hpp"
#include <QActionGroup>
#include <QMenu>
#include <QObject>
#include <QString>
#include <functional>
#include <string>

namespace mig::linux_ui {
// Run `ready` on the GUI thread once the pinned model file is bundled or cached.
// A missing model is downloaded once over HTTPS, verified and published into the
// user cache; `report` receives progress and failure text. One download per owner.
void ensure_pose_model(QObject* owner, const std::string& runtime, native::PoseModel model,
                       std::function<void(const QString&)> report, std::function<void()> ready);
// Exclusive "Pose model" entries appended to a View menu.
QActionGroup* add_pose_model_menu(QMenu* view, native::PoseModel current,
                                  std::function<void(native::PoseModel)> chosen);
void check_pose_model(QActionGroup* group, native::PoseModel model);
} // namespace mig::linux_ui
