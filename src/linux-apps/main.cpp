#ifdef MIG_CONTROLLER
#include "controller_window.hpp"
#else
#include "window.hpp"
#endif
#include <QApplication>
#include <QCoreApplication>
#include <QIcon>
#include <iostream>
#include <optional>
int main(int argc, char** argv) {
    QApplication application(argc, argv);
    application.setDesktopFileName(MIG_APP_NAME);
    application.setWindowIcon(QIcon(":/icons/" MIG_APP_NAME ".png"));
    try {
        std::string runtime = QCoreApplication::applicationDirPath().toStdString();
        std::string config;
        unsigned camera = 0;
        bool test = false;
        std::optional<mig::native::PoseModel> pose_model;
        for (int index = 1; index < argc; ++index) {
            const std::string option = argv[index];
            if (option == "--runtime" && index + 1 < argc) {
                runtime = argv[++index];
#ifdef MIG_APP_TESTS
            } else if (option == "--ui-test") {
                test = true;
#endif
            } else if (option == "--config" && index + 1 < argc) {
                config = argv[++index];
            } else if (option == "--camera" && index + 1 < argc) {
                camera = unsigned(std::stoul(argv[++index]));
            } else if (option.starts_with("--pose-") &&
                       mig::native::parse_pose_model(option.substr(7))) {
                pose_model = mig::native::parse_pose_model(option.substr(7));
            } else {
                throw std::runtime_error("Usage: " MIG_APP_NAME
                                         " [--runtime DIR] [--config JSON] [--camera N] "
                                         "[--pose-lite|--pose-full|--pose-heavy]");
            }
        }
#ifdef MIG_CONTROLLER
        mig::linux_ui::ControllerWindow window(runtime, camera, test);
#else
        mig::linux_ui::Window window(runtime, camera);
#endif
        if (pose_model) {
            window.set_pose_model(*pose_model);
        }
        if (!config.empty()) {
            window.load(config);
        }
        window.show();
#ifdef MIG_APP_TESTS
        if (test) {
            application.processEvents();
            return window.ui_test() ? 0 : 1;
        }
#endif
        return application.exec();
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
