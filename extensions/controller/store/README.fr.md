# Dossier de soumission — MIG Controller

[English](README.md) | [Français](README.fr.md)

Éditeur : **Motion Input Grid**. Contact public : **robin.g0.dev@gmail.com**. Préparé le **1 novembre 2026**. Aucun compte, upload, push ou déploiement n'est effectué par cette préparation.

## Générer les fichiers à envoyer

Depuis `extensions/controller`, avec Node 24/npm 11 et Python 3 :

```powershell
npm.cmd ci --ignore-scripts
# Si ni Chromium Playwright ni Edge n'est installé :
npx.cmd playwright install chromium
npm.cmd run prepare:stores
```

Le dossier final est `dist/store-submission/mig-controller-0.1.0/`.

| Store | Archive à uploader | Champs à copier |
|---|---|---|
| Chrome | `chrome/mig-controller-chrome-0.1.0.zip` | `CHROME.md`, `listing.json`, descriptions FR/EN |
| Firefox | `firefox/mig-controller-firefox-0.1.0.zip` + `firefox/mig-controller-sources-0.1.0.zip` comme sources | `FIREFOX.md`, notes évaluateur, descriptions FR/EN |
| Opera | `opera/mig-controller-opera-0.1.0.zip` | `OPERA.md`, descriptions FR/EN ; choisir extension, pas thème/mod |

Icônes et image promotionnelle : `assets/`. Confidentialité bilingue prête à héberger : `privacy/index.html`. Empreintes : `SHA256SUMS`, `file-hashes.json`, `runtime-provenance.json`. Démonstration sans compte : `reviewer-demo.html`, profil `examples/reviewer-profile.json`. Les ZIP installables sont non signés et n'incluent ni les notes de soumission ni le serveur de démonstration.

## À terminer avant de soumettre

1. **Captures d'écran** : tu les fournis. Chrome 1280×800 (ou 640×400), Firefox 1280×800 recommandé ; Opera 612×408 recommandé, max. 800×600. Aucune capture de l'interface ou de Canva n'est fabriquée dans ce kit. L'image promotionnelle est une illustration, pas une preuve d'interface.
2. **URL de confidentialité** : la page est ajoutée à `site/privacy/controller/index.html` et à son build. Après déploiement du site, vérifier sans connexion `https://robin-g0.github.io/Motion-Input-Grid/privacy/controller/`. Le fichier préparé ne prouve pas que l'URL est déjà publique.
3. **Comptes développeur** : créer/vérifier les comptes et fournir les informations d'identité/contact demandées. Le nom d'éditeur public ne remplace pas ces démarches. Les choix pays/distribution et certifications sont à valider dans les formulaires.
4. **Validation de release** : ajouter les versions Opera/OS et le mode de contrôle au retour Canva ; tester les autres combinaisons avant de les annoncer comme validées. Le délai de reprise après sortie du champ est noté dans `MANUAL-TESTS.md`, sans correction revendiquée.
5. **Firefox** : joindre les sources et les instructions de build. L'assemblage du runtime npm est vérifiable ; sa compilation C++→WASM bit-à-bit n'est pas annoncée comme vérifiée. Les demandes complémentaires de l'évaluateur restent possibles.

Les documents par store citent les sources officielles consultées. Les interfaces des dashboards peuvent évoluer ; vérifier les champs proposés avant de certifier les réponses. En particulier, Chrome impose de déclarer aussi le traitement local des données, contrairement au champ Mozilla centré sur leur transmission hors du navigateur.

## Après modification

Relancer la préparation et les tests, puis envoyer les ZIP et sources de la même génération. Avant une mise à jour d'une version déjà publiée, augmenter la version ; `0.1.0` est ici une première soumission non publiée. Ne pas uploader le dossier entier ou l'archive de sources comme extension installable.
