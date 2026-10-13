# Démarrage JavaScript, React, Vue et Next.js

[English](javascript.md) | [Français](javascript.fr.md)

<details>
<summary>Dans cette page</summary>

- [Lancer les exemples](#lancer-les-exemples)
- [Archive compilée](#archive-compilée)
- [Dans votre projet](#dans-votre-projet)
- [Fonctionnement](#fonctionnement)

</details>

Les intégrations navigateur utilisent le moteur C++ compilé en WASM. Chaque
framework propose une démo de levage des mains et un importateur de profils du
Motion Input Grid Studio, affichant chaque action acceptée avec son identifiant.

## Lancer les exemples

**Télécharger un exemple prêt à lancer :** [HTML](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-web-examples) · [React](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-react-examples) · [Vue](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-vue-examples) · [Next.js](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-next-examples).
Extrayez le paquet, puis lancez `run.cmd` ou `sh run.sh` à sa racine
avec Node 22.12+. Ouvrez l’URL affichée. Les commandes ci-dessous concernent les sources.

Avec Node.js 22.12+ (Node 24 testé), compilez WASM selon le
[guide navigateur](../../examples/web/README.md), puis depuis le dépôt complet :

```sh
npm ci
npm run prepare:javascript
npm run dev --workspace examples/react
```

Remplacez React par `examples/vue` ou `examples/next`. Ouvrez l'URL localhost
indiquée. React/Vue utilisent `/` et `/profile.html`, Next.js `/` et `/profile`.
Les liens changent de variante. Start demande la caméra et charge les modèles.
Gardez les épaules visibles, baissez les mains puis levez un poignet : quatre
lignes vertes précèdent une ligne de déclenchement jaune. Gauche/droite désignent
les mains anatomiques. Caméra, points et avions suivent les poignets en miroir ;
le texte reste normal. L'importateur commence vide. Importez votre JSON puis
effectuez son mouvement. Un import valide efface le retour précédent et
recalibre ; un fichier invalide garde la configuration précédente.

## Archive compilée

La préparation demande Python 3 (`python` sous Windows, `python3` sous Linux)
pour extraire les ZIP Node et écrire l'archive. `MIG_PYTHON` choisit un autre
exécutable Python ; les pages navigateur compilées ne nécessitent pas Python.

```sh
node tools/bootstrap/bootstrap-browser.mjs
node tools/bootstrap/bootstrap-node.mjs
npm run build:examples
npm run package:examples
```

`build/releases/motion-input-grid-1.1.0-javascript-examples.tar.gz` contient sources, docs,
pages compilées, export statique Next.js, modèles, WASM, licences et manifeste
SHA256. Après extraction : `node examples/react/run.mjs` (ou Vue/Next).
Ouvrez `http://localhost:8820`, fermez avec Ctrl+C avant de lancer un autre exemple.
Dans chaque dossier, `run.cmd` (Windows x64) ou `sh run.sh` (Linux x64/ARM64)
utilise Node fourni. Un navigateur moderne reste nécessaire ; modèles, MediaPipe
JS/WASM et moteur sont locaux, sans CDN ni installation npm.
Le WASM fonctionne sur x64/ARM64 selon le navigateur, indépendamment du SDK natif.
Pour modifier/recompiler les sources extraites, lancez `npm ci`, puis
`npm run build:examples` à la racine de l'archive. Le runtime fourni contient
déjà WASM et modèles. Le test WASM utilise alors `node tests/bindings/javascript/web_tests.mjs
bindings/javascript/runtime/mig.mjs` à la place du chemin de compilation du dépôt.

## Dans votre projet

Installez le package dans votre application :

```sh
npm install motion-input-grid
npx mig-copy-assets public/mig
```

WASM et modèles sont inclus, sans compilation Emscripten. Alternative hors ligne :
`npm install /chemin/motion-input-grid-1.1.0.tgz`, puis la même commande de copie
des ressources. Voir le [guide npm](../../bindings/javascript/README.fr.md). React expose `useMIG` dans `motion-input-grid/react`,
Vue dans `motion-input-grid/vue`. Reliez leurs refs vidéo/canvas, méthodes
`start`, `stop`, `recalibrate`, `importJSON` et état aux contrôles de l'interface.
`onAction({ action, id })` peut commander votre navigation ou vos sélections.
Vue utilise une ref `state` superficielle ; React expose directement ses champs.
`profileMode: true` crée un moteur vide. `await importJSON(json)` valide le
texte du fichier ; capturez les erreurs. `assetBase` indique l'URL des ressources
publiques, `/mig/` par défaut. Pour un sous-dossier, donnez son URL réelle.

Next.js réutilise React dans une frontière `'use client'`. Ces composants sont
aussi pré-rendus côté serveur : le composant fourni protège les accès navigateur
et n'initialise caméra/WASM qu'au clic. Le hook crée sa session dans un effet et
la libère au démontage, y compris lors des remontages de développement.
[Documentation Next.js](https://nextjs.org/docs/app/getting-started/server-and-client-components),
[effets React](https://react.dev/reference/react/useEffect).

## Fonctionnement

`examples/web/session.mjs` possède initialisation, modèles, caméra, animation,
reconnaissance et fermeture. Un compteur empêche une caméra tardive de rouvrir
après Stop ; les moteurs/modèles arrivant après démontage sont fermés. Le tracker
valide les profils atomiquement. `models.mjs` charge MediaPipe, `packets.mjs`
copie les observations dans WASM, `overlay.mjs` dessine points et avions.
L'exemple HTML classique utilise la même session.

`react.mjs` relie abonnements et refs avec des effets ; `vue.mjs` utilise les
hooks de montage/démontage. L'inférence reste hors état réactif : seules les
nouvelles frames sont traitées, les mains suivent `tracking.hands`, les
notifications concernent statuts/actions. Aucun raccourci système n'est envoyé.
Les dernières actions restent affichées, simultanées comprises.

`CameraExample.jsx` affiche boutons, fichier, état et aperçu ; les deux entrées
HTML sélectionnent le mode. Vue fournit un composant équivalent. Next réutilise
le composant React avec deux routes. Le CSS partagé applique une seule fois
le miroir et suit le thème système. `run.mjs` lance un serveur local minimal.
La préparation copie les sources canoniques et ressources vérifiées vers package
et dossiers publics ; l'archive garde sources et résultats compilés ensemble.

Vérifications : `npm test`, `npm run build:examples`, `node tests/bindings/javascript/web_tests.mjs`,
`node --experimental-vm-modules tests/bindings/javascript/web_camera_tests.mjs`, puis
`npm run test:browser` après `npx playwright install chromium`. `MIG_BROWSER`
permet de choisir un exécutable Chromium/Edge existant. Ces tests utilisent le
vrai WASM et des observations/flux synthétiques ; ils ne vérifient pas la caméra
physique ni la précision des gestes humains.
`npm run test:types` vérifie les déclarations publiques. Versions compilées :
React 19.3, Vue 3.5.43 et Next.js 16.3.8. Vérifiez votre application si elle
utilise d'autres versions.
