#pragma once
#include <mig/core/engine.hpp>

namespace mig::app {
// Both applications and their editor read the same persisted switch.
constexpr bool hand_tracking_requested(const Configuration& profile) noexcept {
    return profile.track_hands;
}
// Controllers only run the hand model while a rule or command needs hand
// observations; Studio keeps the explicit switch so authors can preview hands.
inline bool hand_inference_required(const Configuration& profile) noexcept {
    return profile.track_hands && uses_hand_observations(profile);
}
} // namespace mig::app
