# Exemples d'intégration

[English](README.md) | [Français](README.fr.md)

Découvrez la reconnaissance d'une main levée avec Motion Input Grid (MIG), puis
importez votre propre profil. Les démos caméra affichent une image miroir, des
objets suivant les poignets et un retour indiquant l'action acceptée. Elles
transmettent des événements sans envoyer de touches clavier.

> [!TIP]
> **Premier jeu ?** Choisissez un parcours ci-dessous, puis ouvrez seulement son tutoriel.
> Vous pouvez essayer les observations synthétiques avant de brancher une caméra.

| Votre objectif | Premier essai | Ce qu'il faut préparer |
| --- | --- | --- |
| Un petit jeu Python avec webcam | [Pygame](pygame/README.fr.md) | Archive compilée ; Python seulement pour modifier le code |
| Un jeu Godot, Unity ou Unreal | [Godot](godot/README.fr.md), [Unity](unity/README.fr.md), [Unreal](unreal/README.fr.md) | Éditeur et démo synthétique ; fournisseur de points pour une vraie caméra |
| Un jeu dans le navigateur | [HTML](web/README.fr.md) | Node.js 22.12+, navigateur et autorisation caméra |
| Mon jeu fournit déjà les points du corps | [SDK C++](sdk-consumer/README.fr.md) | Aucun estimateur caméra pour le premier essai |

## Lancer une démo

> [!NOTE]
> Sur Debian, le Motion Input Grid Studio, le Motion Input Grid Controller et certains exemples natifs sont
> encore en cours de développement et de test. Ils peuvent ne pas fonctionner
> entièrement pour le moment.

Téléchargez un seul tutoriel **`*-standalone`** et extrayez-le entièrement.
Son README et ses lanceurs sont à la racine. Les modèles et bibliothèques natives
sont inclus ; les exemples navigateur demandent Node 22.12+ et un navigateur moderne.

| Exemple | Télécharger |
| --- | --- |
| Python / Tkinter | [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-python-tkinter-examples) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-python-tkinter-examples) |
| Pygame | [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-pygame-examples) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-pygame-examples) |
| SDL2 | [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-sdl2-examples) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-sdl2-examples) |
| SFML | [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-sfml-examples) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-sfml-examples) |
| C++ SDK consumer | [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-sdk-consumer-examples) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-sdk-consumer-examples) |
| C++ native consumer | [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-native-consumer-examples) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-native-consumer-examples) |
| HTML | [tar.gz](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-web-examples) |
| React | [tar.gz](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-react-examples) |
| Vue | [tar.gz](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-vue-examples) |
| Next.js | [tar.gz](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-next-examples) |
| Godot GDScript | [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-godot-gdscript-examples) · [Linux x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-godot-gdscript-examples) · [Linux ARM64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-godot-gdscript-examples) |
| Unity | [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-unity-examples) · [Linux x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-unity-examples) |
| Unreal | [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-unreal-examples) · [Linux x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-unreal-examples) · [Linux ARM64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-unreal-examples) |
| Godot C# | [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-godot-csharp-examples) · [Linux x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-godot-csharp-examples) |

1. Lancez un viewer du tableau ci-dessous et autorisez la caméra.
2. Gardez les deux épaules visibles une seconde pour le calibrage, puis baissez les mains.
3. Levez un poignet à travers les lignes vertes jusqu'à la ligne jaune.
4. Ouvrez la variante profil pour importer un JSON enregistré par le Motion Input Grid Studio.

Les objets et os des mains suivent les poignets. L'image est reflétée une fois ;
les actions restent anatomiques.

> [!TIP]
> Conservez les dossiers extraits ensemble. Lancez un seul viewer caméra à la fois.
> Baissez la main avant de refaire le mouvement.

| Plateforme | Démo de levée | Import de profil |
| --- | --- | --- |
| Windows x64 Tk/Pygame | `main.exe` | `profile.exe` dans le même dossier |
| Linux x64 Tk/Pygame | `./main` | `./profile` correspondant |
| Windows x64 SDL2/SFML | `mig-sdl2.exe` / `mig-sfml.exe` | Exécutable `-profile.exe` |
| Linux x64 SDL2/SFML | `./mig-sdl2` / `./mig-sfml` | Lanceur `-profile` |
| Archive JavaScript | `run.cmd` Windows x64 ou `sh run.sh` Linux x64/ARM64 à la racine de l'archive | `/profile.html` ou `/profile` pour Next |

### Prérequis natifs

Les exécutables natifs Windows nécessitent encore le dernier runtime Microsoft Visual C++
Redistributable : l'archive ne fonctionne donc pas forcément sur un Windows sans
aucun prérequis. Linux x64 cible Ubuntu 22.04+, Debian 12+, Fedora/Arch récents,
avec session X11/XWayland. glibc, pilotes et serveur graphique restent fournis par
le système. Le SDK ARM64 accepte les positions fournies ; le runtime caméra
épinglé n'existe pas sous Linux ARM64. Les binaires Windows ARM64 n'ont pas été compilés.

### Lanceurs navigateur

Les archives navigateur incluent pages compilées, sources, modèles, MediaPipe
et WASM. Installez Node 22.12+, puis lancez `run.cmd` ou `sh run.sh` à la racine.
Ouvrez localhost:8820 et cliquez sur Start. Aucun npm install ni CDN n'est requis
pour exécuter les pages compilées. Arrêtez le serveur avant de lancer un autre viewer.
Les fichiers HTML doivent être servis, jamais ouverts via file://.

### Importer un profil

Les importeurs commencent vides. Import profile charge un JSON schéma 2 ;
une erreur garde le profil actif. SDL2/Pygame acceptent aussi le dépôt de fichier.
Les actions/IDs s'affichent sans injection clavier. Les os des doigts nécessitent Hands dans le profil.

## Choisir une intégration

| Application | Exemple | Prérequis pour lancer depuis les sources |
| --- | --- | --- |
| Interface Python | [Tkinter](python-tkinter/README.fr.md), [Pygame](pygame/README.fr.md) | Python, dépendances UI et runtime caméra natif |
| Interface C++ | [SDL2](sdl2/README.fr.md), [SFML](sfml/README.fr.md) | Compilateur C++, dépendances graphiques et SDK natif |
| Navigateur | [HTML simple](web/README.fr.md) | Serveur web local et WASM/assets préparés |
| Framework | [React](react/README.fr.md), [Vue](vue/README.fr.md), [Next.js](next/README.fr.md) | Node.js et package npm/assets |
| Moteur de jeu | [Godot](godot/README.fr.md), [Unity](unity/README.fr.md), [Unreal](unreal/README.fr.md) | Éditeur/toolchain et fournisseur de points |
| Console / application personnalisée | [Positions C++](sdk-consumer/README.fr.md), [RGB natif](native-consumer/README.fr.md) | SDK ; estimateur caméra seulement pour l'exemple RGB |

Chaque intégration visuelle propose une démo de poignet levé et un importeur de
profil initialement vide. Elles partagent [raised-hands.json](common/raised-hands.json)
et le moteur C++. Les exemples de moteurs de jeu demandent leur éditeur et un
fournisseur d'observations ; ce ne sont pas des exports caméra autonomes.
Les consommateurs SDK sont des exemples console.
Consultez la [matrice de support](../docs/reference/support.fr.md).

## Adapter le code

Installez **`motion-input-grid`** avec [pip](../bindings/python/README.fr.md),
[npm](../bindings/javascript/README.fr.md), ou suivez le [guide SDK C++ / CMake](../docs/getting-started/cpp.fr.md).
Les [autres packages](../docs/getting-started/packages.fr.md) couvrent vcpkg, Debian
et les éditeurs. Chaque guide d'exemple décrit l'utilisation d'une bibliothèque
installée et le repli vers le dépôt complet.

Le [guide de démarrage](../docs/getting-started/bootstrap.fr.md) relie un profil
au retour d'action. Le [parcours du code](../docs/getting-started/examples.fr.md)
explique les modules et leur cycle de vie ; les [helpers communs](common/README.fr.md)
couvrent la découverte du runtime, les coordonnées et le dessin. Commencez par
remplacer le callback d'action par une commande de votre application.

## Sources et runtimes

Les exécutables Python figés incluent l'interpréteur, Tk/Pillow/Pygame et les
ressources natives. Aucun Python installé ni pip n'est nécessaire. Les scripts
restent à côté pour les modifier ; ils demandent Python 3.10+,
`python -m pip install motion-input-grid pillow pygame` et Tk pour les sélecteurs. L'import installé
`mig` est préféré, avec repli sur celui de l'archive.

Les exemples du checkout trouvent aussi le runtime natif dans `build/release/bin`
ou `build/debug/bin` après un build avec les presets CMake. La sélection automatique
exige la bibliothèque MediaPipe de la plateforme et le modèle de pose ; les modèles
seuls ne suffisent pas. Utilisez `MIG_RUNTIME` pour choisir un autre dossier runtime.

### Remplacement du runtime et diagnostics

`MIG_LIBRARY`/`MIG_RUNTIME` remplacent facultativement la découverte.
`--smoke` utilise des points synthétiques sans caméra. La fermeture rejoint
l'inférence avant le toolkit. MediaPipe peut écrire des avertissements de
télémétrie ; seuls, ils ne prouvent pas un crash. Une exécution sans téléchargement
ne garantit pas le silence de la télémétrie upstream. Les vérifications et
exigences restantes figurent dans la [préparation](../docs/reference/support.fr.md).

## Dossiers autonomes et recompilation

Téléchargez une archive `*-standalone` pour un seul tutoriel ou `*-examples` pour
les comparer. Dans l’archive individuelle, le tutoriel est directement à la racine :
README, point d’entrée, intégration, profil, runtime et licences. Les natives
contiennent leurs modèles/bibliothèques ; les individuelles navigateur nécessitent
Node 22.12+ (la groupée fournit Node). Les guides distinguent essai rapide et
compilation des sources hors dépôt. `example_usage.py`/`.hpp` ou `.mjs` expose
les appels MIG ; `support/` local contient les utilitaires visuels et ressources.
Les exemples d’éditeur fournissent le bridge natif et une démo synthétique.
