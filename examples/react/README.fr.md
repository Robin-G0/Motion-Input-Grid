# Tutoriel caméra React

[English](README.md) | [Français](README.fr.md)

[**Télécharger cet exemple**](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-react-examples) (tar.gz).

## Ce que démontre cet exemple

Montez un poignet du vert vers le jaune pour obtenir **Left/Right hand raised!**.
La page de profil importe un JSON du Motion Input Grid Studio et affiche les actions/identifiants.
Les actions restent dans l'application.

## Démarrage rapide

1. Extrayez `*-browser-react-standalone.tar.gz`. Installez au préalable
   Node.js 22.12+ et un navigateur moderne (serveur Windows/Linux).
2. Lancez `node run.mjs` dans ce dossier, ou `run.cmd` / `sh run.sh`.
3. Ouvrez `http://localhost:8820`, cliquez **Start camera** et autorisez la caméra.
4. Gardez les épaules visibles, baissez les mains dans le vert, puis montez vers le jaune.
5. `/profile.html` permet d'importer un JSON. Stop libère la caméra ; Ctrl+C arrête le serveur.

Objectif : 30–60 secondes après extraction avec les prérequis installés.
WASM, modèles et MediaPipe Vision sont locaux ; aucune installation npm ni CDN
n'est nécessaire pour essayer les pages compilées. L'archive JavaScript groupée
fournit aussi Node portable. Le chargement initial dépend du matériel.

## Organisation du dossier

| Fichier/dossier | Rôle |
| --- | --- |
| `src/main.jsx` | Point d'entrée et sélection démo/import. |
| `src/example_usage.mjs` | Intégration MIG et callback d'action ; commencez ici. |
| `src/CameraExample.jsx` | Commandes, vidéo/canvas et affichage des actions. |
| `run.mjs`, `server.mjs` | Serveur local ; chemins indépendants du dossier courant. |
| `run.cmd`, `run.sh` | Lanceurs fournis dans l'archive. |
| `dist/` | HTML/CSS/JS compilés et ressources (web utilise ce dossier lui-même). |
| `default.json` ou `dist/mig/default.json` | Profil schema-v2 des deux poignets. |
| `models/`, `vision/` ou `dist/mig/` | Modèles, Vision et moteur WASM locaux. |
| `licenses/`, `LICENSE` | Notices de redistribution. |
| `vite.config.mjs`, `index.html`, `profile.html` | Compilation des deux pages. |
| `src/style.css` | Commandes, thème et aperçu miroir. |

## Parcours du code

1. `src/example_usage.mjs` importe `useMIG` depuis `motion-input-grid/react`.
   `useMotionInput(profileMode)` fournit les ressources et `handleDetectedAction`.
2. Le hook crée la session dans un effet après montage et la libère au nettoyage
   de cet effet. Le rendu serveur ne crée aucune ressource navigateur.
   `assetBase` héberge JSON, WASM, Vision et
   modèles. Le mode import démarre vide. La caméra n'est demandée qu'après un clic.
3. `src/CameraExample.jsx` connecte les refs vidéo/canvas et appelle `start()`, `stop()`, `recalibrate()`.
4. `runtime/session.mjs` du binding gère la capture. `runtime/mig-tracker.mjs`,
   `MIGTracker.update()`, soumet les observations et copie actions/identifiants.
   Les sources sont incluses dans `dependencies/motion-input-grid/` de l'archive.
5. Remplacez le journal de `handleDetectedAction(event)` par vos commandes de jeu.
6. `importProfile()` limite le JSON à 1 Mio, puis appelle `importJSON(text)`.
   Un échec conserve les règles ; un succès recommence la calibration.
7. Le démontage du composant ferme la session automatiquement, y compris les
   remontages StrictMode de React. Stop ferme les pistes ; dispose libère modèles/WASM.

Gardez l’inférence hors des fonctions de rendu réactif ; une session traite les nouvelles images.

## Dépendances et compilation des sources

Externe : Node.js 22.12+, navigateur moderne et webcam autorisée. Développement
facultatif : npm et les versions du framework indiquées dans `package.json`.
L'archive individuelle fournit le binding dans `dependencies/motion-input-grid/`
avec ses sources et ressources ; les sources brutes utilisent le paquet npm publié.
Les modules de suivi du navigateur simple restent directement dans son dossier.

Copiez le dossier hors du dépôt, puis :

```sh
npm install
npx mig-copy-assets public/mig
npm run build
node run.mjs
```

Pour web, la copie des ressources dans `.` préserve HTML et `camera.mjs`.
Pour les frameworks, `public/mig/` est copié dans `dist/mig/` à la compilation.
La compilation prend davantage de temps ; aucun compilateur C++ n'est nécessaire.
Conservez les pages compilées et leurs ressources ensemble.

## Réutilisation et dépannage

Étudiez `src/example_usage.mjs` et reprenez le callback ; commandes visuelles, styles et
objets sont facultatifs. Gardez anatomie non miroir, aspect correct, temps monotone
et séquence croissante. Le miroir concerne seulement l'affichage. Partez du vert :
une pose jaune isolée ne déclenche rien. Un intervalle supérieur à 180 ms nécessite un profilage.

- Caméra : utilisez localhost ou HTTPS, jamais `file://`.
- Ressources absentes : conservez modèles/WASM et effectuez la copie pour les sources.
- Port 8820 occupé : arrêtez l'autre serveur d'exemple.
- Import refusé : corrigez l'erreur affichée ; les anciennes règles restent actives.
- Les tests synthétiques ne prouvent pas la précision webcam.

[API JavaScript](../../bindings/javascript/README.fr.md) ·
[Configuration](../../docs/reference/configuration.fr.md).
