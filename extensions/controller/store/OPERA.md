# Opera Add-ons — champs prêts à saisir

Vérifié le 1 novembre 2026. **Créer une extension**, pas un thème ni un mod Opera GX. Le ZIP Chromium renommé pour Opera contient le même manifeste MV3 et les mêmes fichiers, sans `persona.ini`.

| Champ | Valeur / fichier |
|---|---|
| Dashboard | https://addons.opera.com/developer/ |
| ZIP | `opera/mig-controller-opera-0.1.0.zip` |
| Nom / version | MIG Controller / 0.1.0 |
| Éditeur / contact | Motion Input Grid / robin.g0.dev@gmail.com |
| Catégorie | Productivity |
| Langues | English et French ; résumés de `listing.json`, textes longs de `listing.en.md` / `listing.fr.md` |
| Licence / EULA | **Apache License 2.0**, fournie explicitement dans `LICENSE` ; ne pas laisser le choix implicite de licence du portail |
| Site / support | Site MIG et issue tracker de `listing.json` |
| Confidentialité | URL prévue de `listing.json` après publication ; texte FR/EN fourni |
| Icône | `assets/icon-128.png` ; variantes 64/96 disponibles |
| Captures | À ajouter : 612×408 recommandé par Opera, maximum 800×600 ; une vue du contrôle et une vue en présentation proposées |
| Instructions de test | `REVIEWER-NOTES.md` ; revue locale en manuel sans compte de présentation |

## Notes complémentaires à transmettre

This Manifest V3 extension uses the Chromium service-worker package. A user test on Opera with Canva confirmed presentation controls on 2026-11-01; exact browser/OS versions were not supplied. Temporary recognition delay after leaving and returning to the camera view was reported and recovered without a confirmed fix. No broader browser/service compatibility or instant tracking recovery is claimed.

The extension processes camera frames on-device, does not record video or transmit images/landmarks/telemetry, and sends only validated page keyboard events to one selected tab. Bundled JS/WASM/models are local. The requested storage/activeTab/scripting and presentation-host permissions are explained in PERMISSIONS.md. The optional MIG Studio website link opens a separate page.

## Dernières étapes

Vérifier/créer le compte Opera, renseigner les informations d'auteur demandées, ajouter les captures, vérifier le lien de confidentialité public, uploader le ZIP et contrôler le récapitulatif avant soumission. Le fonctionnement en mode développeur ne constitue pas une acceptation du ZIP par la modération Opera.

Sources: [publication](https://help.opera.com/en/extensions/publishing-guidelines/), [critères d'acceptation](https://help.opera.com/en/extensions/acceptance-criteria/), [icônes du manifeste](https://help.opera.com/en/extensions/manifest/).
