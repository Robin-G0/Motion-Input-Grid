#include <iostream>
#include <mig/core/engine.hpp>
#include <stdexcept>
#include <utility>

namespace {
void check(bool condition, const char* message) {
    if (!condition) {
        throw std::runtime_error(message);
    }
}

mig::Configuration profile(bool mirror = false) {
    mig::Motion motion;
    motion.id = "swipe";
    motion.space = mig::CoordinateSpace::Body;
    motion.mirror = mirror;
    motion.cooldown_ms = 900;
    motion.steps = {{"path",
                     mig::StepMode::Ordered,
                     {{"start", 15, {-9, -9, 12, 27}},
                      {"finish", 15, {6, -9, 12, 27}, mig::ConstraintType::Trigger}}}};
    return {{motion}};
}

struct Run {
    mig::Engine engine;
    std::int64_t time{};
    std::size_t events{};
    bool mirrored{};

    explicit Run(mig::Configuration configuration, bool mirror = false)
        : engine(std::move(configuration)), mirrored(mirror) {
        for (int i = 0; i < 20; ++i) {
            frame(4.5f);
        }
        check(engine.grid().valid, "Calibration must be ready");
    }

    void frame(float column) {
        mig::Frame body;
        body.timestamp_ms = body.sequence = time += 100;
        body.aspect = 1;
        body.points[11] = {{.65f, .45f}, 1};
        body.points[12] = {{.35f, .45f}, 1};
        if (engine.grid().valid) {
            const auto point = engine.grid().metric({mirrored ? 9.f - column : column, 6.f});
            body.points[mirrored ? 16 : 15] = {point, 1};
        }
        events += engine.update(body, time).size();
    }

    void hold(float column, int frames) {
        for (int i = 0; i < frames; ++i) {
            frame(column);
        }
    }

    void swipe() {
        for (int i = 1; i <= 10; ++i) {
            frame(2.5f + .4f * i);
        }
    }
};
} // namespace

int main() {
    try {
        for (bool mirror : {false, true}) {
            for (bool neutral : {false, true}) {
                Run run(profile(mirror), mirror);
                run.hold(2.5f, 2);
                run.swipe();
                check(run.events == 1, "First complete swipe must fire");
                for (int cycle = 0; cycle < 3; ++cycle) {
                    if (neutral) {
                        run.frame(4.5f);
                    }
                    run.hold(2.5f, 12);
                    run.swipe();
                    check(run.events == std::size_t(cycle + 2),
                          "Release during cooldown must rearm the next complete swipe");
                }
                run.hold(6.5f, 30);
                check(run.events == 4, "Holding the finish cannot repeat an action");
            }
        }

        Run blocked(profile());
        blocked.hold(2.5f, 2);
        blocked.swipe();
        blocked.frame(2.5f);
        // This complete crossing ends before the 900 ms cooldown expires.
        for (int i = 1; i <= 5; ++i) {
            blocked.frame(2.5f + .8f * i);
        }
        blocked.hold(6.5f, 20);
        check(blocked.events == 1, "Cooldown cannot queue or retain a suppressed crossing");
        blocked.hold(2.5f, 2);
        blocked.swipe();
        check(blocked.events == 2, "A later fresh crossing must fire once");

        Run test(profile());
        test.engine.set_test_mode(true);
        test.hold(2.5f, 2);
        test.swipe();
        test.hold(2.5f, 12);
        test.swipe();
        check(test.events == 1 && test.engine.progress(0).triggered,
              "Test mode must retain its existing result latch");
        std::cout << "Cooldown release, sparse returns, mirror and Test latch passed\n";
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
