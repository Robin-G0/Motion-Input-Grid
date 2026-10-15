import {latestControllerDownloads} from "../src/controller-downloads.mjs";
const texts={
    "en": {
        "title": "Turn your gestures into key presses",
        "intro": "Download the Controller, import your profile and use your gestures in your applications.",
        "file": "Keep the mig-profile.json file exported from Studio.",
        "back": "Back to Studio",
        "download": "Download the Controller",
        "release": "View the latest available release",
        "loading": "Checking the latest release downloads...",
        "ready": "Choose your system to start the download. The desktop Studio is not required.",
        "pending": "Controller-only files are not yet published for every system. The available release includes a bundle: extract it and keep its files together.",
        "unavailable": "Downloads could not be verified. Open the latest available release below.",
        "linuxNote": "Linux: allow execution in the file properties. Keyboard output requires X11. Check the release system requirements.",
        "openTitle": "1. Open the Controller",
        "open": "Run the downloaded file. On Windows, the first launch explains where its local runtime will be stored. Choose Continue. Import profile is visible when no profiles are saved.",
        "smartTitle": "SmartScreen warning on Windows?",
        "smart": "For a file downloaded from the official MIG release, choose More info, then Run anyway if you trust it. On a managed computer, ask your administrator if this is blocked.",
        "importTitle": "2. Import your profile",
        "activateTitle": "3. Start, enable keys and minimize",
        "activate": "Click Start, keep both shoulders visible and test HI. Switch Keyboard: Off to Keyboard: On, then minimize the window and focus your presentation. Raise your left wrist to send Right Arrow. Use Stop to pause.",
        "openAlt": "Current Windows Controller with Import profile visible and keyboard output off.",
        "importAlt": "Actual import review listing the HI movement and Right key.",
        "activateAlt": "Current Controller after importing HI, with Keyboard: On. Capture has not started in this screenshot.",
        "illustration": "Actual Windows application screenshots. The Linux layout differs. Enable output only after testing the gesture.",
        "import": "Click Import profile, select mig-profile.json and check the listed keys. Choose Import reviewed profile. Later, find Import profile under Manage profile."
    },
    "fr": {
        "title": "Passez de vos gestes aux touches",
        "intro": "Téléchargez le Controller, importez votre profil et utilisez vos gestes dans vos applications.",
        "file": "Gardez le fichier mig-profile.json exporté depuis Studio.",
        "back": "Retour au Studio",
        "download": "Télécharger le Controller",
        "release": "Voir la dernière version disponible",
        "loading": "Recherche des téléchargements de la dernière version...",
        "ready": "Choisissez votre système pour démarrer le téléchargement. Le Studio de bureau n’est pas nécessaire.",
        "pending": "Les fichiers Controller seuls ne sont pas encore publiés pour tous les systèmes. La version disponible contient un pack : extrayez-le et gardez ses fichiers ensemble.",
        "unavailable": "Les téléchargements n’ont pas pu être vérifiés. Ouvrez la dernière version disponible ci-dessous.",
        "linuxNote": "Linux : autorisez l’exécution dans les propriétés du fichier. La sortie clavier nécessite X11. Vérifiez les prérequis de la version.",
        "openTitle": "1. Ouvrez le Controller",
        "open": "Lancez le fichier téléchargé. Sur Windows, le premier lancement indique où sera stocké le runtime local. Cliquez sur Continue. Import profile est visible lorsqu’aucun profil n’est enregistré.",
        "smartTitle": "Alerte SmartScreen sur Windows ?",
        "smart": "Pour un fichier téléchargé depuis la release officielle MIG, choisissez Informations complémentaires puis Exécuter quand même si vous lui faites confiance. Sur un ordinateur géré, demandez à votre administrateur si cela est bloqué.",
        "importTitle": "2. Importez votre profil",
        "activateTitle": "3. Démarrez, activez les touches et réduisez",
        "activate": "Cliquez sur Start, gardez les deux épaules visibles et testez HI. Passez de Keyboard: Off à Keyboard: On, puis réduisez la fenêtre et sélectionnez votre présentation. Levez le poignet gauche pour envoyer la flèche droite. Stop permet de faire une pause.",
        "openAlt": "Controller Windows actuel avec Import profile visible et sortie clavier désactivée.",
        "importAlt": "Véritable fenêtre de vérification de HI avec la touche Right.",
        "activateAlt": "Controller actuel après import de HI, avec Keyboard: On. Le suivi n’est pas démarré dans cette capture.",
        "illustration": "Captures réelles de l’application Windows. La disposition Linux diffère. Activez les touches après avoir testé le geste.",
        "import": "Cliquez sur Import profile, choisissez mig-profile.json et vérifiez les touches. Validez avec Import reviewed profile. Par la suite, Import profile se trouve sous Manage profile."
    }
};
let language=new URLSearchParams(location.search).get("lang") ?? (navigator.language.startsWith("fr")?"fr":"en");
if(!texts[language])language="en";
let status="loading";
function render(){document.documentElement.lang=language;for(const node of document.querySelectorAll("[data-copy]"))node.textContent=texts[language][node.dataset.copy];for(const node of document.querySelectorAll("[data-alt]"))node.alt=texts[language][node.dataset.alt];document.getElementById("release-status").textContent=texts[language][status];for(const node of document.querySelectorAll("[data-language]"))node.setAttribute("aria-pressed",String(node.dataset.language===language));}
for(const button of document.querySelectorAll("[data-language]"))button.onclick=()=>{language=button.dataset.language;render();};
render();
try{
    const downloads=await latestControllerDownloads();
    for(const [platform,url] of Object.entries(downloads)){const link=document.getElementById(`${platform}-download`);link.href=url;link.hidden=false;}
    status=downloads.windows&&downloads.linux?"ready":"pending";
}catch{status="unavailable";}
render();
