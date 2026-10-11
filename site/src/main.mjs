import { Assistance } from "./assistance.mjs";
import { ThemeToggle } from "./theme.mjs";
import { NavigationInputGuard } from "./navigation-inputs.mjs";
import { CameraFraming } from "./camera-framing.mjs";
import { BoundaryFeedback } from "./boundary-feedback.mjs";
import { SlideRibbon } from "./slide-ribbon.mjs";
import { NavigationCooldown } from "./navigation-cooldown.mjs";
import { ScreenTransition } from "./screen-transition.mjs";
import { GestureGuide } from "./gesture-guide.mjs";
import { HistoryIllustration } from "./history.mjs";
import { CameraSwipes } from "./camera-swipes.mjs";
import { settings } from "./settings.mjs";
import { translations } from "./translations.mjs";
import { SlideController } from "./slides.mjs";
import { PresenceMonitor } from "./presence.mjs";
import { cameraError, createCameraSession } from "./camera.mjs";

const element = id => document.getElementById(id);
const slides = new SlideController(translations.fr.slides.length, settings.slideDelay);
const presence = new PresenceMonitor(settings);
const cameraSwipes = new CameraSwipes();
const ribbon = new SlideRibbon(element("slide"));
const illustration = new HistoryIllustration(element("history-illustration"));
const framing = new CameraFraming(document.querySelector(".camera-preview"));
const boundaries = new BoundaryFeedback(element("navigation-edge"));
const guide = new GestureGuide(element("scroll-gesture-tip"), element("slide-gesture-tip"),
    element("slide"), [element("welcome"), element("presentation"), element("presence-demo"), element("finale")],
    direction => {
        const label = element("scroll-gesture-tip").querySelector("[data-text=scrollShort]");
        const text = translations[language][direction === "down" ? "lowerShort" : "scrollShort"];
        if (label.textContent !== text) label.textContent = text;
        const description = element("scroll-gesture-tip").querySelector("[data-text=scrollTip]");
        const tip = translations[language][direction === "down" ? "lowerTip" : "scrollTip"];
        if (description.textContent !== tip) description.textContent = tip;
    });
const screenTransition = new ScreenTransition(element("away-screen"), element("page-content"));
let language = navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
let session = null;
let status = "ready";
let starting = false;
let generation = 0;
let away = false;
let returnFocus = null;
let handsMissingSince = null;
let departureStartedAt = null;
let greenSince = null;
let handScrollReady = false;
let demoStarted = false;
let presenceTimer = null;
const phone = matchMedia("(pointer: coarse)").matches && Math.min(innerWidth, innerHeight) <= 800;
document.body.classList.toggle("phone", phone);
const cooldown = new NavigationCooldown(element("navigation-cooldown"), () => {
    assistance.render();
    assistance.followViewport();
    assistance.cooldownComplete();
}, locked => {
    element("previous-slide").disabled = locked || !slides.canMove(-1);
    element("next-slide").disabled = locked || !slides.canMove(1);
    if (locked) {
        cameraSwipes.reset();
        session?.tracker?.restart?.();
        swipeStart = null;
        wheelDistance = 0;
    }
}, () => {
    assistance.followViewport();
    cameraSwipes.reset();
    session?.tracker?.restart?.();
});

const theme = new ThemeToggle(element("theme-toggle"), () => translations[language]);
const assistance = new Assistance(element("assistance"), {
    language: () => language,
    locked: () => cooldown.locked,
    running: () => Boolean(session?.state.running),
    startCamera,
    focusCamera: frameCameraPreview,
    resetGestures: () => { cameraSwipes.reset(); session?.tracker?.restart?.(); },
    pauseHints: () => guide.pauseHints(),
    resumeHints: () => { if (handScrollReady && session?.state.running) guide.start(); },
    cooldown: () => cooldown.start(),
    giftActive: () => slides.index === "gift",
    navigate: action => {
        guide.resume();
        if (action === "scroll_presentation") { guide.navigate(1); cooldown.start(true); }
        else { slides.gesture(action, performance.now()); renderSlide(); cooldown.start(false, ribbon.animation); }
    }
});

function renderSlide() {
    const text = translations[language];
    const returned = slides.index === "gift";
    const original = text.slides[returned ? 0 : slides.index];
    const slide = returned ? { ...original, tag: text.returnTag,
        title: text.returnTitle, description: text.returnDescription } : original;
    element("slide").dataset.returned = String(returned);
    element("slide").dataset.color = slide.color;
    element("slide-tag").textContent = slide.tag;
    element("slide-title").textContent = slide.title;
    element("slide-description").textContent = slide.description;
    illustration.show(returned ? 0 : slides.index, text);
    ribbon.show(slides, text);
    element("previous-slide").disabled = cooldown.locked || !slides.canMove(-1);
    element("next-slide").disabled = cooldown.locked || !slides.canMove(1);
    element("slide-number").textContent = slide.number;
    element("slide-counter").textContent = `${text.slideLabel} ${returned ? "\u{1f381}" : slides.index + 1} / ${slides.count}`;
}

function setStatus(nextStatus) {
    status = nextStatus;
    const text = translations[language];
    element("camera-status").textContent = ["searching", "tracking"].includes(status)
        ? (demoStarted ? text.frameHands : text.oneHandBeginHint) : text[status];
    element("camera-status").hidden = !element("camera-status").textContent;
}

function renderLanguage() {
    const text = translations[language];
    theme.render();
    assistance.render();
    document.documentElement.lang = language;
    document.title = text.title;
    document.querySelectorAll("[data-text]").forEach(node => {
        node.textContent = text[node.dataset.text];
    });
    document.querySelectorAll("[data-label]").forEach(node => {
        node.setAttribute("aria-label", text[node.dataset.label]);
    });
    document.querySelectorAll("[data-language]").forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.language === language));
    });
    element("phone-note").hidden = !phone;
    element("phone-note").textContent = text.phoneNote;
    renderHandInstructions();
    guide.updateFocus();
    const title = document.querySelector(".hero h1");
    if (language === "fr") {
        const ending = document.createElement("span");
        ending.className = "title-ending";
        const words = text.invitation.split(" ");
        ending.textContent = words.splice(-2).join(" ");
        title.replaceChildren(document.createTextNode(words.join(" ") + " "), ending);
    }
    renderSlide();
    setStatus(status);
}

function renderHandInstructions() {
    const text = translations[language];
    element("camera-placement").textContent = text.oneHandPlacement;
    element("hands-tip").querySelector("[data-text=handsOutside]").textContent = text.oneHandOutside;
    element("hands-tip").querySelector("[data-text=handsShort]").textContent = text.oneHandShort;
    element("scroll-gesture-tip").classList.add("one-hand");
}

function slideFocused() {
    if (guide.focusedSection() !== 1) return false;
    const bounds = element("slide").getBoundingClientRect();
    return bounds.top < innerHeight / 2 && bounds.bottom > innerHeight / 2;
}

function showPage(animate = false) {
    away = false;
    if (animate) screenTransition.reveal();
    else screenTransition.reset();
}

function handInFrame(point) {
    return point && Number.isFinite(point.x) && Number.isFinite(point.y)
        && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
}

function prepareHandScrolling(handsVisible, time) {
    if (handScrollReady) return;
    // Losing a hand breaks the continuous second of green preview.
    if (!handsVisible) greenSince = null;
    if (!handsVisible) return;
    greenSince ??= time;
    if (time - greenSince < 1000) return;
    handScrollReady = true;
    cameraSwipes.reset();
    if (assistance.step) guide.resume();
    else guide.start();
    guide.setHandsVisible(true);
}

function updateHandHint(currentSession, time) {
    const visibleHands = [15, 16].filter(index => handInFrame(currentSession.coordinate(index))).length;
    const handsVisible = visibleHands > 0;
    guide.setHandsVisible(handsVisible);
    prepareHandScrolling(handsVisible, time);
    if (handsVisible || away || !element("finale").hidden) {
        handsMissingSince = null;
        element("hands-tip").hidden = true;
        return;
    }
    // Ignore a brief tracking dropout so the hint does not flicker.
    handsMissingSince ??= time;
    element("hands-tip").hidden = time - handsMissingSince < 600;
}

function departureSectionReached() {
    return element("presence-demo").getBoundingClientRect().top < innerHeight / 2;
}

function updateDepartureTip(enabled, detected, time) {
    if (!enabled || !detected || away || !element("finale").hidden) {
        departureStartedAt = null;
        element("cover-camera-tip").hidden = true;
        element("departure-tip").hidden = true;
        return;
    }
    departureStartedAt ??= time;
    const showAlternative = time - departureStartedAt >= 10000;
    element("departure-tip").hidden = showAlternative;
    element("cover-camera-tip").hidden = !showAlternative;
}

function handlePresence(currentSession) {
    if (document.hidden || currentSession !== session || !currentSession.state.running) return;
    const time = performance.now();
    updateHandHint(currentSession, time);
    framing.update(currentSession, time);
    assistance.observe(currentSession, time, !departureSectionReached() && !away && !cooldown.locked);
    if (handScrollReady && (!cooldown.locked || cooldown.sampling) && !away) {
        for (const action of cameraSwipes.update(currentSession, time, { horizontal: assistance.practice || slideFocused() })) {
            handleAction({ action, centred: true });
            if (cooldown.locked) break;
        }
    } else cameraSwipes.reset();
    presence.update(Boolean(currentSession.coordinate(11) && currentSession.coordinate(12)), time);
    updatePresence(time);
}

function updatePresence(time) {
    if (document.hidden || !session?.state.running) return;
    const detected = presence.detected;
    // Only the final section can start the departure demo. Scrolling back up
    // clears its timer; an already hidden page still waits for the person to return.
    const departureEnabled = element("finale").hidden && (away || departureSectionReached());
    updateDepartureTip(departureEnabled, detected, time);
    if (!departureEnabled) presence.reset();
    const nextState = departureEnabled ? presence.tick(time) : "waiting";
    if (nextState === "away" && !away) {
        assistance.depart();
        guide.stop();
        cooldown.reset();
        element("hands-tip").hidden = true;
        handsMissingSince = null;
        away = true;
        returnFocus = document.activeElement;
        if (returnFocus instanceof HTMLElement) returnFocus.blur();
        screenTransition.hide();
    } else if (nextState === "present" && away) {
        showPage(true);
        guide.resume();
        element("finale").hidden = false;
        element("finale-stop-camera").hidden = false;
        element("hands-tip").hidden = true;
        cameraSwipes.reset();
        cooldown.start(true);
        setStatus("returned");
        assistance.returned();
        element("finale").scrollIntoView({ behavior: "instant", block: "center" });
        element("finale-title").tabIndex = -1;
        element("finale-title").focus({ preventScroll: true });
    } else if (detected && status === "searching") {
        setStatus("tracking");
    }
}

function handleAction(event) {
    if (away || !session?.state.running || !handScrollReady || cooldown.locked) return;
    const sourceLandmark = event.id?.endsWith("left_wrist") ? 15
        : event.id?.endsWith("right_wrist") ? 16 : null;
    if (!event.centred && !cameraSwipes.isArmed(performance.now(), session, sourceLandmark)) return;
    if (assistance.action(event.action)) return;
    if (event.action === "scroll_presentation" || event.action === "scroll_previous") {
        if (guide.navigate(event.action === "scroll_presentation" ? 1 : -1)) {
            demoStarted = true;
            renderHandInstructions();
            setStatus(status);
            cooldown.start(true);
            cameraSwipes.reset();
        } else {
            boundaries.show(element("page-content"), event.action === "scroll_previous" ? "top" : "bottom");
            cooldown.start();
            cameraSwipes.reset();
        }
        return;
    }
    if (slideFocused() && slides.gesture(event.action, performance.now())) {
        demoStarted = true;
        renderHandInstructions();
        setStatus(status);
        cameraSwipes.reset();
        guide.completeSwipe();
        renderSlide();
        cooldown.start(false, ribbon.animation);
    }
}

function stopCamera() {
    assistance.close();
    releaseCamera();
}

function failCamera(message) {
    const guided = Boolean(assistance.step);
    releaseCamera();
    setStatus(cameraError(message));
    if (guided) assistance.go("cameraError");
}

function releaseCamera() {
    clearInterval(presenceTimer);
    presenceTimer = null;
    ++generation;
    const previousSession = session;
    session = null;
    previousSession?.dispose();
    starting = false;
    presence.reset();
    framing.reset();
    cameraSwipes.reset();
    handsMissingSince = null;
    greenSince = null;
    handScrollReady = false;
    element("hands-tip").hidden = true;
    element("camera-placement").hidden = true;
    departureStartedAt = null;
    element("cover-camera-tip").hidden = true;
    element("departure-tip").hidden = true;
    guide.stop();
    cooldown.reset();
    element("finale-stop-camera").hidden = true;
    showPage();
    document.querySelector(".camera-card").classList.remove("is-running", "has-hands");
    element("start-camera").disabled = false;
    element("start-camera").hidden = false;
    element("stop-camera").hidden = true;
    element("assistance-toggle").hidden = true;
    element("start-assisted").hidden = false;
    setStatus("stopped");
    if (returnFocus instanceof HTMLElement && returnFocus.isConnected) {
        returnFocus.focus({ preventScroll: true });
    }
    returnFocus = null;
}

function revealCamera() {
    const hero = element("welcome");
    hero.querySelector("h1").hidden = true;
    hero.querySelector(".lead").hidden = true;
    hero.querySelector(".privacy").hidden = true;
    if (hero.classList.contains("camera-open")) return;
    const copy = hero.querySelector(".hero-copy");
    const before = copy.getBoundingClientRect();
    hero.classList.add("camera-open");
    hero.querySelector(".camera-card").hidden = false;
    const after = copy.getBoundingClientRect();
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        copy.animate([
            { transform: `translate(${before.left - after.left}px, ${before.top - after.top}px)` },
            { transform: "translate(0, 0)" }
        ], { duration: 600, easing: "ease-out" });
    }
}

function frameCameraPreview() {
    const preview = document.querySelector(".camera-preview");
    const video = element("camera-video");
    if (video.videoWidth && video.videoHeight) preview.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
    const bounds = preview.getBoundingClientRect();
    // Browsers can retain the old button's scroll position after the layout opens.
    if (bounds.top < 16 || bounds.bottom > innerHeight - 16) {
        window.scrollTo({
            top: scrollY + bounds.top - Math.max(16, (innerHeight - bounds.height) / 2),
            behavior: "instant"
        });
    }
}

async function startCamera() {
    if (starting || session?.state.running) return;
    revealCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unavailable");
        return;
    }
    element("finale").hidden = true;
    demoStarted = false;
    renderHandInstructions();
    const run = ++generation;
    starting = true;
    element("start-camera").disabled = true;
    element("stop-camera").hidden = false;
    element("assistance-toggle").hidden = false;
    element("start-assisted").hidden = true;
    setStatus("loading");
    try {
        // Native MIG events and camera-space movements share the navigation cooldown.
        const candidate = await createCameraSession(handleAction, handlePresence);
        if (run !== generation) {
            candidate.dispose();
            return;
        }
        session = candidate;
        await session.start(element("camera-video"), element("camera-overlay"));
        if (run !== generation) return;
        // MIGSession reports startup failures through state rather than throwing.
        if (!session.state.running) {
            console.error("MIG camera could not start:", session.state.status);
            failCamera(session.state.status);
            return;
        }
        presenceTimer = setInterval(() => updatePresence(performance.now()), 100);
        document.querySelector(".camera-card").classList.add("is-running");
        element("start-camera").hidden = true;
        setStatus("searching");
        element("camera-placement").hidden = false;
        frameCameraPreview();
        session.subscribe(state => {
            if (!state.running && !state.busy && session === candidate) {
                failCamera(state.status);
            }
        });
    } catch (error) {
        if (run === generation) {
            console.error("MIG camera could not start:", error);
            failCamera(error.name + " " + error.message);
        }
    } finally {
        if (run === generation) {
            starting = false;
            element("start-camera").disabled = false;
        }
    }
}

document.querySelectorAll("[data-link]").forEach(link => {
    link.href = settings.links[link.dataset.link];
});
document.querySelectorAll("[data-language]").forEach(button => {
    button.addEventListener("click", () => {
        language = button.dataset.language;
        renderLanguage();
    });
});
element("start-camera").addEventListener("click", startCamera);
element("start-assisted").addEventListener("click", () => { revealCamera(); assistance.open(); });
element("assistance-toggle").addEventListener("click", () => assistance.open());
// Avoid painting an off-screen camera preview while inference keeps running.
const previewObserver = new IntersectionObserver(entries => {
    document.querySelector(".camera-preview").classList.toggle("preview-offscreen", !entries[0].isIntersecting);
});
previewObserver.observe(document.querySelector(".camera-preview"));
element("stop-camera").addEventListener("click", stopCamera);
element("finale-stop-camera").addEventListener("click", stopCamera);
function moveSlide(direction) {
    if (cooldown.locked) return;
    slides.move(direction);
    renderSlide();
}

element("previous-slide").addEventListener("click", () => moveSlide(-1));
element("next-slide").addEventListener("click", () => moveSlide(1));
element("slide").addEventListener("keydown", event => {
    if (event.target !== element("slide")) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        moveSlide(event.key === "ArrowRight" ? 1 : -1);
    }
});
// A horizontal trackpad scroll to the right advances the presentation.
let wheelDistance = 0;
let lastWheelAt = -Infinity;
let lastWheelMoveAt = -Infinity;
element("slide").addEventListener("wheel", event => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    event.preventDefault();
    const time = performance.now();
    if (time - lastWheelAt > 250 || Math.sign(wheelDistance) !== Math.sign(event.deltaX)) {
        wheelDistance = 0;
    }
    lastWheelAt = time;
    const scale = event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? innerWidth : 1;
    wheelDistance += event.deltaX * scale;
    if (Math.abs(wheelDistance) < 60) return;
    if (!cooldown.locked && time - lastWheelMoveAt >= settings.slideDelay) {
        lastWheelMoveAt = time;
        moveSlide(wheelDistance > 0 ? 1 : -1);
        cooldown.start(false, ribbon.animation);
        guide.completeSwipe();
    }
    wheelDistance = 0;
}, { passive: false });

// Pointer events support touch without interfering with vertical page scrolling.
let swipeStart = null;
element("slide").addEventListener("pointerdown", event => {
    if (!cooldown.locked && event.pointerType === "touch" && !event.target.closest(".history-illustration")) {
        swipeStart = { id: event.pointerId, x: event.clientX };
    }
});
element("slide").addEventListener("pointerup", event => {
    if (!swipeStart || event.pointerId !== swipeStart.id) return;
    if (cooldown.locked) { swipeStart = null; return; }
    const distance = event.clientX - swipeStart.x;
    if (Math.abs(distance) > 60) {
        moveSlide(distance < 0 ? 1 : -1);
    }
    swipeStart = null;
});
element("slide").addEventListener("pointercancel", () => { swipeStart = null; });
document.addEventListener("keydown", event => {
    if (event.key === "Escape") stopCamera();
});
document.addEventListener("visibilitychange", () => {
    // Start new tracking intervals after tab suspension.
    cooldown.reset();
    greenSince = null;
    cameraSwipes.reset();
    if (document.hidden) guide.cancelNudge(true);
    handsMissingSince = null;
    element("hands-tip").hidden = true;
    departureStartedAt = null;
    element("cover-camera-tip").hidden = true;
    element("departure-tip").hidden = true;
    presence.pause();
});
window.addEventListener("pagehide", () => { clearInterval(presenceTimer); session?.dispose(); });
renderLanguage();

// One elastic return per wheel gesture, including its momentum tail.
let boundaryWheelActive = false;
let boundaryWheelTimer = null;
window.addEventListener("wheel", event => {
    clearTimeout(boundaryWheelTimer);
    boundaryWheelTimer = setTimeout(() => { boundaryWheelActive = false; }, 250);
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    const atTop = scrollY <= 1 && event.deltaY < 0;
    const atBottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 1 && event.deltaY > 0;
    if ((atTop || atBottom) && !boundaryWheelActive) {
        boundaryWheelActive = true;
        boundaries.show(element("page-content"), atTop ? "top" : "bottom");
    }
}, { passive: true });


// The guard drops partial wheel and touch gestures as well as held keys.
new NavigationInputGuard(() => cooldown.locked, () => {
    wheelDistance = 0;
    lastWheelAt = -Infinity;
    swipeStart = null;
});
