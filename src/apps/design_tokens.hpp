#pragma once
#include <cstdint>

// Native counterparts of site/styles.css. Keep recognition colours semantic;
// surfaces, typography and interaction emphasis belong to the application shell.
namespace mig::ui::design {
struct Colors {
    std::uint32_t paper, surface, ink, muted, border, accent, primary, hover, selected;
};
constexpr Colors dark{0x0b101a, 0x131e20, 0xf2f0f7, 0xb6bbcc, 0x354043,
                      0xb7d8ce, 0x245e51, 0x263635, 0x213c35};
constexpr Colors light{0xf7f4ed, 0xffffff, 0x192332, 0x505e70, 0xcdcfc5,
                       0x246557, 0x245e51, 0xe9e8df, 0xe4eee8};
constexpr Colors palette(bool is_dark) {
    return is_dark ? dark : light;
}
} // namespace mig::ui::design
