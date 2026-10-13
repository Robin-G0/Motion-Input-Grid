export class Journal {
    constructor(list, empty, count, announcement, text) {
        this.list = list; this.empty = empty; this.count = count; this.announcement = announcement; this.text = text;
        this.entries = []; this.level = "actions"; this.actions = 0;
    }
    add(level, message) {
        this.entries.push({ level, message, at: new Date() });
        if (this.entries.length > 100) this.entries.shift();
        if (level === "action") { this.actions++; this.announcement.textContent = `${this.text("actionDetected")} : ${message}`; }
        this.render();
    }
    clear() { this.entries = []; this.actions = 0; this.announcement.textContent = ""; this.render(); }
    render() {
        const entries = this.entries.filter(entry => this.level === "debug" || entry.level === "action"
            || (this.level === "info" && ["info", "error"].includes(entry.level)));
        const fragment = document.createDocumentFragment();
        for (const entry of entries.toReversed()) {
            const row = document.createElement("li"); row.dataset.level = entry.level;
            const at = document.createElement("time"); at.dateTime = entry.at.toISOString();
            at.textContent = entry.at.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
            const message = document.createElement("span"); message.textContent = entry.message;
            row.append(at, message); fragment.append(row);
        }
        const scroll = this.list.scrollTop;
        this.list.replaceChildren(fragment); this.list.scrollTop = scroll;
        this.empty.hidden = entries.length !== 0;
        this.count.textContent = `${this.actions} ${this.text("action")}`;
    }
}
