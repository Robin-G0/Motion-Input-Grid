export class SlideController {
    constructor(count, delay = 800) {
        this.count = count;
        this.delay = delay;
        this.index = 0;
        this.returnedToFirst = false;
        this.lastGestureAt = -Infinity;
        this.direction = 0;
    }

    move(direction) {
        const previous = this.index;
        this.direction = Math.sign(direction);
        this.index = ((this.index + direction) % this.count + this.count) % this.count;
        if (direction < 0 && previous === 1 && this.index === 0) {
            this.returnedToFirst = true;
        }
        return this.index;
    }

    gesture(action, time) {
        const direction = { next_slide: 1, previous_slide: -1 }[action];
        if (!direction || time - this.lastGestureAt < this.delay) return false;
        this.lastGestureAt = time;
        this.move(direction);
        return true;
    }
}
