# Package navigateur Motion Input Grid (MIG)

[English](https://github.com/Robin-G0/Motion-Input-Grid/blob/main/bindings/javascript/README.md) | [Français](https://github.com/Robin-G0/Motion-Input-Grid/blob/main/bindings/javascript/README.fr.md)

Reconnaissez des mouvements dans le navigateur avec le moteur C++ compilé en
WASM. `MIGSession` possède la caméra, les modèles et le tracker ; les adaptateurs
React et Vue relient cette session aux composants. Next.js utilise l'adaptateur React.

## Installer depuis npm

Dans votre projet (Node.js 22.12+), lancez :

```sh
npm install motion-input-grid
npx mig-copy-assets public/mig
```

Le package inclut le moteur WASM, les modèles, MediaPipe, les types et les
licences. Servez `public/mig` à l'URL `/mig/` sur localhost ou HTTPS.
React et Vue utilisent le même package ; Next.js utilise l'adaptateur React.
Installez le framework choisi dans votre application.

```js
import { MIGSession } from 'motion-input-grid';
import { useMIG } from 'motion-input-grid/react'; // React / Next.js
// import { useMIG } from 'motion-input-grid/vue'; // Vue
```

Utilisez uniquement l'import adapté à votre application. Sous PowerShell,
utilisez `npm.cmd` et `npx.cmd` si la politique bloque les scripts `.ps1`.

`motion-input-grid` fournit une session caméra, un hook React et un composable
Vue utilisant le moteur C++/WASM. Next.js réutilise React.

> [!TIP]
> **Gardez les deux commandes d'installation ensemble.** `npm install` installe le code ;
> `mig-copy-assets` rend WASM et modèles accessibles au navigateur.
> Servez votre application sur **localhost ou HTTPS** pour autoriser la caméra.

## Utiliser le package

Le package contient WASM, modèles, modules, types et licences. `assetBase` indique
leur URL publique (`/mig/` par défaut). Servez sur localhost ou HTTPS. La caméra
s'ouvre uniquement avec Start. React et Vue sont des dépendances optionnelles.

Ajoutez les éléments suivants à votre page et le JavaScript à son module
compilé par votre application. Start charge le profil de démonstration fourni.
Pour utiliser votre profil, appelez `await session.importJSON(jsonText)` depuis
votre sélecteur de fichier ; un import invalide rejette la promesse sans remplacer
le profil actif. Placez vidéo et canvas dans un même conteneur pour superposer
l'aperçu, et appliquez le miroir une seule fois. Les exemples des frameworks
fournissent le CSS et les contrôles complets.

```html
<button id="start">Start</button>
<button id="stop">Stop</button>
<p id="status"></p>
<video id="camera" muted playsinline></video>
<canvas id="overlay"></canvas>
```

```js
import { MIGSession } from 'motion-input-grid';

const video = document.querySelector('#camera');
const canvas = document.querySelector('#overlay');
const status = document.querySelector('#status');
const session = new MIGSession({
    assetBase: new URL('/mig/', location.href).href,
    onAction: ({ action, id }) => console.log(action, id)
});
const unsubscribe = session.subscribe(state => { status.textContent = state.status; });
document.querySelector('#start').onclick = () => {
    session.start(video, canvas).catch(error => { status.textContent = error.message; });
};
document.querySelector('#stop').onclick = () => session.stop();
window.addEventListener('pagehide', () => {
    unsubscribe();
    session.dispose();
}, { once: true });
```

| Méthode | Effet |
| --- | --- |
| `subscribe(callback)` | État immédiat, puis statuts et actions acceptées |
| `start(video, canvas)` | Charge les ressources et ouvre la caméra |
| `stop()` | Libère la caméra, réinitialise la reconnaissance et garde les modèles |
| `dispose()` | Ferme aussi modèles et moteur ; peut être appelé plusieurs fois |
| `importJSON(text)` | Valide avant remplacement ; un échec conserve le profil actif |
| `recalibrate()` | Efface la progression de reconnaissance |

> [!NOTE]
> `actions` contient les événements de la **dernière frame acceptée**, simultanés compris.
> Utilisez `onAction({ action, id })` pour vos commandes ; cette liste n'est pas un état de maintien.

**Adaptateurs React/Vue :** reliez les refs `video`/`canvas` et leurs méthodes aux contrôles.
React expose `useMIG` dans `/react`, Vue dans `/vue` avec une ref `state` superficielle.
React recrée la session si `assetBase`/`profileMode` changent ; les options Vue sont fixes
jusqu'au démontage. Les deux libèrent leurs ressources à la sortie.

La session propose aussi `onFrame(session)` pour lire `coordinate(index, system)`
sans mise à jour réactive : 0 pour XYZ image normalisé, 1 pour mètres monde,
2 pour mètres monde avec Y vers le haut. Un point absent renvoie `null`.
Chaque coordonnée inclut `confidence` (de 0 à 1), le minimum des scores de
visibilité et de présence du modèle, pour filtrer les observations.
Gardez ces callbacks courts pour ne pas ralentir l'inférence.

Seules les nouvelles frames sont traitées, hors état réactif ; `tracking.hands`
contrôle l'inférence des mains. Le miroir est uniquement visuel. Aucun raccourci
clavier système n'est injecté ; les callbacks sont des événements de votre application.

Consultez les exemples [React](https://github.com/Robin-G0/Motion-Input-Grid/blob/main/examples/react/README.fr.md),
[Vue](https://github.com/Robin-G0/Motion-Input-Grid/blob/main/examples/vue/README.fr.md), [Next.js](https://github.com/Robin-G0/Motion-Input-Grid/blob/main/examples/next/README.fr.md)
et le [guide de démarrage](https://github.com/Robin-G0/Motion-Input-Grid/blob/main/docs/integrations/javascript.fr.md).

Le paquet inclut `runtime/vision` : MediaPipe JS/WASM est copié avec les modèles
par mig-copy-assets. Start charge ces fichiers locaux, sans CDN.

## Alternative : compiler le package

Après compilation WASM, depuis le dépôt complet :

```sh
npm ci
npm run prepare:javascript
npm pack --workspace motion-input-grid --pack-destination build/releases
```

Dans votre application, installez l'archive locale puis copiez les ressources :

```sh
npm install /chemin/motion-input-grid-1.3.0.tgz
npx --package motion-input-grid mig-copy-assets public/mig
```

## Reglages de performance du navigateur

Cette revision source ajoute des options a `MIGSession` ; verifier leur presence
dans la version npm installee. Les valeurs par defaut restent compatibles.

`maxInferenceFps: 20` limite l'inference sans mettre d'images en attente ;
`setInferenceFps(10)` permet un menu moins couteux avec reprise gestuelle. Zero
signifie sans plafond, sinon la plage est 1..120. Garder un intervalle compatible
avec la continuite du moteur et verifier les gestes sur une vraie camera.

`drawOverlay: false` evite le dessin de diagnostic quand l'application affiche
ses propres zones. `videoConstraints` transmet les contraintes getUserMedia, par
exemple `{width:640,height:480,frameRate:{ideal:20,max:30}}`. L'affichage peut
garder sa propre cadence. `delegate: 'GPU'` est facultatif ; mesurer consommation
et precision avant de le preferer au CPU.

Un profil sans mains initialise seulement le modele du corps. Un import
qui active les mains charge ce modele a la demande ; les modeles arrives apres
dispose sont fermes. Les evenements et onFrame restent actifs sans diagnostic.

## Dessiner la grille du moteur

`session.grid(space)` renvoie la grille que le moteur teste reellement, deja
lissee : `'body'` (defaut) suit les epaules, `'calibrated'` garde l'ancrage de
calibration. Elle vaut `null` avant la calibration et apres une perte de suivi :
masquez alors les guides. `gridPoint(grid, column, row)` projette une coordonnee
de grille en coordonnees d'image normalisees non reflechies ; inversez `x` si
l'apercu est en miroir. Ne recalculez ni ne relissez la grille en JavaScript :
ses constantes appartiennent au moteur.

```js
import { MIGSession, gridPoint } from 'motion-input-grid';
const grid = session.grid(movement.space ?? 'calibrated');
if (grid) {
    const [x, y, w, h] = region.cell;
    const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([c, r]) => gridPoint(grid, c, r));
}
```

## Choix du modele de pose

`poseModel` choisit la variante BlazePose (`'lite'`, defaut et livree ; `'full'` ;
`'heavy'`) et `poseModels` liste les variantes que vos utilisateurs peuvent
choisir. Chaque modele est verifie avec son SHA-256 epingle ; Full et Heavy sont
telecharges une fois depuis le stockage de modeles de Google puis conserves dans
Cache Storage pour les sessions hors ligne. Copiez `pose_landmarker_full.task` ou
`pose_landmarker_heavy.task` a cote du modele lite dans `public/mig/models/` pour
les servir vous-meme sans requete externe. `setPoseModel(name)` change de modele
sans arreter la camera et refuse les noms hors de `poseModels` ; `state.poseModel`
indique le modele actif. Heavy est le plus lent : mesurez sur l'appareil cible
avant de le preferer, MIG n'ayant besoin que de poignets, coudes et epaules fiables.

```js
const session = new MIGSession({ assetBase: '/mig/', poseModel: 'full', poseModels: ['lite', 'full'] });
await session.setPoseModel('lite'); // la camera et la reconnaissance continuent
```
