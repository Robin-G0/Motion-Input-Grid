# Firefox AMO — champs et sources

Vérifié le 1 novembre 2026. Éditeur : **Motion Input Grid**, support : **robin.g0.dev@gmail.com**. Utiliser les fichiers de description FR/EN et `listing.json`.

| Champ | Valeur / fichier |
|---|---|
| Distribution | On this site : fiche publique AMO ; ne pas choisir l'auto-distribution si l'objectif est le store |
| Extension | `firefox/mig-controller-firefox-0.1.0.zip` ; non signée, à envoyer à Mozilla pour validation/signature |
| Sources nécessaires ? | **Oui** : C++/WASM, code MediaPipe généré et transformation locale de glue |
| Sources | `firefox/mig-controller-sources-0.1.0.zip`, reconstruction décrite dans `BUILD-REVIEW.md` à sa racine |
| Nom / slug proposé | MIG Controller / `mig-controller`, disponibilité à confirmer sur AMO |
| Résumé / description | `listing.json` / `listing.en.md`, puis traduction française |
| Catégorie | Other / Autres ; une catégorie suffit |
| Experimental | Oui pour cette première version et sa compatibilité encore en cours de validation |
| Plateformes | Navigateurs desktop Windows/macOS/Linux ; pas Android. Les essais matériels macOS/Linux ne sont pas annoncés comme réalisés. |
| Version Firefox | 142.0 minimum, dans le manifeste |
| Identifiant | `mig-controller@motion-input-grid.org`, identifiant stable existant ; ne signifie pas que ce domaine est un site du projet |
| Licence | Apache License 2.0, fichier `LICENSE` présent dans le ZIP |
| Icône | `assets/icon-128.png`, variantes 64 et 96 également fournies |
| Politique | Coller `PRIVACY.md` ou le texte de `privacy/index.html` ; renseigner le lien public après publication si le champ URL est proposé |
| Support | robin.g0.dev@gmail.com et https://github.com/Robin-G0/Motion-Input-Grid/issues |
| Notes évaluateur | Copier `REVIEWER-NOTES.md`, indiquer l'archive source et le parcours local sans compte |
| Achat / services / matériel supplémentaires | Webcam requise. Aucun achat ni compte MIG ; les services de présentation peuvent demander leur propre compte. Décrire ce matériel dans le champ correspondant si proposé. |
| Captures | À ajouter ; 1280×800 recommandé pour une fiche lisible |

## Déclaration des données

Le manifeste utilise déjà `browser_specific_settings.gecko.data_collection_permissions.required=["none"]`. Cette déclaration décrit l'absence de collecte/transmission **hors de l'extension ou du navigateur local** selon la définition Mozilla ; elle n'efface pas le traitement local de pixels et métadonnées expliqué dans la politique. Aucun ajout de consentement télémétrie n'est requis pour cette extension sans télémétrie.

## Note technique à joindre aux sources

Le source kit comporte les sources du checkout ayant servi à construire l'extension et, séparément, le tag MIG 1.1.0 utilisé par le runtime npm. Le fichier `runtime-provenance.json` inventorie les hashes des fichiers npm originaux et livrés, dont la glue modifiée. La comparaison reproductible porte sur les fichiers générés de l'extension ; un ZIP peut avoir des timestamps différents sans différence de contenu.

La version livrée utilise un moteur WASM précompilé publié avec MIG 1.1.0. Les sources C++ et commandes Emscripten sont fournies ; **aucune reconstruction bit-à-bit du binaire WASM depuis le C++ n'est revendiquée dans cette préparation**. Si l'évaluateur la demande, exécuter la procédure supplémentaire de `BUILD-REVIEW.md` et résoudre les différences avant de présenter la soumission comme acceptée. Les sources tierces MediaPipe et Emscripten sont référencées par versions dans les notes évaluateur.

Les avertissements du linter concernant les imports dynamiques doivent être expliqués : imports de fichiers locaux embarqués, jamais CDN. Ne pas masquer les avertissements et ne pas déclarer une acceptation AMO sur la base du lint seul.

Sources: [soumission](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/), [sources reproductibles](https://extensionworkshop.com/documentation/publish/source-code-submission/), [bibliothèques tierces](https://extensionworkshop.com/documentation/publish/third-party-library-usage/), [consentement intégré](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/).
