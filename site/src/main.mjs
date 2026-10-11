import { Assistance } from "./assistance.mjs";
import { AwayEasterEgg } from "./away-easter-egg.mjs";
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
import { translations, phoneTranslations } from "./translations.mjs";
import { SlideController } from "./slides.mjs";
import { PresenceMonitor } from "./presence.mjs";
import { bodyPresent } from "./body-presence.mjs";
import { centralFrameRadius } from "./hand-focus.mjs";
import { cameraError, createCameraSession } from "./camera.mjs";

const element = id => document.getElementById(id);
const phone = matchMedia("(pointer: coarse)").matches && Math.min(innerWidth, innerHeight) <= 800;
const requiredHands = phone ? 1 : 2;
const pageText = () => phone ? { ...translations[language], ...phoneTranslations[language] } : translations[language];
const slides = new SlideController(translations.fr.slides.length, settings.slideDelay);
const presence = new PresenceMonitor(settings);
const awayEasterEgg = new AwayEasterEgg(element("away-easter-egg"));
const cameraSwipes = new CameraSwipes({ startRadius: centralFrameRadius, requiredHands });
const ribbon = new SlideRibbon(element("slide"));
const illustration = new HistoryIllustration(element("history-illustration"));
const framing = new CameraFraming(document.querySelector(".camera-preview"), requiredHands);
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
let debugPanel = null;
let debugWanted = false;
let debugLoading = null;

async function toggleDebug() {
    debugWanted = !debugWanted;
    if (!debugPanel && debugWanted) {
        debugLoading ??= import("./debug-panel.mjs").then(({ DebugPanel }) => {
            debugPanel = new DebugPanel(element("camera-video"), toggleDebug);
        });
        await debugLoading;
    }
    if (debugPanel && debugPanel.active !== debugWanted) debugPanel.toggle(language);
    cameraSwipes.onReject = debugPanel?.active
        ? (landmark, reason) => debugPanel.event(landmark === 15 ? "left_wrist" : "right_wrist", reason)
        : null;
    if (!debugPanel?.active) return;
    if (session?.state.running) updateDebug(session, performance.now());
    else debugPanel.stopped();
}

function updateDebug(currentSession, time) {
    if (!debugPanel?.active) return;
    debugPanel.update(currentSession, time, {
        gate: away ? "away" : !handScrollReady ? "onboarding" : !cameraSwipes.canTrack(currentSession) ? "framing"
            : cooldown.locked ? "cooldown" : null,
        guide: assistance.step,
        horizontal: assistance.practice || slideFocused()
    }, cameraSwipes, settings.presenceConfidence);
}
document.body.classList.toggle("phone", phone);
if (phone) {
    document.querySelectorAll(".hand-pair").forEach(icon => icon.setAttribute("viewBox", "0 0 100 100"));
}
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
    requiredHands,
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
    presentationComplete: () => slides.index === slides.count - 1,
    navigate: action => {
        guide.resume();
        if (action === "scroll_presentation") { guide.navigate(1); cooldown.start(true); }
        else { slides.gesture(action, performance.now()); renderSlide(); cooldown.start(false, ribbon.animation); }
    }
});

function renderSlide() {
    const text = pageText();
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
    assistance.slideChanged();
}

function setStatus(nextStatus) {
    status = nextStatus;
    const text = pageText();
    element("camera-status").textContent = ["searching", "tracking"].includes(status)
        ? (demoStarted ? text.frameHands : text.cameraHint) : text[status];
    element("camera-status").hidden = !element("camera-status").textContent;
}

function renderLanguage() {
    const text = pageText();
    theme.render();
    assistance.render();
    if (debugPanel?.active) debugPanel.setLanguage(language);
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
    const text = pageText();
    element("camera-placement").textContent = text.cameraPlacement;
    element("hands-tip").querySelector("[data-text=handsOutside]").textContent = text.handsOutside;
    element("hands-tip").querySelector("[data-text=handsShort]").textContent = text.handsShort;
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
    const handsVisible = cameraSwipes.canStart(currentSession);
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
    if (handScrollReady && cameraSwipes.canTrack(currentSession) && (!cooldown.locked || cooldown.sampling) && !away) {
        for (const action of cameraSwipes.update(currentSession, time, { horizontal: assistance.practice || slideFocused() })) {
            handleAction({ action, centred: true });
            if (cooldown.locked) break;
        }
    } else cameraSwipes.reset();
    presence.update(bodyPresent(currentSession, settings.presenceConfidence), time);
    updatePresence(time);
    updateDebug(currentSession, time);
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
    awayEasterEgg.update(time, away && detected === false);
}

function handleAction(event) {
    const gate = away ? "away" : !session?.state.running ? "stopped"
        : !handScrollReady ? "onboarding" : !cameraSwipes.canTrack(session) ? "framing"
            : cooldown.locked ? "cooldown" : null;
    if (gate) {
        if (gate === "framing") cameraSwipes.reset();
        debugPanel?.event(event.action, gate);
        return;
    }
    const sourceLandmark = event.id?.endsWith("left_wrist") ? 15
        : event.id?.endsWith("right_wrist") ? 16 : null;
    if (!event.centred && !cameraSwipes.isArmed(performance.now(), session, sourceLandmark)) {
        debugPanel?.event(event.action, "unarmed");
        return;
    }
    if (assistance.action(event.action)) { debugPanel?.event(event.action, "guide"); return; }
    if (event.action === "scroll_presentation" || event.action === "scroll_previous") {
        if (guide.navigate(event.action === "scroll_presentation" ? 1 : -1)) {
            debugPanel?.event(event.action, "accepted");
            demoStarted = true;
            renderHandInstructions();
            setStatus(status);
            cooldown.start(true);
            cameraSwipes.reset();
        } else {
            debugPanel?.event(event.action, "boundary");
            boundaries.show(element("page-content"), event.action === "scroll_previous" ? "top" : "bottom");
            cooldown.start();
            cameraSwipes.reset();
        }
        return;
    }
    if (slideFocused() && slides.gesture(event.action, performance.now())) {
        debugPanel?.event(event.action, "accepted");
        demoStarted = true;
        renderHandInstructions();
        setStatus(status);
        cameraSwipes.reset();
        guide.completeSwipe();
        renderSlide();
        cooldown.start(false, ribbon.animation);
    } else {
        debugPanel?.event(event.action, "outside");
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
    awayEasterEgg.reset();
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
    debugPanel?.stopped();
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
    if (event.key.toLowerCase() === "c" && !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey
        && !event.target.closest("input, textarea, select, [contenteditable]")) {
        event.preventDefault();
        void toggleDebug();
    }
    if (event.key === "Escape") stopCamera();
});
document.addEventListener("visibilitychange", () => {
    awayEasterEgg.reset();
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
window.addEventListener("pagehide", () => {
    awayEasterEgg.reset();
    clearInterval(presenceTimer);
    session?.dispose();
});
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
