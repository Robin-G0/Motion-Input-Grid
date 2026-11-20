#include "../../src/apps/tracking_policy.hpp"

int main() {
    using namespace mig;
    Configuration profile;
    if (app::hand_tracking_requested(profile) || app::hand_inference_required(profile)) {
        return 1;
    }
    profile.track_hands = true;
    if (!app::hand_tracking_requested(profile)) {
        return 2;
    }
    // The switch alone does not justify the hand model: nothing reads hands yet.
    if (app::hand_inference_required(profile) || uses_hand_observations(profile)) {
        return 3;
    }
    profile.controls.recalibrate = {Gesture::V, HandSide::Right};
    if (!app::hand_inference_required(profile)) {
        return 4;
    }
    profile.controls.recalibrate = {};
    Motion input;
    input.id = "input";
    SpatialConstraint region;
    region.id = "region";
    region.type = ConstraintType::Trigger;
    input.steps.push_back({"step", StepMode::Visited, {region}});
    profile.motions.push_back(input);
    if (uses_hand_observations(profile)) {
        return 5;
    }
    profile.motions[0].steps[0].constraints[0].type = ConstraintType::Interaction;
    if (!app::hand_inference_required(profile)) {
        return 6;
    }
    profile.motions[0].steps[0].constraints[0].type = ConstraintType::Trigger;
    profile.motions[0].steps[0].fingers.push_back({});
    if (!uses_hand_observations(profile)) {
        return 7;
    }
    profile.motions[0].steps[0].fingers.clear();
    profile.motions[0].constraints.push_back(region);
    profile.motions[0].constraints[0].fingers.push_back({});
    if (!uses_hand_observations(profile)) {
        return 8;
    }
    profile.track_hands = false;
    if (app::hand_tracking_requested(profile) || app::hand_inference_required(profile)) {
        return 9;
    }
}
