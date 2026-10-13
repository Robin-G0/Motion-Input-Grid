# Motion Input Grid (MIG)

[English](../../readme.md) | [Français](readme.fr.md)

## 🚀 [Essayez le projet dans votre navigateur avant d'en apprendre plus !](https://robin-g0.github.io/Motion-Input-Grid/) ✨

> [!NOTE]
> MIG est en cours de développement et vient de commencer à publier ses premières versions.
> Tous les [retours et suggestions](https://github.com/Robin-G0/Motion-Input-Grid/issues) sont les bienvenus.

**Transformez un mouvement en action.** Dessinez le trajet d'un poignet ou d'une
autre partie du corps, puis utilisez une caméra pour le reconnaître. MIG peut
envoyer un raccourci clavier à votre application ou transmettre une action à
votre jeu, site web ou programme Python.

Levez la main pour avancer une présentation, utilisez un mouvement dans un jeu
ou associez un signe de main à un raccourci. Vous choisissez les mouvements et
leurs commandes.

[**Télécharger**](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.0.2#user-content-downloads) ·
[**Documentation**](../index.fr.md) · [**Exemples**](../../examples/README.fr.md)

[Essayer](#essayer-mig-maintenant) · [Téléchargements](#téléchargements) · [Applications](#utiliser-mig-sur-votre-ordinateur) · [Intégrer MIG](#intégrer-mig-dans-votre-application) · [Architecture](#explorer-le-moteur)

## Essayer MIG maintenant

Ouvrez [**MIG Studio Web**](https://robin-g0.github.io/Motion-Input-Grid/studio/)
pour créer, importer et tester un profil JSON sans installer l’éditeur de bureau.
Exportez ensuite le profil vers **MIG Input** pour envoyer des raccourcis à une
autre application. [Guide Studio Web](../guides/studio-web.fr.md).

Chaque téléchargement contient un seul tutoriel, ses sources et ses dépendances.
Extrayez toute l'archive et suivez son README. Comptez environ 30–60 secondes avec
les prérequis installés ; le chargement des modèles dépend du matériel.

| Exemple | Essayez-moi | Lancement |
| --- | --- | --- |
| [Navigateur](../../examples/web/README.fr.md) | [Télécharger](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.0.2#user-content-web-examples) | `run.cmd` / `sh run.sh`, puis ouvrez localhost et autorisez la caméra |
| [Python/Tk](../../examples/python-tkinter/README.fr.md) | [Windows / Linux](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.0.2#user-content-python-tkinter-examples) | `main.exe` / `./main` ; Python est fourni |
| [SDL2](../../examples/sdl2/README.fr.md) | [Windows / Linux](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.0.2#user-content-sdl2-examples) | `mig-sdl2.exe` / `./mig-sdl2` ; levez un poignet du vert vers le jaune |

Navigateur : Node 22.12+ et navigateur moderne. Viewers natifs : runtime Visual C++
2022 x64 sous Windows, glibc 2.35+ sous Linux. Les tutoriels des moteurs de jeu
demandent leur éditeur et un fournisseur de suivi ; ils restent **Preview**.

## Téléchargements

Choisissez votre usage, puis un exemple et votre plateforme dans le tableau de la release.

| Votre besoin | Téléchargements de la dernière release |
| --- | --- |
| Créer un profil et piloter une application | [Applications de bureau](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.0.2#user-content-desktop-applications) |
| Essayer Python, SDL2, SFML ou un consumer C++ | [Exemples natifs indépendants](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.0.2#user-content-native-examples) |
| Essayer HTML, React, Vue ou Next.js | [Exemples navigateur indépendants](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.0.2#user-content-browser-examples) |
| Utiliser Godot, Unity ou Unreal | [Tutoriels et intégrations des moteurs](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.0.2#user-content-game-engines) |
| Intégrer MIG dans votre projet | [SDK et packages Python/npm/Debian](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.0.2#user-content-sdks-and-language-packages) |
| Compiler ou vérifier un téléchargement | [Sources et empreintes](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.0.2#user-content-source-and-integrity-files) |

## Utiliser MIG sur votre ordinateur

> [!NOTE]
> Sur Debian, MIG Studio, MIG Input et certains exemples natifs sont
> encore en cours de développement et de test. Ils peuvent ne pas fonctionner
> entièrement pour le moment.

Aucun code n'est nécessaire pour créer et utiliser un profil de mouvements.

1. Téléchargez [**desktop applications archive**](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.0.2#user-content-desktop-applications) pour Windows x64 ou Linux x64 et extrayez-la entièrement.
2. Ouvrez le [**MIG Studio**](../guides/configurator.fr.md), démarrez la caméra,
   dessinez votre mouvement et enregistrez son profil.
3. Ouvrez le [**MIG Input**](../guides/controller.fr.md), importez ce profil et
   essayez le mouvement. Sa ligne s'allume lorsqu'il est reconnu. Activez
   **Keyboard output** pour envoyer des touches à l'application que vous utilisez.

| Dessiner une condition | Signification |
| --- | --- |
| 🟩 Required | Traversez cette région ; les numéros définissent l'ordre. |
| 🟥 Forbidden | Évitez cette région. |
| 🟨 Trigger | Terminez le mouvement ici. |
| 🟪 Interaction | Faites un signe de main ici, avec un maintien facultatif. |

> [!TIP]
> Pour découvrir le suivi sans envoyer de touches, commencez par les
> [exemples caméra autonomes](../../examples/README.fr.md).
> Levez une main et observez le retour visuel.

Les archives de bureau incluent le runtime caméra et les modèles. Conservez
tous leurs fichiers ensemble. Windows demande le runtime Visual C++ 2022 x64 ;
Linux demande glibc 2.35+. L'envoi de touches sous Linux utilise X11/XTest.
Les guides des applications expliquent le lancement, le calibrage, les thèmes
et la résolution des problèmes.

## Intégrer MIG dans votre application

Toutes les intégrations partagent le **moteur C++20**. Créez un profil JSON dans
MIG Studio, puis importez-le dans votre application. Fournissez les points
du corps ou utilisez un adaptateur caméra disponible.

Les gestionnaires de packages utilisent **`motion-input-grid`**. Les API gardent
le nom court : Python importe `mig` ; CMake exporte `MIG::core`.

### Python

```sh
python -m pip install motion-input-grid
python -c "from mig import Tracker; print('MIG ready')"
```

Le wheel inclut le moteur de reconnaissance pour les positions fournies.
Les viewers caméra utilisent un runtime natif séparé.
[Utilisation Python et exemple de frame](../../bindings/python/README.fr.md).

### Navigateur, React, Vue et Next.js

```sh
npm install motion-input-grid
npx mig-copy-assets public/mig
```

Le package inclut WASM, les modèles caméra et les adaptateurs des frameworks.
Servez les fichiers depuis votre application et démarrez le suivi après un clic.
[Utilisation JavaScript](../../bindings/javascript/README.fr.md) ·
[Exemples des frameworks](../integrations/javascript.fr.md).

### C++ et moteurs de jeu

| Intégration | Par où commencer |
| --- | --- |
| C++ / CMake / Make | [Installer le SDK et lier `MIG::core`](../getting-started/cpp.fr.md) |
| vcpkg | [Installer avec l'overlay de la release](../../ports/motion-input-grid/README.fr.md) |
| Debian / Ubuntu | [Installer un `.deb` téléchargé](../getting-started/packages.fr.md#debianubuntu) |
| Godot | [Add-on GDScript et exemples C#](../../integrations/godot/README.fr.md) |
| Unity | [Package UPM .NET / C ABI](../../integrations/unity/README.fr.md) |
| Unreal | [Plugin natif C ABI](../../integrations/unreal/README.fr.md) |

Un projet CMake lie le SDK installé ainsi :

```cmake
find_package(MIG 1.0 CONFIG REQUIRED)
target_link_libraries(my-application PRIVATE MIG::core MIG::format)
```

Le [guide C++](../getting-started/cpp.fr.md) contient un projet complet, les
commandes de compilation et les prérequis. Les intégrations des moteurs de jeu
demandent un fournisseur de points ; elles n'incluent pas le suivi caméra de bureau.

## Explorer le moteur

![Les points passent par le calibrage et la reconnaissance pour produire des actions](../assets/architecture/engine-flow.svg)

L'[architecture](../architecture/overview.fr.md) décrit les modules et leurs
responsabilités. Le [format de configuration](../reference/configuration.fr.md),
l'[API C++](../reference/cpp.fr.md) et l'[ABI C](../reference/c-abi.fr.md)
décrivent la reconnaissance, l'état actif d'une action et les cycles de vie.

MIG 1.0.2 fournit des applications Windows/Linux x64 et des SDK Linux ARM64
pour les positions fournies. Les intégrations des moteurs de jeu sont Preview.
Les tests automatisés couvrent la reconnaissance et les packages ; les caméras
physiques, l'envoi de touches au jeu visé et les exports des éditeurs demandent
une validation séparée. Consultez la [matrice de support](../reference/support.fr.md)
pour choisir une plateforme.

Compiler depuis les sources : [Windows](../getting-started/windows.fr.md) ·
[Linux](../getting-started/linux.fr.md) · [SDK portable](../getting-started/cpp.fr.md).

[Contribuer](CONTRIBUTING.fr.md) · [Historique](../development/CHANGELOG.fr.md) ·
[Roadmap](../development/ROADMAP.fr.md) · [Installation des packages](../getting-started/packages.fr.md)

Licence [Apache-2.0](../../LICENSE). Les dépendances redistribuées conservent leurs notices.

## Tutoriels à copier

Les archives `*-standalone` placent un exemple et ses dépendances dans un dossier.
Commencez par son README, puis `example_usage.py`/`.hpp` ou le fichier
d’intégration framework/éditeur indiqué. Les individuelles navigateur nécessitent
Node 22.12+ ; la groupée JavaScript fournit Node. Les individuelles natives
fournissent leurs bibliothèques/modèles. [Choisir un tutoriel](../../examples/README.fr.md).

[Outils et contenu des packages](../../tools/README.fr.md) · [Vérifier une intégration](../../tests/README.fr.md)
