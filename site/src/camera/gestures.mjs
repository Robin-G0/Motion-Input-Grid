// Coordinates belong to the anatomical body, not the mirrored camera preview.
// Either hand can sweep in either direction.
function swipe(action, landmark, startColumn, finishColumn) {
    return {
        id: `${action}_${landmark}`,
        name: action === "next_slide" ? "Sweep to advance" : "Sweep to go back",
        action,
        space: "body",
        cooldown_ms: 800,
        max_duration_ms: 2500,
        steps: [{
            id: "sweep",
            mode: "ordered",
            constraints: [
                { id: "start", landmark, cell: [startColumn, -9, 4, 27], type: "required", priority: "high", order: 1 },
                { id: "finish", landmark, cell: [finishColumn, -9, 4, 27], type: "trigger", priority: "high", order: 2 }
            ]
        }]
    };
}

export const gestureProfile = {
    schema_version: 2,
    tracking: { hands: false },
    inputs: [
        ...["left_wrist", "right_wrist"].flatMap(landmark => [
            swipe("next_slide", landmark, 0, 5),
            swipe("previous_slide", landmark, 5, 0)
        ])
    ]
};
