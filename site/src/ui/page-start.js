// Run before the page is laid out so reloads cannot restore an old scroll position.
// Ordinary visits, deep links and in-page navigation keep their usual behaviour.
if (performance.getEntriesByType("navigation")[0]?.type === "reload") {
    history.scrollRestoration = "manual";
    if (location.hash) {
        history.replaceState(history.state, "", location.pathname + location.search);
    }
    window.addEventListener("pageshow", () => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, { once: true });
}
