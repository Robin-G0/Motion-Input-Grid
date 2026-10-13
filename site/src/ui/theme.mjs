// Follow the system until the visitor chooses a palette; remember that choice.
export class ThemeToggle {
    constructor(button, text) {
        this.button = button;
        this.text = text;
        this.system = matchMedia("(prefers-color-scheme: dark)");
        this.choice = null;
        try {
            const saved = localStorage.getItem("mig-theme");
            if (["dark", "light"].includes(saved)) this.choice = saved;
        } catch { /* Storage can be unavailable in private browsing. */ }
        button.addEventListener("click", () => {
            this.choice = this.dark ? "light" : "dark";
            try { localStorage.setItem("mig-theme", this.choice); } catch { /* Keep the in-page choice. */ }
            this.render();
        });
        this.system.addEventListener("change", () => this.render());
    }

    get dark() {
        return this.choice ? this.choice === "dark" : this.system.matches;
    }

    render() {
        if (this.choice) document.documentElement.dataset.theme = this.choice;
        else delete document.documentElement.dataset.theme;
        this.button.textContent = this.dark ? "\u2600" : "\u263e";
        this.button.setAttribute("aria-label", this.text()[this.dark ? "lightTheme" : "darkTheme"]);
        this.button.title = this.button.getAttribute("aria-label");
        this.button.setAttribute("aria-pressed", String(this.dark));
        const icon = this.dark ? "./favicon-dark.svg" : "./favicon.svg";
        for (const node of document.querySelectorAll('link[rel="icon"], img.brand-mark')) {
            const attribute = node.tagName === "LINK" ? "href" : "src";
            if (node.getAttribute(attribute) !== icon) node.setAttribute(attribute, icon);
        }
        for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
            meta.content = this.dark ? "#0b101a" : "#f7f4ed";
        }
    }
}
