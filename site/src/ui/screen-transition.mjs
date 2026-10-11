// Fade the black cover while keeping camera tracking alive underneath it.
export class ScreenTransition {
    constructor(screen, content) {
        this.screen = screen;
        this.content = content;
        this.timer = null;
        this.motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
    }

    cancel() {
        clearTimeout(this.timer);
        this.timer = null;
    }

    hide() {
        this.cancel();
        this.content.inert = true;
        this.screen.hidden = false;
        this.screen.getBoundingClientRect(); // Establish the transparent starting frame.
        this.screen.classList.add("is-dark");
        document.body.classList.add("is-away");
        const finish = () => { this.content.hidden = true; };
        if (this.motionPreference.matches) finish();
        else this.timer = setTimeout(finish, 650);
    }

    reveal() {
        this.cancel();
        this.content.hidden = false;
        this.content.inert = false;
        document.body.classList.remove("is-away");
        this.screen.classList.remove("is-dark");
        const finish = () => { this.screen.hidden = true; };
        if (this.motionPreference.matches) finish();
        else this.timer = setTimeout(finish, 650);
    }

    reset() {
        this.cancel();
        this.content.hidden = false;
        this.content.inert = false;
        this.screen.hidden = true;
        this.screen.classList.remove("is-dark");
        document.body.classList.remove("is-away");
    }
}
