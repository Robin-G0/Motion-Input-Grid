import { Assistance } from "./assistance/assistance.mjs";
import { AwayEasterEgg } from "./easter-egg/away-easter-egg.mjs";
import { ThemeToggle } from "./ui/theme.mjs";
import { NavigationInputGuard } from "./navigation/navigation-inputs.mjs";
import { SlideInputs } from "./navigation/slide-inputs.mjs";
import { CameraFraming } from "./camera/camera-framing.mjs";
import { BoundaryFeedback } from "./navigation/boundary-feedback.mjs";
import { SlideRibbon } from "./presentation/slide-ribbon.mjs";
import { NavigationCooldown } from "./navigation/navigation-cooldown.mjs";
import { ScreenTransition } from "./ui/screen-transition.mjs";
import { GestureGuide } from "./navigation/gesture-guide.mjs";
import { HistoryIllustration } from "./presentation/history.mjs";
import { CameraSwipes } from "./camera/camera-swipes.mjs";
import { settings } from "./settings.mjs";
import { translations, phoneTranslations } from "./ui/translations.mjs";
import { SlideController } from "./presentation/slides.mjs";
import { PresenceMonitor } from "./camera/presence.mjs";
import { bodyPresent } from "./camera/body-presence.mjs";
import { centralFrameRadius } from "./camera/hand-focus.mjs";
import { cameraError, createCameraSession } from "./camera/camera.mjs";

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
let recoveryMissingSince = null;
let recoveryCentredSince = null;
let recoveringHands = false;
const cameraCard = document.querySelector(".camera-card");
const cameraHome = document.createElement("div");
cameraHome.hidden = true;
cameraHome.setAttribute("aria-hidden", "true");
cameraCard.before(cameraHome);
let departureStartedAt = null;
let greenSince = null;
let handScrollReady = false;
let demoStarted = false;
let presenceTimer = null;
let debugPanel = null;
let debugWanted = false;
let debugLoading = null;
let slideInputs = null;

async function toggleDebug() {
    debugWanted = !debugWanted;
    if (!debugPanel && debugWanted) {
        debugLoading ??= import("./diagnostics/debug-panel.mjs").then(({ DebugPanel }) => {
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
        slideInputs?.reset();
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
    errorMessage: () => pageText()[status],
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
    ribbon.show(slides);
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
    const feedback = element("camera-feedback");
    feedback.hidden = !["loading", "denied", "unavailable", "error", "busyCamera", "insecureCamera", "networkCamera", "interruptedCamera"].includes(status);
    element("camera-feedback-message").textContent = feedback.hidden ? "" : text[status];
    element("camera-status").setAttribute("aria-live", feedback.hidden ? "polite" : "off");
    element("welcome").setAttribute("aria-busy", String(status === "loading"));
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
    renderSlide();
    setStatus(status);
}

function renderHandInstructions() {
    const text = pageText();
    element("camera-placement").textContent = text.cameraPlacement;
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
}

function renderCameraTargets() {
    element("camera-hand-targets").hidden = !session?.state.running || recoveringHands || away
        || !element("finale").hidden || guide.focusedSection() !== 0;
}

function resetHandRecovery() {
    const resumeHints = recoveringHands && !assistance.step && session?.state.running;
    recoveringHands = false;
    recoveryMissingSince = null;
    recoveryCentredSince = null;
    cameraCard.classList.remove("recovering-hands");
    cameraHome.hidden = true;
    element("camera-recovery").hidden = true;
    if (resumeHints) { guide.hintsPaused = false; guide.resume(); }
}

function updateHandRecovery(currentSession, time) {
    if (away || departureSectionReached() || !element("finale").hidden) {
        if (recoveringHands) resetHandRecovery();
        recoveryMissingSince = null;
        return false;
    }
    if (cameraSwipes.canStart(currentSession)) recoveryMissingSince = null;
    else recoveryMissingSince ??= time;
    if (!recoveringHands && recoveryMissingSince !== null && time - recoveryMissingSince >= 4000) {
        recoveringHands = true;
        const preview = document.querySelector(".camera-preview");
        cameraCard.style.setProperty("--camera-ratio", String(preview.clientWidth / preview.clientHeight));
        if (cameraHome.hidden) cameraHome.style.height = `${cameraCard.offsetHeight}px`;
        cameraHome.hidden = false;
        cameraCard.classList.add("recovering-hands");
        element("camera-recovery").hidden = false;
        guide.pauseHints();
    }
    if (!recoveringHands) return false;
    cameraSwipes.reset();
    currentSession.tracker?.restart?.();
    const centred = cameraSwipes.canStart(currentSession);
    recoveryCentredSince = centred ? recoveryCentredSince ?? time : null;
    if (recoveryCentredSince !== null && time - recoveryCentredSince >= 1000) {
        resetHandRecovery();
    }
    // Also ignore the frame that ends recovery: returning hands cannot navigate.
    return true;
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
    const recoveryFrame = updateHandRecovery(currentSession, time);
    renderCameraTargets();
    framing.update(currentSession, time);
    assistance.positionTarget();
    assistance.observe(currentSession, time, !departureSectionReached() && !away && !cooldown.locked);
    if (!recoveryFrame && handScrollReady && cameraSwipes.canTrack(currentSession) && (!cooldown.locked || cooldown.sampling) && !away) {
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
        resetHandRecovery();
        assistance.depart();
        guide.stop();
        cooldown.reset();
        away = true;
        returnFocus = document.activeElement;
        if (returnFocus instanceof HTMLElement) returnFocus.blur();
        screenTransition.hide();
    } else if (nextState === "present" && away) {
        showPage(true);
        guide.resume();
        element("finale").hidden = false;
        element("finale-stop-camera").hidden = false;
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
        : recoveringHands ? "onboarding"
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
    const learnedSwipe = { right: "previous_slide", left: "next_slide" }[assistance.step] === event.action;
    if (assistance.action(event.action)) {
        if (learnedSwipe) guide.completeSwipe();
        debugPanel?.event(event.action, "guide"); return;
    }
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
    const hero = element("welcome");
    hero.classList.remove("camera-open");
    cameraCard.hidden = true;
    for (const selector of ["h1", ".lead", ".privacy"]) hero.querySelector(selector).hidden = false;
    if (document.activeElement === document.body) element("start-assisted").focus({ preventScroll: true });
}

function failCamera(message) {
    const guided = Boolean(assistance.step);
    releaseCamera();
    setStatus(cameraError(message));
    if (guided) assistance.go("cameraError");
    else element("start-camera").focus({ preventScroll: true });
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
    resetHandRecovery();
    greenSince = null;
    handScrollReady = false;
    renderCameraTargets();
    debugPanel?.stopped();
    element("camera-placement").hidden = true;
    departureStartedAt = null;
    element("cover-camera-tip").hidden = true;
    element("departure-tip").hidden = true;
    guide.stop();
    guide.swipeCompleted = false;
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
        ], { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
}

function frameCameraPreview() {
    const preview = document.querySelector(".camera-preview");
    const video = element("camera-video");
    if (video.videoWidth && video.videoHeight) {
        preview.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
        cameraCard.style.setProperty("--camera-ratio", String(video.videoWidth / video.videoHeight));
    }
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
        setStatus(window.isSecureContext ? "unavailable" : "insecureCamera");
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
        for (const track of element("camera-video").srcObject?.getVideoTracks() ?? []) {
            track.addEventListener("ended", () => {
                if (session === candidate) failCamera("interrupted");
            }, { once: true });
        }
        renderCameraTargets();
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
element("camera-video").addEventListener("resize", () => {
    const video = element("camera-video");
    if (!video.videoWidth || !video.videoHeight) return;
    document.querySelector(".camera-preview").style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
    cameraCard.style.setProperty("--camera-ratio", String(video.videoWidth / video.videoHeight));
    assistance.positionTarget();
});
window.addEventListener("scroll", renderCameraTargets, { passive: true });
window.addEventListener("resize", renderCameraTargets, { passive: true });
// Avoid painting an off-screen camera preview while inference keeps running.
const previewObserver = new IntersectionObserver(entries => {
    document.querySelector(".camera-preview").classList.toggle("preview-offscreen", !entries[0].isIntersecting);
});
previewObserver.observe(document.querySelector(".camera-preview"));
element("stop-camera").addEventListener("click", stopCamera);
element("finale-stop-camera").addEventListener("click", stopCamera);
element("away-stop-camera").addEventListener("click", stopCamera);
element("camera-feedback").querySelector("a").addEventListener("click", () => {
    // Choosing the camera-free path must also cancel a pending permission or
    // model load; a late session must not start after the visitor moves on.
    stopCamera();
});
element("skip-presence").addEventListener("click", event => {
    event.preventDefault();
    element("finale").hidden = false;
    element("finale-stop-camera").hidden = !session?.state.running;
    element("finale").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    element("finale-title").tabIndex = -1;
    element("finale-title").focus({ preventScroll: true });
    assistance.followViewport();
});
function moveSlide(direction) {
    if (cooldown.locked) return;
    slides.move(direction);
    renderSlide();
}

slideInputs = new SlideInputs(element("slide"), element("previous-slide"), element("next-slide"), {
    locked: () => cooldown.locked,
    move: moveSlide,
    delay: settings.slideDelay,
    wheelComplete: () => {
        if (session?.state.running) cooldown.start(false, ribbon.animation);
        guide.completeSwipe();
    }
});

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
    resetHandRecovery();
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
new NavigationInputGuard(() => cooldown.locked, () => slideInputs.reset());
