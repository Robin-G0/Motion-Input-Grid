const minute = 60000;
const cycleDuration = 12000;
const seasons = ["spring", "summer", "autumn", "winter"];
const weather = [
    ["rain", "rainbow", "clear"],
    ["clear", "rainbow", "storm"],
    ["rain", "storm", "clear"],
    ["snow", "snow", "clear"]
];

export function awayScene(elapsed) {
    if (elapsed < minute) return null;
    const age = elapsed - minute;
    const complete = age >= minute;
    const cycles = complete ? 12 + (age - minute) / cycleDuration
        : age / cycleDuration + 7 * (age / minute) ** 2;
    const season = complete ? (3 + Math.floor((age - minute) / 36000)) % 4
        : Math.floor(age / 15000);
    const phase = cycles % 1;
    return {
        age, complete, season: seasons[season],
        weather: weather[season][Math.floor(cycles) % 3],
        night: phase < .5,
        progress: (phase % .5) * 2,
        celebration: complete ? age - minute : null
    };
}
