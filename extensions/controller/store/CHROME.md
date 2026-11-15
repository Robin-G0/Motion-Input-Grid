# Chrome Web Store — champs prêts à saisir

Vérifié le 1 novembre 2026. Les textes publics FR/EN sont dans `listing.fr.md` et `listing.en.md`. Les résumés et coordonnées sont dans `listing.json`. Éditeur : **Motion Input Grid**, support : **robin.g0.dev@gmail.com**. Copier ces textes dans les champs correspondants, pas ce document complet.

| Champ | Valeur / fichier |
|---|---|
| ZIP | `chrome/mig-controller-chrome-0.1.0.zip` du dossier généré |
| Nom / version | MIG Controller / 0.1.0, fournis par le manifeste |
| Langue initiale / traduction | English / French ; résumés manifestes localisés |
| Catégorie proposée | Productivité, sous-catégorie Outils si proposée par le formulaire |
| Icône | `assets/icon-128.png` |
| Petite image promotionnelle | `assets/promo-440x280.png` ; préparée même si l'interface la présente comme facultative |
| Site / support | URLs de `listing.json` |
| Politique de confidentialité | `privacy_url_after_deployment` de `listing.json`, **uniquement après publication et vérification** |
| Captures | À fournir : au moins une 1280×800, jusqu'à cinq ; 640×400 également prévu par le guide d'images |
| Distribution proposée | Publique, extension gratuite ; pays à choisir dans le dashboard |
| Accès testeur | Aucun compte MIG requis ; coller `REVIEWER-NOTES.md`, parcours localhost sans compte SaaS |

## Single purpose — copier en anglais

Enable deliberate webcam-detected hand movements to control navigation in one user-selected browser presentation tab. Movement recognition runs locally, with editable page-key mappings and manual or explicitly armed automatic camera control.

## Permission justifications — copier dans les champs correspondants

### storage

Save the user's interface language, manual/automatic mode, per-site preset key mappings and imported MIG profiles in local extension storage. No cloud synchronization or analytics is used.

### activeTab

When the user clicks MIG Controller, identify the selected accessible web tab and grant temporary access for manual presentation controls on pages outside the preconfigured presentation hosts. This is user-triggered tab access, not access to the browser history database.

### scripting

Inject the packaged content.js into the user-selected web tab and accessible frames. The script observes presentation state and delivers validated synthetic page key events for recognized movements. It does not inject remote code.

### Host permissions

Recognize presentation mode on the supported services and deliver controls to the selected presentation, including supported Office viewer frames or a same-service child presentation tab. Canva/Gamma can use changing document paths. PowerPoint can run on Office, OneDrive and tenant-specific SharePoint hosts. The runtime filters Office/SharePoint URLs to PowerPoint-related documents before accepting presentation observations. The extension neither scans presentation text for analytics nor transmits tab URLs or content to the publisher. Full host patterns and their purposes are listed in PERMISSIONS.md.

### Remote code

Select **No, I am not using remote code**. All executable JS/WASM, workers and recognition models are bundled. Runtime dynamic imports resolve extension-local assets. The separate optional Studio link is an external page opened by the user, not code imported into the extension. Explain `wasm-unsafe-eval` and the static glue transformation using `REVIEWER-NOTES.md` if requested.

## Data usage — disclose local handling too

**Do not select “no user data” solely because nothing is uploaded.** Chrome's FAQ explicitly includes processing/storage confined to the device. Based on the current code, prepare the following disclosures against the actual labels shown by the dashboard:

| Category / proposed declaration | Actual handling |
|---|---|
| Personally identifiable information: disclose camera imagery that may show an identifiable person | Camera pixels and derived body positions are processed only on-device in memory to recognize movements; no identity/face-recognition feature, recordings or upload. |
| Web history: disclose accessible tab URL/title and target selection | Read locally for the tab picker, host matching and targeting; not a persistent history log and not sent to the publisher. |
| Website content | Local URL/DOM/fullscreen/visibility checks for presentation state, including permitted frames; presentation documents are not exported. |
| User activity | Deliberate movement events, presentation state, and key capture only in the explicit rebinding dialog; validated synthetic keys delivered to the selected page. No general keystroke logger. |
| Health, financial, authentication, personal communications, location | No feature intentionally collects these categories. Imported profiles are user-supplied configuration; users should not put secrets into profile labels. |

These are conservative, code-based proposed answers, not a claim that local handling and publisher collection mean the same thing. Review the current form's definitions before certifying. Clarification text:

> Camera frames, derived movement positions, target-tab metadata, presentation-state checks and custom mappings are handled only inside the browser for the requested presentation controls. The extension does not upload these data, record video, log browsing history, send analytics, or share/sell data to third parties. Settings/profiles remain in storage.local until removed. A user may separately open the MIG Studio website or contact support.

Prepare to certify the truthful statements that data is not sold/transferred outside approved use cases, not used for purposes unrelated to the single presentation-control purpose, and not used for creditworthiness/lending. The account owner must make those certifications personally in the dashboard. No ads, paid upgrade or payment handling is implemented.

## Remaining owner actions

Create/verify the developer account, provide the account/identity/contact information actually requested, settle any registration payment shown by Google, select distribution regions, add screenshots, verify the public privacy URL, upload and review. No developer account is created and nothing is submitted by this kit.

Sources: [listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing), [images](https://developer.chrome.com/docs/webstore/images), [privacy form](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy/), [local user-data handling FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), [manifest limits](https://developer.chrome.com/docs/extensions/reference/manifest).
