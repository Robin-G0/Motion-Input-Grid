# Dépendances du Controller Windows

[English](windows-runtime-dependencies.md) | [Français](windows-runtime-dependencies.fr.md)

Le Controller Windows en un fichier embarque ses dépendances applicatives et
licences. Visual Studio n’est pas un prérequis d’exécution. Voir
l’[architecture du cache](../getting-started/controller-standalone.fr.md).

## Fermeture des DLL applicatives

Pour les binaires Controller et MediaPipe v1.1.0 vérifiés, toutes les DLL non
système requises sont incluses et validées dans le dossier adressé par hash :

| Fichier | Rôle |
| --- | --- |
| `motion-input-grid-controller.exe` | Controller natif |
| `libmediapipe.dll` | Inférence corps/mains chargée explicitement |
| `msvcp140.dll` | Bibliothèque standard C++ |
| `msvcp140_atomic_wait.dll` | Attente atomique C++ |
| `vcruntime140.dll` | Runtime Microsoft C/C++ |
| `vcruntime140_1.dll` | Support C++ x64 supplémentaire |

Le dossier CRT app-local complet est conservé. Il inclut aussi `concrt140.dll`,
`msvcp140_1.dll`, `msvcp140_2.dll`, `msvcp140_codecvt_ids.dll`, `vccorlib140.dll`
et `vcruntime140_threads.dll`. Ces six fichiers ne sont pas requis par la
fermeture d’imports Controller/MediaPipe vérifiée. Tous les fichiers embarqués
sont hashés, qu’ils soient utilisés ou non. `mig-c.dll` n’est pas requis ni inclus.

Le Controller importe directement les composants Windows `comctl32.dll`,
`comdlg32.dll`, `dwmapi.dll`, `gdi32.dll`, `kernel32.dll`, `mf.dll`, `mfplat.dll`,
`mfreadwrite.dll`, `ole32.dll`, `shell32.dll`, `user32.dll`, `uxtheme.dll` et les
contrats API-set du CRT universel Windows. MediaPipe importe directement
`advapi32.dll`, `dbghelp.dll`, `kernel32.dll` et `wininet.dll`. `dbghelp.dll`
fait partie de Windows et ne demande pas d’outils de développement.

Les composants système, contrats API-set, Media Foundation, pilotes et
autorisations caméra restent des prérequis de la plateforme. Utilisez Windows
x64 avec Media Foundation disponible. Une édition Windows N peut demander
l’activation de sa fonction média ; le bundle ne remplace pas ce composant
Windows ni un pilote de caméra.

## Inventaire complet lisible par programme

`tools/lib/pe_dependencies.py` analyse les imports normaux, retardés et les
exports redirigés. Le packaging part de tous les EXE/DLL embarqués, y compris
MediaPipe chargé explicitement et absent de la table d’imports du Controller.
Il parcourt récursivement les fichiers embarqués et System32, puis répertorie
les contrats API-set. Il ne cherche jamais dans le PATH de développement.
Une bibliothèque applicative manquante fait échouer le packaging, même si un CRT
de développement est installé dans System32. Seuls les composants Windows
autorisés peuvent satisfaire un import système direct de l’application.

Fichiers produits :

- `<controller.exe>.dependencies.json` : graphes du payload et du lanceur à CRT
  statique, hashes, imports et chargements Windows optionnels absents.
- `windows-dll-dependencies.json` dans le cache : inventaire embarqué du payload,
  protégé lui aussi par les hashes intégrés au lanceur.
- `<controller.exe>.observed-modules.json` après les tests : modules observés
  dans le processus Controller pendant les diagnostics UI et d’inférence.

Le graphe du payload sur l’hôte vérifié contient 286 modules System32 et 730
contrats API-set. Ce sont les imports normaux, retardés et redirections de cet
hôte, pas 286 bibliothèques à installer ni des DLL Windows à redistribuer.
Les nombres et hashes système varient selon Windows. Les imports retardés
optionnels de Windows absents sont signalés explicitement.

## Vérification et limites

```powershell
python tests/packaging/controller_package_tests.py
python tests/packaging/pe_dependency_tests.py
python tests/packaging/controller_runtime_tests.py build/releases/motion-input-grid-1.1.0-controller-windows-x64.exe
```

L’EXE est testé depuis un dossier ne contenant que lui. Le PATH enfant ne contient
que Windows. Les tests vérifient création, réutilisation et réparation du cache,
et observent les modules chargés. Les 76 modules observés provenaient du cache
validé ou de Windows, y compris pendant l’inférence MediaPipe. Aucun module
de développement extérieur n’a été accepté. Le lanceur est audité séparément :
son CRT `/MT` reste statique et ses autres imports proviennent de Windows.

L’analyse PE ne peut pas énumérer tous les plugins ou pilotes choisis par Windows
à l’ouverture d’une vraie caméra. L’observation couvre les diagnostics, pas tous
les appareils possibles. Aucune VM Windows vierge n’était disponible pour ce
contrôle. Gardez donc le test caméra/clavier sur une machine cible propre avant
publication ; un PATH assaini n’équivaut pas à une installation Windows neuve.
