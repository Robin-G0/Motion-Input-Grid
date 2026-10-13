#ifdef MIG_CONTROLLER
#include "controller_window.hpp"
#else
#include "window.hpp"
#endif
#include <QApplication>
#include <QCoreApplication>
#include <iostream>
int main(int argc, char** argv) {
    QApplication application(argc, argv);
    try {
        std::string runtime = QCoreApplication::applicationDirPath().toStdString();
        std::string config;
        unsigned camera = 0;
        bool test = false;
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
            } else {
                throw std::runtime_error("Usage: " MIG_APP_NAME
                                         " [--runtime DIR] [--config JSON] [--camera N]");
            }
        }
#ifdef MIG_CONTROLLER
        mig::linux_ui::ControllerWindow window(runtime, camera, test);
#else
        mig::linux_ui::Window window(runtime, camera);
#endif
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
