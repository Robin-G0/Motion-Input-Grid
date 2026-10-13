# Site de démonstration MIG

La page présente Motion Input Grid en français et en anglais. Elle utilise le
package publié `motion-input-grid` épinglé dans `package.json`, sans recompiler
le moteur C++ du repository. Les ressources de reconnaissance sont copiées
localement par le build. Aucun framework, service de police ou CDN supplémentaire
n'est nécessaire à la page.

## Développement local

Depuis `site/`, avec Node 22.12 ou supérieur :

```sh
npm ci
npm run build
npm run preview
```

Sous PowerShell avec une politique bloquant `npm.ps1`, utiliser `npm.cmd`.
La page est servie sur `http://127.0.0.1:4173/Motion-Input-Grid/`.
Le sous-chemin reproduit celui de GitHub Pages. Reconstruire après chaque
modification : le serveur sert `dist/`, pas les fichiers sources.

## Parcours et accessibilité

- Le guide accompagne une première visite ; l'activation directe reste disponible.
- La présentation, ses diagrammes et les liens finaux sont accessibles sans caméra.
  « Passer à la suite » permet de quitter la démonstration de présence.
- Flèches, clavier et balayage tactile permettent de changer de slide.
  Les diagrammes proposent une commande de lecture/pause et un curseur visible.
- Les erreurs apparaissent près des commandes, avec une explication et un lien
  pour continuer sans caméra. Une tentative en cours peut être annulée.
- Le lien d'évitement, les états de focus, les palettes système et le réglage
  de mouvement réduit accompagnent les parcours. Les indications gestuelles
  écrites restent visibles ; leur animation se limite à deux répétitions.
- Pendant l'absence, un bouton et Échap permettent d'arrêter la caméra.
  Cette démonstration masque la page, sans verrouiller l'ordinateur.

## Traitement caméra

`src/camera/processing.mjs` adapte l'ordonnancement de la session publiée :

- une analyse par nouvelle image, via `requestVideoFrameCallback` si disponible,
  ou `requestAnimationFrame` en repli ; aucune file d'images à rattraper ;
- cadence plafonnée à 24 analyses par seconde, avec un intervalle adaptatif
  jusqu'à 100 ms lorsque l'inférence est lente ; aucune inférence en onglet caché ;
- image d'inférence limitée à 960 pixels sur son plus grand côté, dans un canvas
  réutilisé, sans recadrage ; les petites images passent directement au modèle ;
- aperçu conservant toute l'image et son ratio, y compris en portrait ;
- overlay invisible sans dessin, et illustration SVG suspendue hors écran ou
  en pause, avec rendu plafonné à 30 images par seconde.

Les coordonnées normalisées et le ratio original restent transmis au moteur.
Les règles de confiance, de continuité et de départ central sont conservées :
deux mains sur ordinateur, une sur téléphone tactile. Les amplitudes horizontale
et verticale restent respectivement .08 et .19 de l'image caméra ; ces distances
ne sont pas des mesures physiques. Un nouveau départ central est requis après
chaque action. Les liens et principaux délais sont dans `src/settings.mjs`.

Le plafonnement réduit le travail sur les vidéos haute définition. Il ne garantit
pas une reconnaissance identique pour toutes les webcams, focales, lumières ou
machines. L'inférence MediaPipe reste synchrone sur le thread principal : une
machine très lente peut encore produire des pauses. Valider les gestes humains
sur des appareils physiques, en portrait et paysage, reste nécessaire.

## Vérification

```sh
npm test
npm run build
npm run test:browser
```

Installer les navigateurs Playwright requis avant les tests navigateur.
Les tests couvrent les parcours guidés et manuels, les gestes synthétiques,
le vrai WASM, les modèles sur flux vidéo synthétiques, les erreurs, l'annulation,
le responsive et le traitement de vidéos portrait/paysage haute définition.
Ils ne mesurent pas la précision des gestes d'une personne devant une webcam.
