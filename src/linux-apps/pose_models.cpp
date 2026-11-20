#include "pose_models.hpp"
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QUrl>
#include <memory>
#include <span>

namespace mig::linux_ui {
namespace {
constexpr auto download_name = "mig-model-download";
QString text(std::string_view value) {
    return QString::fromUtf8(value.data(), int(value.size()));
}
} // namespace
void ensure_pose_model(QObject* owner, const std::string& runtime, native::PoseModel model,
                       std::function<void(const QString&)> report, std::function<void()> ready) {
    if (!native::locate_pose_model(runtime, model).empty()) {
        ready();
        return;
    }
    if (owner->findChild<QNetworkAccessManager*>(download_name)) {
        report("A pose model download is still in progress.");
        return;
    }
    const auto& info = native::pose_model_info(model);
    const auto label = text(info.label);
    auto* manager = new QNetworkAccessManager(owner);
    manager->setObjectName(download_name);
    manager->setTransferTimeout(30000);
    QNetworkRequest request{QUrl(text(info.asset.url))};
    request.setAttribute(QNetworkRequest::RedirectPolicyAttribute,
                         QNetworkRequest::NoLessSafeRedirectPolicy);
    auto* reply = manager->get(request);
    report(QString("Downloading the %1 pose model (%2 MB)...")
               .arg(label)
               .arg((info.asset.size + 500000) / 1000000));
    const auto reported = std::make_shared<unsigned>(0);
    QObject::connect(reply, &QNetworkReply::downloadProgress, owner, [=](qint64 received, qint64) {
        if (std::uint64_t(received) > info.asset.size) {
            reply->abort(); // Larger than the pinned release: never buffer it.
            return;
        }
        const auto percent = unsigned(std::uint64_t(received) * 100 / info.asset.size);
        if (percent / 25 != *reported / 25) {
            *reported = percent;
            report(QString("Downloading the %1 pose model: %2%").arg(label).arg(percent));
        }
    });
    QObject::connect(reply, &QNetworkReply::finished, owner, [=] {
        reply->deleteLater();
        manager->deleteLater();
        manager->setObjectName({});
        if (reply->error() != QNetworkReply::NoError) {
            report("Model download failed: " + reply->errorString());
            return;
        }
        const auto bytes = reply->readAll();
        try {
            native::store_pose_model(
                model,
                std::span(reinterpret_cast<const std::uint8_t*>(bytes.constData()),
                          std::size_t(bytes.size())),
                native::model_cache_directory());
            report(label + " pose model verified and saved for offline use.");
            ready();
        } catch (const std::exception& error) {
            report(error.what());
        }
    });
}
QActionGroup* add_pose_model_menu(QMenu* view, native::PoseModel current,
                                  std::function<void(native::PoseModel)> chosen) {
    view->addSeparator();
    auto* menu = view->addMenu("Pose model");
    auto* group = new QActionGroup(menu);
    group->setExclusive(true);
    for (const auto& info : native::pose_models) {
        const auto suffix = info.model == native::PoseModel::Lite ? " (fastest)"
                            : info.model == native::PoseModel::Heavy
                                ? " (most precise, downloaded once)"
                                : "";
        auto* action = menu->addAction(text(info.label) + suffix);
        action->setCheckable(true);
        action->setChecked(info.model == current);
        action->setData(int(info.model));
        group->addAction(action);
        QObject::connect(action, &QAction::triggered, menu,
                         [chosen, model = info.model] { chosen(model); });
    }
    return group;
}
void check_pose_model(QActionGroup* group, native::PoseModel model) {
    for (auto* action : group->actions()) {
        action->setChecked(action->data().toInt() == int(model));
    }
}
} // namespace mig::linux_ui
