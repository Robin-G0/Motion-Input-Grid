# Tutoriel caméra Web

[English](README.md) | [Français](README.fr.md)

[**Télécharger cet exemple**](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-web-examples) (tar.gz).

## Ce que démontre cet exemple

Montez un poignet du vert vers le jaune pour obtenir **Left/Right hand raised!**.
La page de profil importe un JSON du Motion Input Grid Studio et affiche les actions/identifiants.
Les actions restent dans l'application.

## Démarrage rapide

1. Extrayez `*-browser-web-standalone.tar.gz`. Installez au préalable
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
| `index.html / profile.html` | Point d'entrée et sélection démo/import. |
| `mig-tracker.mjs` | Intégration MIG et callback d'action ; commencez ici. |
| `camera.mjs` | Commandes, vidéo/canvas et affichage des actions. |
| `run.mjs`, `server.mjs` | Serveur local ; chemins indépendants du dossier courant. |
| `run.cmd`, `run.sh` | Lanceurs fournis dans l'archive. |
| `./` | HTML/CSS/JS compilés et ressources (web utilise ce dossier lui-même). |
| `default.json` ou `./mig/default.json` | Profil schema-v2 des deux poignets. |
| `models/`, `vision/` ou `./mig/` | Modèles, Vision et moteur WASM locaux. |
| `licenses/`, `LICENSE` | Notices de redistribution. |
| `session.mjs` | Propriétaire de la caméra et du cycle de vie. |
| `packets.mjs`, `models.mjs`, `overlay.mjs`, `style.css` | Conversion des observations, modèles et affichage. |

## Parcours du code

1. `mig-tracker.mjs` importe `createMIG` depuis `mig.mjs`. `MIGTracker.create(json)`
   construit le tracker WASM et valide le profil.
2. `MIGSession.createTracker()` dans `session.mjs` charge `default.json`.
   `camera.mjs` crée la session avec les callbacks de l'application.
3. Start appelle `session.start(video, canvas)` après un clic. `models.mjs` ouvre
   les tâches locales ; la session obtient le flux et estime les nouvelles images.
4. `MIGTracker.update(pose, hands, timestampMs, aspect, onAction)` copie les
   observations via `packets.mjs` puis appelle `update()` une fois.
5. Les valeurs `eventAction()` et `eventId()` sont copiées avant les callbacks.
   `camera.mjs` écrit l'action, émet `mig-action` et actualise le panneau.
6. `session.importJSON(text)` valide un fichier limité à 1 Mio avant remplacement.
7. Stop libère les pistes caméra ; `session.dispose()` à la fermeture libère aussi
   modèles et tracker, y compris après une erreur de démarrage.

`coordinate(15, 2)` donne le poignet monde en mètres, Y vers le haut, si disponible.
Sur perte de suivi, transmettez des observations vides. Réacquérez les vues mémoire
après un import. `active(index)` aide aux commandes maintenues ; le jeu règle Hold/Repeat.

## Dépendances et compilation des sources

Externe : Node.js 22.12+, navigateur moderne et webcam autorisée. Développement
facultatif : npm et les versions du framework indiquées dans `package.json`.
L'archive individuelle fournit le binding dans `dependencies/motion-input-grid/`
avec ses sources et ressources ; les sources brutes utilisent le paquet npm publié.
Les modules de suivi du navigateur simple restent directement dans son dossier.

Copiez le dossier hors du dépôt, puis :

```sh
npm install motion-input-grid
npx mig-copy-assets .
node run.mjs
```

Pour web, la copie des ressources dans `.` préserve HTML et `camera.mjs`.
Pour les frameworks, `public/mig/` est copié dans `./mig/` à la compilation.
La compilation prend davantage de temps ; aucun compilateur C++ n'est nécessaire.
Conservez les pages compilées et leurs ressources ensemble.

## Réutilisation et dépannage

Étudiez `mig-tracker.mjs` et reprenez le callback ; commandes visuelles, styles et
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
