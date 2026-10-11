export class SlideController {
    constructor(count, delay = 800) {
        this.count = count;
        this.delay = delay;
        this.index = 0;
        this.gift = false;
        this.giftOffered = false;
        this.lastGestureAt = -Infinity;
        this.direction = 0;
    }

    get entries() {
        const entries = Array.from({ length: this.count }, (_, index) => index);
        if (this.gift) entries.splice(1, 0, "gift");
        return entries;
    }

    get position() { return this.entries.indexOf(this.index); }
    canMove(direction) {
        const target = this.position + Math.sign(direction);
        return target >= 0 && target < this.entries.length;
    }

    move(direction) {
        const entries = this.entries;
        const target = Math.max(0, Math.min(entries.length - 1, this.position + direction));
        const previous = this.index;
        this.direction = Math.sign(direction);
        this.index = entries[target];
        if (previous === "gift" && this.index !== previous) this.gift = false;
        return this.index;
    }

    select(index) {
        this.direction = Math.sign(index - (typeof this.index === "number" ? this.index : 1));
        this.index = index;
        this.gift = false;
    }

    gesture(action, time) {
        const direction = { next_slide: 1, previous_slide: -1 }[action];
        if (!direction || !this.canMove(direction) || time - this.lastGestureAt < this.delay) return false;
        this.lastGestureAt = time;
        const offer = direction === 1 && this.index === 0 && !this.giftOffered;
        this.move(direction);
        if (offer) {
            this.gift = true;
            this.giftOffered = true;
        }
        return true;
    }
}
