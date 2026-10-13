const palettes = {
    spring: ["#b7d9cc", "#759d88"],
    summer: ["#f4dcc2", "#94ad85"],
    autumn: ["#e4c5b5", "#ac8272"],
    winter: ["#cddde9", "#a5b9ca"]
};

const weatherSkies = {
    rain: ["#182532", "#7b91a3"],
    snow: ["#1b2939", "#687f99"],
    storm: ["#252930", "#252930"]
};

function skyChannels(scene, daylight) {
    const [night, day] = weatherSkies[scene.weather] ?? ["#101827", palettes[scene.season][0]];
    return [1, 3, 5].map(offset => {
        const dark = parseInt(night.slice(offset, offset + 2), 16);
        const light = parseInt(day.slice(offset, offset + 2), 16);
        return dark + (light - dark) * daylight;
    });
}

function rgb(channels) {
    return `rgb(${channels.map(Math.round).join(", ")})`;
}

function fraction(index, seed) {
    const value = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453;
    return value - Math.floor(value);
}

function ease(value) {
    const progress = Math.max(0, Math.min(1, value));
    return progress * progress * (3 - 2 * progress);
}

export class AwaySky {
    constructor(canvas) {
        this.canvas = canvas;
        this.context = canvas.getContext("2d", { alpha: false });
        this.stars = Array.from({ length: 42 }, (_, index) => ({
            x: fraction(index, 1), y: fraction(index, 2), radius: 1 + fraction(index, 3)
        }));
        this.drops = Array.from({ length: 32 }, (_, index) => ({
            x: fraction(index, 4), y: fraction(index, 5)
        }));
        this.confetti = Array.from({ length: 36 }, (_, index) => ({
            x: fraction(index, 6), y: fraction(index, 7)
        }));
    }

    resize() {
        this.width = innerWidth;
        this.height = innerHeight;
        const scale = Math.min(devicePixelRatio || 1, 2);
        this.canvas.width = Math.round(this.width * scale);
        this.canvas.height = Math.round(this.height * scale);
        this.context.setTransform(scale, 0, 0, scale, 0, 0);
    }

    reset() {
        this.skyChannels = null;
        this.colorAge = null;
        this.props = null;
        this.propAge = null;
    }

    propOpacities(scene, reducedMotion) {
        const wet = ["rain", "storm", "snow"].includes(scene.weather);
        const targets = {
            sun: !scene.night && !wet ? 1 : 0,
            moon: scene.night && scene.weather !== "storm" ? 1 : 0,
            stars: scene.weather !== "storm" ? 1 : 0,
            cloud: wet ? 1 : 0,
            rain: ["rain", "storm"].includes(scene.weather) ? 1 : 0,
            snow: scene.weather === "snow" ? 1 : 0,
            rainbow: scene.weather === "rainbow" && !scene.night ? 1 : 0
        };
        if (!this.props || scene.age < this.propAge) {
            this.props = Object.fromEntries(Object.entries(targets).map(([key, target]) =>
                [key, { from: reducedMotion ? target : 0, to: target, since: scene.age }]));
        }
        const opacity = {};
        for (const [key, target] of Object.entries(targets)) {
            const prop = this.props[key];
            // Use real elapsed time, independent of orbit slowdown and frame rate.
            const current = prop.from + (prop.to - prop.from) * ease((scene.age - prop.since) / 900);
            if (reducedMotion) {
                prop.from = prop.to = target;
                prop.since = scene.age;
                opacity[key] = target;
            } else {
                if (prop.to !== target) Object.assign(prop, { from: current, to: target, since: scene.age });
                opacity[key] = current;
            }
        }
        this.propAge = scene.age;
        return opacity;
    }

    circle(x, y, radius, color) {
        const context = this.context;
        context.fillStyle = color;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
    }

    skyGradient(scene, daylight) {
        const target = skyChannels(scene, daylight);
        const elapsed = scene.age - (this.colorAge ?? scene.age);
        if (!this.skyChannels || elapsed < 0) this.skyChannels = target;
        const blend = 1 - Math.exp(-Math.max(0, elapsed) / 450);
        this.skyChannels = this.skyChannels.map((value, index) =>
            value + (target[index] - value) * blend);
        this.colorAge = scene.age;
        const gradient = this.context.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, rgb(this.skyChannels.map(value => value * .72)));
        gradient.addColorStop(1, rgb(this.skyChannels));
        return gradient;
    }

    draw(scene, reducedMotion) {
        const context = this.context;
        if (scene.complete) {
            context.globalAlpha = 1;
            context.fillStyle = "#000";
            context.fillRect(0, 0, this.width, this.height);
            this.drawConfetti(scene.celebration, reducedMotion);
            context.globalAlpha = 1;
            return;
        }
        const elapsedScene = scene;
        const opacity = this.propOpacities(scene, reducedMotion);
        scene = { ...scene, age: scene.motionAge ?? scene.age };
        const colors = palettes[scene.season];
        const progress = reducedMotion ? .4 : scene.progress;
        const daylight = scene.night ? 0 : Math.sin(Math.PI * scene.progress);
        const background = this.skyGradient(scene, daylight);
        context.globalAlpha = 1;
        context.fillStyle = background;
        context.fillRect(0, 0, this.width, this.height);
        this.drawStars(scene, daylight, reducedMotion, opacity.stars);
        if (!scene.night && opacity.sun > 0) this.drawCelestial(false, progress, opacity.sun);
        if (scene.night && opacity.moon > 0) this.drawCelestial(true, progress, opacity.moon);
        this.drawWeather(scene, daylight, reducedMotion, opacity);
        this.drawHorizon(colors[1], scene.weather === "storm" ? 0 : daylight);
        this.drawStormFlash(scene, reducedMotion);
        if (elapsedScene.fade > 0) {
            context.globalAlpha = elapsedScene.fade;
            context.fillStyle = "#000";
            context.fillRect(0, 0, this.width, this.height);
        }
        this.drawConfetti(scene.celebration, reducedMotion);
        context.globalAlpha = 1;
    }

    drawStars(scene, daylight, reducedMotion, opacity = 1) {
        const context = this.context;
        for (const [index, star] of this.stars.entries()) {
            const shimmer = reducedMotion ? 1 : .8 + .2 * Math.sin(scene.age / 1300 + index);
            const appearance = reducedMotion ? 1 : Math.min(1, scene.age / 2000);
            context.globalAlpha = (1 - daylight) * appearance * shimmer * opacity;
            this.circle(star.x * this.width, star.y * this.height * .7, star.radius, "#f2eddb");
        }
    }

    drawCelestial(night, progress, opacity = 1) {
        const context = this.context;
        const orbit = Math.min(this.width * .42, this.height * .68);
        const angle = Math.PI * (1 + progress) + .22 * (2 * progress - 1);
        const x = this.width * .5 + Math.cos(angle) * orbit;
        const y = this.height * .98 + Math.sin(angle) * orbit;
        const radius = Math.max(28, Math.min(52, this.width * .045));
        context.globalAlpha = opacity;
        if (!night) { this.circle(x, y, radius, "#f5c967"); return; }
        // Draw the crescent as one shape so fading preserves its cutout.
        const cutX = x + radius * .4;
        const cutY = y - radius * .3;
        const cutRadius = radius * .87;
        const distance = radius * .5;
        const along = (radius ** 2 - cutRadius ** 2 + distance ** 2) / (2 * distance);
        const across = Math.sqrt(radius ** 2 - along ** 2);
        const first = { x: x + along * .8 + across * .6, y: y - along * .6 + across * .8 };
        const second = { x: x + along * .8 - across * .6, y: y - along * .6 - across * .8 };
        context.fillStyle = "#f2eddb";
        context.beginPath();
        context.arc(x, y, radius, Math.atan2(first.y - y, first.x - x), Math.atan2(second.y - y, second.x - x));
        context.arc(cutX, cutY, cutRadius, Math.atan2(second.y - cutY, second.x - cutX), Math.atan2(first.y - cutY, first.x - cutX), true);
        context.closePath();
        context.fill();
    }

    drawHorizon(color, daylight) {
        const context = this.context;
        context.globalAlpha = 1;
        context.fillStyle = "#1b2835";
        context.beginPath();
        context.moveTo(0, this.height * .83);
        context.bezierCurveTo(this.width * .3, this.height * .68,
            this.width * .6, this.height * .96, this.width, this.height * .78);
        context.lineTo(this.width, this.height);
        context.lineTo(0, this.height);
        context.closePath();
        context.fill();
        context.globalAlpha = daylight;
        context.fillStyle = color;
        context.fill();
    }

    weatherPosition(scene, reducedMotion) {
        const size = Math.max(20, Math.min(38, this.width * .04));
        const margin = Math.max(size * 2, Math.min(this.width * .25, this.height * .3));
        const drift = Math.max(0, this.width / 2 - margin) * .8;
        const wind = reducedMotion ? 0 : Math.sin(scene.age / 3000) * drift;
        const x = this.width * .5 + wind;
        return { x, y: this.height * .27, size };
    }

    drawCloud({ x, y, size }) {
        const context = this.context;
        context.fillStyle = "#e4eaf0";
        context.beginPath();
        for (const [offsetX, offsetY, radius] of [[-1, .2, .8], [0, -.2, 1], [1, .1, .8]]) {
            const centreX = x + size * offsetX;
            const centreY = y + size * offsetY;
            context.moveTo(centreX + size * radius, centreY);
            context.arc(centreX, centreY, size * radius, 0, Math.PI * 2);
        }
        context.fill();
    }

    drawWeather(scene, daylight, reducedMotion, opacity = {
        cloud: ["rain", "storm", "snow"].includes(scene.weather) ? 1 : 0,
        rain: ["rain", "storm"].includes(scene.weather) ? 1 : 0,
        snow: scene.weather === "snow" ? 1 : 0,
        rainbow: scene.weather === "rainbow" && !scene.night ? 1 : 0
    }) {
        const context = this.context;
        const cloud = this.weatherPosition(scene, reducedMotion);
        context.globalAlpha = opacity.cloud;
        if (opacity.cloud > 0) this.drawCloud(cloud);
        if (opacity.rainbow > 0) {
            context.globalAlpha = .9 * opacity.rainbow;
            context.lineWidth = 7;
            const x = cloud.x;
            const y = this.height * .98;
            const radius = Math.max(48, Math.min(this.width * .25, this.height * .3));
            for (const [index, color] of ["#ee657f", "#f5a653", "#f6da65", "#62c795", "#65acec", "#b28be0"].entries()) {
                context.strokeStyle = color;
                context.beginPath();
                context.arc(x, y, radius - index * 8, Math.PI, 2 * Math.PI);
                context.stroke();
            }
        }
        for (const weather of ["rain", "snow"]) {
            const type = weather === "rain" && scene.weather === "storm" ? "storm" : weather;
            if (opacity[weather] > 0) this.drawPrecipitation({ ...scene, weather: type }, cloud, daylight, reducedMotion, opacity[weather]);
        }
    }

    drawPrecipitation(scene, cloud, daylight, reducedMotion, opacity) {
        const context = this.context;
        context.globalAlpha = opacity;
        context.strokeStyle = scene.weather === "storm" || daylight < .4 ? "#c9e7ff" : "#284c68";
        context.lineWidth = 2.5;
        const top = cloud.y + cloud.size;
        const height = Math.max(0, this.height - top);
        context.save();
        context.beginPath();
        context.rect(cloud.x - cloud.size * 1.8, top, cloud.size * 3.6, height);
        context.clip();
        for (const drop of this.drops) {
            const x = cloud.x + (drop.x - .5) * cloud.size * 3;
            const speed = scene.weather === "snow" ? 5500 : 1400;
            const fall = reducedMotion ? 0 : scene.age / speed;
            const y = top + ((drop.y + fall) % 1) * height;
            if (scene.weather === "snow") this.circle(x, y, 3, "#fff");
            else {
                context.beginPath();
                context.moveTo(x, y);
                context.lineTo(x - 3, y + 12);
                context.stroke();
            }
        }
        context.restore();
    }

    drawStormFlash(scene, reducedMotion) {
        if (scene.weather !== "storm" || reducedMotion) return;
        const pulse = scene.age % 4800;
        if (pulse < 3200 || pulse >= 3380) return;
        const context = this.context;
        context.globalAlpha = .4 * Math.sin((pulse - 3200) / 180 * Math.PI);
        context.fillStyle = "#fff";
        context.fillRect(0, 0, this.width, this.height);
    }

    drawConfetti(elapsed, reducedMotion) {
        if (elapsed === null || elapsed > 4500) return;
        const context = this.context;
        const progress = reducedMotion ? .5 : elapsed / 4500;
        const colors = ["#ed9ea6", "#f3c779", "#a9d0b6", "#9dbfd6", "#c0abd1"];
        context.globalAlpha = Math.min(1, (1 - progress) * 3) * (reducedMotion ? 1 : ease(elapsed / 500));
        for (const [index, piece] of this.confetti.entries()) {
            const x = this.width / 2 + (piece.x - .5) * this.width * progress;
            const y = this.height * .42 - Math.sin(progress * Math.PI) * this.height * .3
                + piece.y * this.height * progress;
            context.fillStyle = colors[index % colors.length];
            context.fillRect(x, y, 5, 9);
        }
    }
}
