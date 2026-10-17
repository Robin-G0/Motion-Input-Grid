# Motion Input Grid Studio et Motion Input Grid Controller Windows

[English](windows.md) | [Français](windows.fr.md)

**Sans compilation :** [Télécharger Studio + Controller](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications).

<details>
<summary>Dans cette page</summary>

- [Compiler et lancer](#compiler-et-lancer)
- [Dessiner](#dessiner)
- [Sorties, Test, enregistrement](#sorties-test-enregistrement)
- [Tests et origine](#tests-et-origine)

</details>

Pour utiliser les applications précompilées, suivez les guides du
[Motion Input Grid Studio](../guides/configurator.fr.md) et du [Motion Input Grid Controller](../guides/controller.fr.md).
Cette page décrit la compilation et les contrôles propres à la plateforme.
Pour une bibliothèque seule, consultez le [SDK C++ / CMake](cpp.fr.md),
[Python](../../bindings/python/README.fr.md) ou [JavaScript](../../bindings/javascript/README.fr.md).

Les deux apps C++20 Win32/GDI partagent capture Media Foundation, MediaPipe natif,
moteur et schéma 2. Pas d'interpréteur ni pont UDP. L'UI reste anglaise ; les guides
sont bilingues.

Le Motion Input Grid Controller dispose d’une interface dédiée aux profils et actions. Consultez
le [guide du Motion Input Grid Controller](../guides/controller.fr.md) pour l’import, la sélection mémorisée,
le mode compact et la vérification. Les outils de dessin ci-dessous concernent
Motion Input Grid Studio.

## Compiler et lancer

| Prérequis | Utilité |
| --- | --- |
| **Windows 10/11 x64** | Cible des applications natives |
| **Visual Studio 2022 C++ Build Tools / SDK Windows** | Compilateur et en-têtes système |
| **CMake 3.25+** | Configurer la compilation |
| Internet pour la préparation | Télécharger une fois bibliothèques et modèles épinglés ; `-SkipBootstrap` les réutilise |

Les binaires MSVC sans runtime fourni demandent un runtime Visual C++ compatible
sur la machine cible. Le [Controller autonome](controller-standalone.fr.md) inclut le sien.

```powershell
powershell -ExecutionPolicy Bypass -File tools/build/build-windows.ps1
.\build\windows\bin\motion-input-grid-studio.exe
.\build\windows\bin\motion-input-grid-controller.exe
```

### VS Code et presets CMake

Pour les presets `release` ou `debug`, lancez le bootstrap une fois à la racine :

```powershell
powershell -ExecutionPolicy Bypass -File tools/bootstrap/bootstrap-native.ps1
cmake --preset release
cmake --build --preset release
ctest --preset release
```

Dans VS Code, choisissez `release`, puis **CMake: Configure** et **CMake: Build**.
Les programmes se trouvent dans `build/release/bin`. Si CMake n'est pas dans le
PATH du terminal, utilisez les commandes CMake de VS Code ou le script précédent.
Choisissez `sdk-release` pour les bibliothèques seules, sans applications caméra.

Arrêtez une caméra avant l'autre app. Gardez DLL/modèles/configs près du binaire,
ressources relatives à l'exécutable. --config et --camera N choisissent profil et
caméra. Le Motion Input Grid Studio démarre vide, Right V Recalibrate inactive sans Hands. Le profil fourni
est ouvert explicitement et n'impose aucun dessin. Le Motion Input Grid Controller restaure son dernier
profil sélectionné, avec la caméra et la sortie clavier désactivées.

```powershell
powershell -ExecutionPolicy Bypass -File tools/build/build-windows.ps1 -SkipBootstrap
powershell -ExecutionPolicy Bypass -File tools/build/build-windows.ps1 -Hands OFF -BuildDirectory build/windows-no-hands
cmake --install build/windows --config Release --prefix install
```

Capture préfère les modes larges jusqu'à 1280×720, ajuste toute l'image sans découpe.
Le champ visible reste limité au capteur. Lite par défaut, --pose-full compare
précision/coût ; --pose-lite rétablit Lite. Les deux calculent 33 points, même sans
jambes. Comparez temps/âge/précision avec même éclairage et réglage Hands.

## Dessiner

Le [guide illustré du Studio](../guides/configurator.fr.md) décrit le parcours
d'édition ; le [guide du Controller](../guides/controller.fr.md) explique comment
utiliser un profil enregistré.

| Objectif | Comportement sous Windows |
| --- | --- |
| Éditer et tester | **Movements**, **Edit** et **Test** partagent la fenêtre principale. |
| Dessiner un parcours | Choisissez le point suivi et Required, Trigger, Forbidden ou Interaction. L'inspecteur Zones choisit l'étape et son mode de parcours. |
| Changer le point suivi | Les zones lui sont réaffectées immédiatement ; une collision est refusée sans perte. Les mains explicites des signes/doigts et l'identité des traces restent inchangées. |
| Annuler un dessin | **Ctrl+Z / Ctrl+Y** annulent ou rétablissent. Un trait est une opération. |
| Enregistrer | Les modifications d'un mouvement existant actualisent le document ; **Apply** ajoute un nouveau mouvement. **File > Save** écrit le fichier. |
| Examiner la caméra | Body suit l'échelle des épaules ; Full grid montre les **27 × 27** cases. L'image est reflétée une fois. |
| Lire les logs | Le terminal flottant se déplace et se redimensionne. Lire les anciens événements suspend le défilement jusqu'au retour en bas. |

> [!NOTE]
> **Masquer les dessins des mains n'arrête pas leur inférence.** Le réglage Hands
> contrôle cette capacité. Les règles de doigts/signes exigent toujours des
> observations fiables. Voir le [guide des mains](../guides/hands.fr.md).

## Sorties, Test, enregistrement

**Movement settings** regroupe nom, action et séquence clavier. L'éditeur accepte
le texte entre guillemets, `_` pour la succession et `+` pour un accord :

```text
"Hello world" _ Enter _ Ctrl + C
```

| Commande | Effet |
| --- | --- |
| **Single press** | Exécuter la séquence une fois par mouvement reconnu. |
| **Hold** | Exécuter le préfixe une fois puis maintenir le dernier accord ; la séquence doit finir par un accord. |
| **Repeat** | Répéter selon l'intervalle **20..60000 ms** tant que les conditions finales restent actives. |
| **Test** | Isoler un mouvement et afficher la reconnaissance **sans envoyer de touches**. |
| **Restart / Recalibrate** | Effacer les tentatives / remplacer l'ancre ; les commandes par signe exigent un relâchement avant réutilisation. |

> [!IMPORTANT]
> **La sortie clavier démarre désactivée et cible l'application au premier plan.**
> Perte des conditions, données périmées, Stop, dialogues, édition et Test annulent
> ou libèrent la sortie. La [référence de configuration](../reference/configuration.fr.md)
> précise les délais, modificateurs partagés et commandes globales.

Les outils d'enregistrement **ne sont pas présentés dans l'interface actuelle du
Studio**. Les traces existantes restent compatibles avec le schéma. Les champs
de texte conservent leurs commandes ordinaires de copie et Ctrl+Z/Y.

## Tests et origine

```powershell
ctest --test-dir build/windows -C Release --output-on-failure
ctest --test-dir build/windows-no-hands -C Release --output-on-failure
```

UI synthétique sans caméra, infer/hands-test sur images vides, camera/session-test
explicitement matériels sans clavier. [Résultats et limites](../reference/support.fr.md).
Bootstrap extrait le wheel officiel0.10.35 comme archive, headers/modèles C ABI
SHA256 épinglés. Pas de Python/Bazel pendant l'exécution ; CPU XNNPACK.
Modèles téléchargés en setup, licences MediaPipe/JSON fournies.
[Paquet officiel](https://pypi.org/project/mediapipe/0.10.35/),
[guide pose](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker).
Connexions de télémétrie observées, silence réseau non garanti. Revue transitive
licences/modèles manuelle. Face/gamepad/analogique/courbure/replay prévus ; Hold
clavier existe bien.
