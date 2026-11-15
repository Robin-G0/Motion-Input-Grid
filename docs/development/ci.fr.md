# Intégration continue sélective

[English](ci.md) | [Français](ci.fr.md)

**Les push et pull requests testent les composants concernés.** Un petit job de
détection reste nécessaire pour sélectionner les contrôles ; les compilations
sans rapport apparaissent comme ignorées.

| Zone modifiée | Contrôles sélectionnés |
| --- | --- |
| `extensions/**` | Compilation de l'extension, tests unitaires/WASM, contrôles dans Chromium/Firefox, lint et paquets ZIP |
| `site/**` | Compilation du site, tests Node, Chromium et Firefox ; publication Pages sur `main` après succès |
| Markdown, `docs/**`, validateur documentaire | Tests documentaires, traductions et liens locaux |
| `src/apps/**`, `src/controller/**`, `tests/apps/**` | Compilations natives Windows et Linux, plus tests du SDK portable qui incluent les en-têtes partagés des applications |
| `src/linux-apps/**` ou tests d'interface propres à une plateforme | La plateforme native correspondante |
| Packaging du Controller Windows ou outils de packaging Linux | La plateforme native correspondante et les contrôles des paquets |
| Adaptateur caméra natif, binding Python et exemples Python de bureau | Contrôles natifs Windows et Linux |
| Binding JavaScript, exemples des frameworks, `src/web/**` | Production WASM puis consommateurs JavaScript |
| Moteur partagé, CMake, configurations ou chemin de code inconnu | Tous les consommateurs des sources : Windows, Linux natif, SDK portable et WASM/JavaScript |

Les fichiers C++ sélectionnent aussi **clang-format**. Les manifestes de version
sélectionnent les contrôles des métadonnées de publication. Des changements mixtes
cumulent les contrôles. Le site utilise sa **dépendance npm verrouillée** : modifier
le C++ du dépôt ne recompile pas le site sans changement des fichiers du site.

> [!NOTE]
> **Les dépendances partagées priment sur l'économie de runners.** Les applications
> natives partagent des en-têtes et des tests portables ; leurs contrôles ne sont
> donc pas toujours isolables à un exécutable. Un chemin source inconnu teste tous
> les consommateurs des sources pour éviter une omission silencieuse.

Le détecteur [ci-changes.py](../../tools/dev/ci-changes.py) est appelé par
[changes.yml](../../.github/workflows/changes.yml). Il compare le push complet
(`before` à `after`) ou l'ancêtre commun de la PR à sa tête, avec tout l'historique
Git. Les renommages incluent ancien et nouveau chemins, sans limite de fichiers
liée à une API. Le **résumé du job** affiche les contrôles sélectionnés.

> [!TIP]
> **Lancez un workflow manuellement pour exécuter tous ses contrôles.** Les premiers
> push sans référence et les comparaisons Git indisponibles font aussi tout tourner
> dans le workflow concerné. Les releases taguées continuent de valider **tous leurs
> artefacts**. Le packaging des intégrations de moteurs conserve son déclenchement manuel.

La CI générale expose **Affected checks passed**, qui échoue si la détection ou
un contrôle sélectionné échoue ou est annulé. Les compilations ignorées sont admises.
Les workflows du site, de la documentation et des extensions gardent leurs propres contrôles.
La protection des branches se configure séparément des fichiers de workflow.

Pour valider un changement des filtres en local :

```sh
python tests/tooling/ci_changes_tests.py
python tools/dev/check-docs.py
actionlint .github/workflows/changes.yml .github/workflows/ci.yml .github/workflows/docs.yml .github/workflows/pages.yml
```
