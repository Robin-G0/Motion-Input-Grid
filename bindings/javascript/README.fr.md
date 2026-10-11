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

`MIGSession` fournit `subscribe`, `start(video, canvas)`, `stop`, `importJSON`,
`recalibrate` et `dispose`. Les abonnés reçoivent immédiatement un état puis les
changements de statut et les actions acceptées. `actions` garde les événements
de la dernière frame acceptée, simultanés compris ; ce n'est pas un état de
maintien. `onAction` reçoit `{ action, id }` pour vos commandes.

`stop` libère la caméra et réinitialise la reconnaissance, en gardant les modèles
pour redémarrer. `dispose` ferme aussi modèles et moteur, même appelé plusieurs
fois. Une configuration invalide conserve la précédente. `recalibrate` efface
la progression. React expose `useMIG` dans `/react`, Vue dans `/vue` ; reliez les
refs `video`/`canvas` et leurs méthodes aux contrôles. Vue expose `state` comme
ref superficielle. React recrée la session si `assetBase`/`profileMode` changent ;
les options Vue restent fixes jusqu'au démontage. Les deux nettoient à la sortie.

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
npm install /chemin/motion-input-grid-1.0.2.tgz
npx --package motion-input-grid mig-copy-assets public/mig
```
