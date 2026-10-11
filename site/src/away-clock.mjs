const minute = 60000;
const cycleDuration = 12000;
const slowdownStart = 48000;
const slowdownDuration = minute - slowdownStart;
const seasons = ["spring", "summer", "autumn", "winter"];
const weather = [
    ["rain", "rainbow", "clear"],
    ["rain", "rainbow", "storm"],
    ["rain", "storm", "clear"],
    ["snow", "snow", "clear"]
];

export function awayScene(elapsed) {
    if (elapsed < minute) return null;
    const age = elapsed - minute;
    const complete = age >= minute;
    const slowing = Math.max(0, Math.min(1, (age - slowdownStart) / slowdownDuration));
    const easedTime = slowdownDuration * (1 - (1 - slowing) ** 3) / 3;
    const motionAge = age < slowdownStart ? age : slowdownStart + easedTime;
    const initialCycles = slowdownStart / cycleDuration + 7 * (slowdownStart / minute) ** 2;
    const initialSpeed = (1 + 14 * slowdownStart / minute) / cycleDuration;
    const cycles = age < slowdownStart ? age / cycleDuration + 7 * (age / minute) ** 2
        : initialCycles + initialSpeed * easedTime;
    const season = Math.min(3, Math.floor(age / 15000));
    const phase = cycles % 1;
    const scheduledWeather = weather[season][Math.floor(cycles) % 3];
    const currentWeather = scheduledWeather === "rainbow" && phase < .5 ? "rain" : scheduledWeather;
    return {
        age, motionAge, complete, season: seasons[season],
        fade: Math.max(0, Math.min(1, (age - 57000) / 3000)),
        weather: currentWeather,
        night: phase < .5,
        progress: (phase % .5) * 2,
        celebration: complete ? age - minute : null
    };
}
