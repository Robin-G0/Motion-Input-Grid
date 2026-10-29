# Outils de compilation et contenu des packages

[English](README.md) | [Français](README.fr.md)

Utilisez ces outils pour compiler MIG, adapter un tutoriel ou préparer un package
pour une autre machine. Pour essayer un téléchargement, commencez par son README
ou le [guide des packages](../docs/getting-started/packages.fr.md). Exécutez les
commandes depuis la racine du dépôt. Les fichiers générés vont dans `build/` ou `distribution/`.

## Choisir un outil

| Dossier | Fonction | Points d'entrée |
| --- | --- | --- |
| `bootstrap/` | Télécharger et vérifier bibliothèques natives, modèles, assets navigateur, Node et Godot. | [Windows](bootstrap/bootstrap-native.ps1), [Linux](bootstrap/bootstrap-native-linux.py), [assets web](bootstrap/bootstrap-web.cmake), [runtime MediaPipe web](bootstrap/bootstrap-browser.mjs), [Node](bootstrap/bootstrap-node.mjs), [Godot](bootstrap/bootstrap-godot.py) |
| `build/` | Configurer, compiler et tester applications et tutoriels. | [Windows](build/build-windows.ps1), [Linux](build/build-linux.sh), [exemples Windows](build/build-examples.ps1), [exemples Linux](build/build-examples.sh), [builds Linux de distribution](build/build-linux-release.sh) |
| `web/` | Préparer les ressources navigateur et servir les fichiers sur localhost. | [Préparation](web/prepare-javascript.mjs), [serveur HTTP](web/serve-javascript.mjs) |
| `packaging/` | Assembler bibliothèques, applications et tutoriels distribuables. | Voir le tableau ci-dessous. |
| `release/` | Vérifier les versions, créer les inventaires et contrôler les empreintes des packages. | [Version](release/release-version.py), [manifeste](release/release-manifest.py), [empreintes](release/release-checksums.py) |
| `dev/` | Vérifier liens/traductions et formater le C++. | [Documentation](dev/check-docs.py), [formatage](dev/format-code.ps1) |
| `lib/` | Utilitaires Python/PowerShell partagés par les commandes. | [Assemblage des archives/runtimes](lib/package_linux.py), [métadonnées](lib/release_metadata.py), [exclusions](lib/distribution_policy.py), [téléchargements](lib/download.ps1) |
| `docker/` | Environnements Linux de compilation et runtime minimal pour tester les téléchargements. | [Développement natif](docker/linux-sdk.Dockerfile), [distribution](docker/linux-release.Dockerfile), [test isolé](docker/linux-example-test.Dockerfile) |

## Compiler et adapter

```powershell
powershell -ExecutionPolicy Bypass -File tools/build/build-windows.ps1
```

```sh
bash tools/build/build-linux.sh
```

Consultez les prérequis [Windows](../docs/getting-started/windows.fr.md) et
[Linux](../docs/getting-started/linux.fr.md). Pour le navigateur, suivez le
[guide JavaScript](../docs/integrations/javascript.fr.md) : `npm run prepare:javascript`
utilise `web/prepare-javascript.mjs` pour copier WASM compilé, modèles, profils et licences.

Chaque tutoriel possède son intégration et son affichage. Étudiez `example_usage`
ou le composant du moteur, puis branchez vos données et vos actions.
`examples/common/` contient les assets canoniques ; un package individuel ne
dépend pas de ce dossier dans un dépôt voisin. Voir l'[index des tutoriels](../examples/README.fr.md).

## Contenu produit par les packagers

La plupart des commandes Python décrivent leurs arguments avec `--help`.

> [!IMPORTANT]
> **Créez le package sur le système cible après compilation.** Le packager assemble
> les fichiers existants ; il ne convertit pas les binaires Windows en binaires Linux.

La sortie par défaut est `build/releases/` lorsque prévue.
Le bootstrap/packaging JavaScript utilise `python` sous Windows et `python3` sous Linux ;
`MIG_PYTHON` choisit un autre interpréteur. Les pages compilées ne nécessitent pas Python.

| Commande dans `packaging/` | Entrée et résultat |
| --- | --- |
| [package-sdk.py](packaging/package-sdk.py) | SDK CMake installé → headers, bibliothèques, ABI C, cibles CMake et licences ; points fournis par l'application, sans estimateur/modèles caméra. |
| [package-linux.py](packaging/package-linux.py) | Installation Linux → archive SDK ou desktop ; `--native` ajoute applications, bibliothèques caméra, modèles et dépendances runtime. |
| [package-distribution.ps1](packaging/package-distribution.ps1), [package-windows-release.ps1](packaging/package-windows-release.ps1) | Préparer les sorties SDK/applications/navigateur sous `distribution/`, puis archiver la distribution desktop Windows complète. |
| [package-python.py](packaging/package-python.py) | Sources du moteur/binding → wheel natif pour points fournis et archive source. Une caméra nécessite aussi un runtime natif avec capture. |
| [normalize-python-wheels.py](packaging/normalize-python-wheels.py) | Vérifier empreintes/tailles et normaliser RECORD après réparation, sans entrées de répertoires. Exécuté après compilation des wheels et réparation auditwheel Linux. |
| [package-source.py](packaging/package-source.py) | Sources core/CMake → archive source et overlay vcpkg épinglé à son empreinte. |
| [freeze-python-examples.py](packaging/freeze-python-examples.py) | Tutoriels Python → exécutables avec interpréteur et dépendances graphiques. Nécessite PyInstaller 6.16.0, Pillow 11.3.0, Pygame 2.6.1 et les runtimes Tcl/Tk/Python partagé du système. |
| [package-examples.py](packaging/package-examples.py) | Tutoriels natifs compilés/figés → archive commune partageant runtime/modèles ; `--standalone` produit aussi six archives indépendantes. |
| [package-single-example.py](packaging/package-single-example.py) | Arbre natif préparé → tutoriel à la racine avec runtime, configuration, sources, licences et SDK/binding nécessaires. |
| [package-javascript-examples.mjs](packaging/package-javascript-examples.mjs) | Tutoriels navigateur compilés → archive commune avec pages, assets locaux et Node portable ; produit aussi les archives individuelles via le packager navigateur. Commande : `npm run package:examples`. |
| [package-browser-example.py](packaging/package-browser-example.py) | Arbre JavaScript préparé → tutoriel avec pages compilées et dépendance npm locale pour reconstruire. Node 22.12+ reste externe. |
| [package-integrations.py](packaging/package-integrations.py) | ABI C installé → add-on Godot, package UPM Unity ou plugin Unreal, plus les projets/plugins tutoriels autonomes correspondants. |
| [package-editor-examples.py](packaging/package-editor-examples.py) | Intégration préparée → projet/plugin tutoriel avec pont, profil et bibliothèques natives. Éditeur/outils et fournisseur réel de tracking restent externes. |
| [prepare-windows-packages.ps1](packaging/prepare-windows-packages.ps1), [prepare-linux-packages.sh](packaging/prepare-linux-packages.sh) | Assembler et vérifier les artefacts SDK et langages. Utiliser `-EngineIntegrationsOnly` (Windows) ou `--engines-only` (Linux) pour les artefacts moteurs, compilés par le workflow manuel **Build engine integrations (manual)**. |
| [archive-examples.py](packaging/archive-examples.py) | Créer une archive tar et son empreinte depuis un arbre d'exemples déjà préparé. |

Conservez tout le contenu extrait. Les lanceurs natifs résolvent les ressources
par rapport au package ; les lanceurs navigateur démarrent un serveur local.
Les tutoriels moteurs sont des projets/plugins d'éditeur, pas des jeux exportés.
Les archives individuelles ne nécessitent aucun dépôt parent. Modifier/recompiler
les sources exige les dépendances documentées du compilateur, framework ou éditeur.

## Vérifier une intégration ou un téléchargement

```sh
python tools/dev/check-docs.py
python tools/release/release-checksums.py build/releases --check
```

La seconde commande nécessite un fichier `SHA256SUMS`. `release/release-manifest.py`
enregistre tailles/empreintes et crée ce fichier. Une empreinte détecte une corruption
mais ne prouve pas l'identité de l'éditeur.
Le [guide des tests](../tests/README.fr.md) décrit CTest, bindings et archives extraites.
La [matrice de support](../docs/reference/support.fr.md) distingue validation automatique,
compatibilité caméra et support des éditeurs/exports.
