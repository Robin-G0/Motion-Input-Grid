const palettes = {
    spring: ["#b7d9cc", "#759d88"],
    summer: ["#f4dcc2", "#94ad85"],
    autumn: ["#e4c5b5", "#ac8272"],
    winter: ["#cddde9", "#a5b9ca"]
};

function fraction(index, seed) {
    const value = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453;
    return value - Math.floor(value);
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

    circle(x, y, radius, color) {
        const context = this.context;
        context.fillStyle = color;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
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
        scene = { ...scene, age: scene.motionAge ?? scene.age };
        const colors = palettes[scene.season];
        const progress = reducedMotion ? .4 : scene.progress;
        const daylight = scene.night ? 0 : Math.sin(Math.PI * scene.progress);
        context.globalAlpha = 1;
        context.fillStyle = "#101827";
        context.fillRect(0, 0, this.width, this.height);
        context.globalAlpha = daylight;
        context.fillStyle = colors[0];
        context.fillRect(0, 0, this.width, this.height);
        this.drawStars(scene, daylight, reducedMotion);
        this.drawCelestial(scene.night, progress);
        this.drawWeather(scene, daylight, reducedMotion);
        this.drawHorizon(colors[1], daylight);
        if (elapsedScene.fade > 0) {
            context.globalAlpha = elapsedScene.fade;
            context.fillStyle = "#000";
            context.fillRect(0, 0, this.width, this.height);
        }
        this.drawConfetti(scene.celebration, reducedMotion);
        context.globalAlpha = 1;
    }

    drawStars(scene, daylight, reducedMotion) {
        const context = this.context;
        for (const [index, star] of this.stars.entries()) {
            const shimmer = reducedMotion ? 1 : .8 + .2 * Math.sin(scene.age / 1300 + index);
            const appearance = reducedMotion ? 1 : Math.min(1, scene.age / 2000);
            context.globalAlpha = (1 - daylight) * appearance * shimmer;
            this.circle(star.x * this.width, star.y * this.height * .7, star.radius, "#f2eddb");
        }
    }

    drawCelestial(night, progress) {
        const context = this.context;
        const orbit = Math.min(this.width * .42, this.height * .68);
        const angle = Math.PI * (1 + progress);
        const x = this.width * .5 + Math.cos(angle) * orbit;
        const y = this.height * .87 + Math.sin(angle) * orbit;
        const radius = Math.max(28, Math.min(52, this.width * .045));
        context.globalAlpha = 1;
        this.circle(x, y, radius, night ? "#f2eddb" : "#f5c967");
        if (night) this.circle(x + radius * .4, y - radius * .3, radius * .87, "#101827");
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
        const wind = reducedMotion ? 0 : Math.sin(scene.age / 12000) * drift;
        const x = this.width * .5 + wind;
        return { x, y: this.height * .27, size };
    }

    drawCloud({ x, y, size }) {
        for (const [offsetX, offsetY, radius] of [[-1, .2, .8], [0, -.2, 1], [1, .1, .8]]) {
            this.circle(x + size * offsetX, y + size * offsetY, size * radius, "#e4eaf0");
        }
    }

    drawWeather(scene, daylight, reducedMotion) {
        const context = this.context;
        const cloud = this.weatherPosition(scene, reducedMotion);
        context.globalAlpha = .45 + daylight * .4;
        if (["rain", "storm", "snow"].includes(scene.weather)) this.drawCloud(cloud);
        if (scene.weather === "rainbow") {
            context.globalAlpha = daylight * .65;
            context.lineWidth = 7;
            const x = cloud.x;
            const y = this.height * .98;
            const radius = Math.max(48, Math.min(this.width * .25, this.height * .3));
            for (const [index, color] of ["#ed9ea6", "#f3c779", "#e8df97", "#a9d0b6", "#9dbfd6", "#c0abd1"].entries()) {
                context.strokeStyle = color;
                context.beginPath();
                context.arc(x, y, radius - index * 8, Math.PI, 2 * Math.PI);
                context.stroke();
            }
        }
        if (scene.weather === "storm") {
            const x = cloud.x;
            const y = cloud.y + cloud.size;
            context.fillStyle = "#f5d287";
            context.beginPath();
            for (const [index, point] of [[0, 0], [-12, 28], [2, 25], [-5, 48], [21, 15], [7, 18]].entries()) {
                context[index ? "lineTo" : "moveTo"](x + point[0], y + point[1]);
            }
            context.fill();
        }
        if (!["rain", "storm", "snow"].includes(scene.weather)) return;
        context.strokeStyle = "#c2d7e4";
        context.lineWidth = 1.5;
        const top = cloud.y + cloud.size;
        const height = Math.max(0, this.height - top);
        context.save();
        context.beginPath();
        context.rect(cloud.x - cloud.size * 1.8, top, cloud.size * 3.6, height);
        context.clip();
        for (const drop of this.drops) {
            const x = cloud.x + (drop.x - .5) * cloud.size * 3;
            const speed = scene.weather === "snow" ? 16000 : 2600;
            const fall = reducedMotion ? 0 : scene.age / speed;
            const y = top + ((drop.y + fall) % 1) * height;
            if (scene.weather === "snow") this.circle(x, y, 2.5, "#f5f6fa");
            else {
                context.beginPath();
                context.moveTo(x, y);
                context.lineTo(x - 3, y + 12);
                context.stroke();
            }
        }
        context.restore();
    }

    drawConfetti(elapsed, reducedMotion) {
        if (elapsed === null || elapsed > 4500) return;
        const context = this.context;
        const progress = reducedMotion ? .5 : elapsed / 4500;
        const colors = ["#ed9ea6", "#f3c779", "#a9d0b6", "#9dbfd6", "#c0abd1"];
        context.globalAlpha = Math.min(1, (1 - progress) * 3);
        for (const [index, piece] of this.confetti.entries()) {
            const x = this.width / 2 + (piece.x - .5) * this.width * progress;
            const y = this.height * .42 - Math.sin(progress * Math.PI) * this.height * .3
                + piece.y * this.height * progress;
            context.fillStyle = colors[index % colors.length];
            context.fillRect(x, y, 5, 9);
        }
    }
}
