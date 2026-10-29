# Extension navigateur MIG Controller

[English](README.md) | [Français](README.fr.md)

Pilotez une présentation par de grands mouvements volontaires des poignets.
L'extension exécute MIG localement et envoie les touches à **un seul onglet ciblé**.
Elle n'envoie aucune touche au système et ne contacte pas le Controller bureau.

> [!IMPORTANT]
> **Première version : testez avant de présenter.** Les parcours sont testés dans
> l'extension installée avec des pages contrôlées. Les comptes réels Canva, Gamma,
> Google Slides et PowerPoint, Opera et la précision avec une webcam physique
> restent à vérifier manuellement. Certains lecteurs ignorent les touches simulées ;
> l'extension ne fabrique pas de véritables événements matériels.

## Compiler et installer pour un essai

Avec Node 24 et npm, depuis ce dossier :

```sh
npm ci --ignore-scripts
npm run build
npm test
npm run lint
npm run package
```

| Navigateur | Installation temporaire |
| --- | --- |
| Chrome / Chromium | `chrome://extensions`, mode développeur, charger le dossier décompressé `dist/chromium` |
| Opera | `opera://extensions`, mode développeur, charger le dossier décompressé `dist/chromium` |
| Firefox 142+ | `about:debugging#/runtime/this-firefox`, charger un module temporaire, choisir `dist/firefox/manifest.json` |

L'installation temporaire Firefox disparaît au redémarrage. Une installation
permanente nécessite la signature Mozilla. Les ZIP destinés aux stores sont
générés dans `dist/packages` et restent **non signés et non publiés**.
La version Chromium demande au minimum Chromium 121.

## Première présentation

1. Ouvrez la présentation puis cliquez sur l'icône **MIG Controller**.
2. Vérifiez l'onglet cible et le site détecté. Un site inconnu utilise les flèches génériques.
3. Choisissez **Normal**, **Inversé** ou importez votre profil JSON. Les schémas
   animés montrent les deux gestes. Cliquez sur **Changer**, puis appuyez sur la touche.
   Échap annule la saisie.
4. Choisissez **Manuel → Démarrer**, ou **Automatique → Activer le mode automatique**.
   Autorisez la caméra et calibrez avec les deux épaules visibles, à votre position de présentation.
5. Faites un geste ample puis revenez au repos. Le carré gris devient un rond rouge
   uniquement quand la caméra tourne. **Arrêter** coupe aussi le mode automatique.

Gardez la fenêtre de contrôle ouverte ; la fermer libère la caméra. Un worker
embarqué traite les images indépendamment du rendu de la fenêtre. La reconnaissance
avec la fenêtre minimisée est incluse dans les tests Chromium.

> [!TIP]
> Le profil normal associe **votre main droite de droite vers gauche** à Flèche droite,
> et **votre main gauche de gauche vers droite** à Flèche gauche. Inversé échange les touches.
> L'aperçu est en miroir. Les zones suivent les épaules et laissent un grand espace
> pour éviter les gestes de conversation. Revenez au départ pour réarmer le mouvement.

## Sites détectés

| Site | Touches par défaut | Signaux du mode automatique |
| --- | --- | --- |
| Canva | Droite / Gauche | Plein écran ou lecteur de présentation visible |
| Gamma | Droite / Gauche | `mode=present`, plein écran ou lecteur visible |
| Google Slides | Droite / Gauche | `/present`, `/preview` ou plein écran ; suit la fenêtre enfant du même site ouverte depuis l'éditeur ciblé |
| PowerPoint web | Droite / Gauche | Lecteur diaporama/lecture, lecteur visible ou plein écran ; observe les cadres Office autorisés |
| Autres pages web accessibles | Droite / Gauche | Utilisez le mode manuel |

Les flèches visent le fonctionnement d'une télécommande : le lecteur peut avancer
l'animation courante avant la diapositive suivante. Les signaux de détection peuvent
changer avec les services. Passez en manuel si votre lecteur n'est pas reconnu.
Les lecteurs PDF intégrés et les logiciels bureau sont exclus. Les champs de saisie,
les onglets masqués/inactifs et les autres onglets sont protégés.

## Profils personnalisés

Le lien du Studio est placé **au-dessus de l'import**. Importez un profil JSON au
schéma 2 avec des touches en mode **Once**. La liste affiche **nom du mouvement → touche(s)**.
Vous pouvez changer les touches localement sans modifier le fichier original.

L'import est limité à 1 Mio, 64 mouvements et 16 étapes de touches par mouvement.
Le vrai moteur WASM valide le profil avant de remplacer le précédent. Windows/Command,
Alt, les raccourcis de fonctions/contrôle du navigateur et les macros texte sont refusés.
Les lettres, chiffres, flèches, touches de navigation, combinaisons Maj et certaines
combinaisons Ctrl d'édition sont des événements destinés à la page. Ctrl+C est ainsi
transmis aux gestionnaires du site, sans déclencher la copie native du navigateur.
Passez les profils Repeat/Hold en Once dans le Studio avant l'import.

## Tests et préparation des stores

```sh
npx playwright install chromium firefox
npm run test:browser
npm run test:firefox
```

Chromium charge la vraie extension et teste modèles/caméra embarqués, reconnaissance
WASM vers touche dans la page, protection des champs, réaffectation, rejet des imports,
fenêtres enfants, cycle automatique et état de l'icône. Seule l'inférence est remplacée
dans les tests déterministes des gestes. Le test Firefox installe temporairement
l'extension et vérifie CSP, worker, WASM, modèles, caméra et libération des pistes.

Une [catégorie CI séparée](../../.github/workflows/extensions.yml) évite de recompiler
le site et les SDK natifs pour les changements de l'extension. Le runtime publié est
verrouillé. `web-ext lint` ne signale aucune erreur ; les imports dynamiques de
MediaPipe/runtime peuvent produire des avertissements de revue. Ils visent uniquement
des ressources embarquées, sans code provenant d'un CDN.

Avant soumission : vérifier les services réels, préparer de véritables captures et
descriptions traduites, publier la [notice de confidentialité](PRIVACY.fr.md), revoir
les permissions et fournir un parcours aux évaluateurs. Comptes, signature,
soumission et publication restent manuels. L'acceptation par les stores n'est pas garantie.

Le code et le lockfile reproduisent les ZIP. La transformation CSP vérifie le hash du
runtime ; les [mentions tierces](src/THIRD-PARTY-NOTICES.md) documentent les adaptations.
