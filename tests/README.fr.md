# Tests

[English](README.md) | [Français](README.fr.md)

Les tests sont classés selon le comportement vérifié. Chaque domaine C++ possède
ses cibles CMake et ses déclarations CTest ; [CMakeLists.txt](CMakeLists.txt) les assemble.

| Dossier | Couverture |
| --- | --- |
| `core/` | Reconnaissance, contraintes, sessions, coordonnées et mains |
| `format/` | Validation JSON et aller-retour des configurations |
| `native/` | Runtime caméra, observations, pixels et propriété des images |
| `apps/` | Édition, profils, règles clavier et helpers de prévisualisation |
| `ui/linux/`, `ui/windows/` | Interactions des applications, thèmes et widgets natifs |
| `bindings/` | Consommateurs C ABI, Python, JavaScript/WASM et .NET |
| `examples/` | Profils de démo, découverte du runtime, viewers et sélecteurs de fichiers |
| `packaging/` | SDK installés, wheels, npm, packages de moteurs et archives de release |
| `tooling/` | Téléchargements et résolution des versions |
| `benchmarks/` | Mesures synthétiques des performances du moteur |
| [`../site/tests/`](../site/tests/) | Tests unitaires, d'intégration et navigateur de la présentation et du Studio web |

## Tests C++ et applications

Exécutez ces commandes depuis la racine du dépôt :

```sh
cmake -S . -B build/sdk -DMIG_BUILD_CONFIGURATOR=OFF -DMIG_BUILD_CONTROLLER=OFF
cmake --build build/sdk --config Release --parallel 3
ctest --test-dir build/sdk -C Release --output-on-failure
```

Pour les tests des applications, compilez-les selon le guide
[Windows](../docs/getting-started/windows.fr.md) ou
[Linux](../docs/getting-started/linux.fr.md), puis lancez CTest sur ce build.
Les tests UI utilisent les applications réelles via `--ui-test` ; leur code vit
ici et n'est compilé qu'avec `MIG_BUILD_TESTS=ON`. Linux utilise la plateforme
offscreen de Qt. Les tests UI ont un délai de 30 secondes et s'exécutent en série.
Sélectionnez les tests UI Linux avec
`ctest --test-dir build/linux-native -R '^linux-.*-ui$'`.

`MIG_BUILD_TESTS=OFF` exclut les tests et les modes de diagnostic de test des applications.
Activez `MIG_BUILD_BENCHMARKS=ON` pour compiler `mig-engine-benchmark` dans
`build/<configuration>/tests/benchmarks/` (avec `Release/` pour Visual Studio).

## Tests par scripts

`packaging/standalone_editor_tests.py --build-csharp` valide les dépendances
d’éditeur isolées et compile le projet Godot .NET fourni. L’exécution dans
Unity/Unreal et les exports nécessitent encore leurs éditeurs installés.

```sh
python tests/tooling/release_version_tests.py
python tests/tooling/docs_tests.py
python tools/dev/check-docs.py
python tests/tooling/version_resolution_tests.py
python tests/packaging/example_package_tests.py
python tests/packaging/wheel_record_tests.py
python tests/bindings/python/python_tests.py build/windows/src/c-api/Release/mig-c.dll
npm test
npm run test:types
npm --prefix site run build
npm --prefix site test
```

Les tests du binding Python et des exemples demandent une bibliothèque C ABI compilée.
Les tests navigateur et de packaging demandent aussi les assets préparés ou l'artefact
passé en argument. Le [guide des outils](../tools/README.fr.md) décrit la préparation
des binaires et packages nécessaires à chaque vérification.

Le site est un projet npm indépendant, lié à une version publiée du package
navigateur. Ses tests ne vérifient donc pas le moteur compilé dans le dépôt.
`npm --prefix site run test:browser` teste le site construit sous Chromium et
Firefox. Une modification du cœur nécessite une nouvelle compilation native ou
WASM ; les tests navigateur racine utilisent `build/web/web/mig.mjs`.

La scène de régression Godot reste dans `examples/godot/gdscript/tests/` : elle accompagne
le projet d'exemple utilisé pour valider l'add-on extrait et est exécutée par
`packaging/godot_package_tests.py`.

Les tests d’archives tutoriels sont `packaging/standalone_example_tests.py`
(Windows/Linux natif), `packaging/standalone_browser_tests.py` (navigateur avec
Playwright) et `packaging/godot_package_tests.py` (addon ou projet autonome).
Les tests d’intégration acceptent aussi Unity/Unreal autonomes. La CI release
les exécute après packaging.

La release Linux teste aussi les archives natives dans `tools/docker/linux-example-test.Dockerfile` :
seuls les archives et le script de test sont montés, sans checkout ni bibliothèques de développement.
