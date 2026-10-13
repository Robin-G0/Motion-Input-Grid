# Motion Input Grid (MIG)

[English](../../readme.md) | [Français](readme.fr.md)

# [<img src="../../site/favicon.svg" width="32" height="32" alt=""> Découvrez le site de présentation](https://robin-g0.github.io/Motion-Input-Grid/)

Commencez ici pour une **introduction rapide et une démonstration interactive du concept**, directement dans votre navigateur.

**Transformez un mouvement en action.** Dessinez un parcours pour un poignet ou
une autre partie du corps, puis reconnaissez-le avec une caméra. Utilisez les
actions dans votre projet ou envoyez des raccourcis à une application de bureau.

| Commencer ici | Ce que vous pouvez faire |
| --- | --- |
| **[Studio web / éditeur de configuration](https://robin-g0.github.io/Motion-Input-Grid/studio/)** | Créer, importer et tester un profil, puis exporter le JSON. Sans installation. |
| **Motion Input Grid Controller (bureau)** | [Télécharger pour Windows x64 (ZIP)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-desktop-applications) · [Télécharger pour Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-desktop-applications) — Studio inclus pour éditer les profils. |

MIG débute son développement. Les applications Linux et les intégrations aux
moteurs de jeu nécessitent encore davantage de tests ; consultez les
[plateformes prises en charge](../reference/support.fr.md).

> [!WARNING]
> **Windows peut ne pas reconnaître ces premiers exécutables.** SmartScreen peut
> signaler une application peu connue. Téléchargez les versions de
> ce dépôt et vérifiez les sommes de contrôle fournies. Si vous faites confiance
> à ce téléchargement, **Informations complémentaires → Exécuter quand même**
> peut être proposé. Ne désactivez pas la protection de Windows.

## Utiliser MIG maintenant

1. Créez ou importez un profil dans le Studio web ci-dessus ou dans le
   [Studio de bureau](../guides/configurator.fr.md). Choisissez la partie du corps,
   dessinez les conditions et associez une action. Ajoutez les raccourcis dans
   l’éditeur JSON du Studio web ou dans le Studio de bureau.
2. Testez avec la caméra, puis exportez ou enregistrez le profil JSON. Le
   [guide du Studio web](../guides/studio-web.fr.md) explique l'édition et le retour visuel.
3. Téléchargez le Controller ci-dessus et extrayez **toute l'archive**. Arrêtez la
   caméra du Studio, ouvrez le Controller et importez votre JSON.
4. Démarrez le suivi et gardez les deux épaules visibles pour le calibrage.
   Vérifiez la reconnaissance avec **Keyboard output désactivé**, puis activez-le
   et donnez le focus à l'application cible. Consultez le
   [guide du Controller](../guides/controller.fr.md).

| **Dessiner une condition** | **Signification** |
| --- | --- |
| 🟩 Required | Traverser cette région ; les numéros définissent l'ordre. |
| 🟥 Forbidden | Éviter cette région. |
| 🟨 Trigger | Terminer le mouvement ici. |
| 🟪 Interaction | Faire un signe de main ici, éventuellement en le maintenant. |

Ces noms de conditions sont communs au web, au Studio de bureau et aux guides.
Le navigateur affiche les actions reconnues ; le Controller peut envoyer les
raccourcis. Conservez ensemble les fichiers des archives de bureau, qui incluent
les modèles et le runtime caméra. Windows nécessite le [runtime Visual C++ 2022
x64](https://aka.ms/vc14/vc_redist.x64.exe) ; Linux nécessite glibc 2.35+. La sortie clavier Linux utilise X11/XTest ;
elle n'est pas disponible sous Wayland natif.

## Utiliser les mouvements au quotidien

| Situation | Guide |
| --- | --- |
| Faire avancer une présentation PowerPoint | [Présentations](../guides/presentations.fr.md) |
| Contrôler un jeu avec ses raccourcis existants | [Jeux vidéo](../guides/video-games.fr.md) |
| Déclencher des raccourcis sur son ordinateur | [Usage quotidien](../guides/everyday-use.fr.md) |

> [!CAUTION]
> **Vérifiez les règles avant d'utiliser le Controller dans un jeu compétitif.**
> MIG génère des événements clavier du système : il ne modifie pas les jeux,
> n'injecte pas de code et ne lit pas la mémoire de leurs processus. Cela ne
> garantit pas son acceptation par un anti-cheat : un processus inconnu ou des
> entrées simulées peuvent être signalés. Respectez les règles du jeu et obtenez
> une autorisation si nécessaire. Évitez les sessions classées ou protégées si
> l'acceptation est incertaine ; MIG ne peut pas garantir l'absence de sanction.

## Intégrer MIG dans votre projet

Toutes les intégrations partagent le moteur C++20 et les profils JSON. Fournissez
vos positions corporelles ou utilisez un adaptateur caméra disponible.

Pour **Python**, installez depuis PyPI :

```sh
python -m pip install motion-input-grid
```

Importez `Tracker` depuis `mig`. Le wheel inclut le moteur pour les positions
fournies ; les visionneuses caméra utilisent un runtime natif distinct.

Pour **JavaScript / le navigateur**, installez depuis npm et copiez les ressources :

```sh
npm install motion-input-grid
npx mig-copy-assets public/mig
```

Le paquet npm inclut WASM, les modèles et les adaptateurs de frameworks. Servez
ces ressources depuis votre application et démarrez la caméra après une action utilisateur.

| Type de projet | Guide d'intégration |
| --- | --- |
| Python | [Installation, positions et retour d'actions](../../bindings/python/README.fr.md) |
| JavaScript / HTML | [npm, WASM et caméra](../../bindings/javascript/README.fr.md) |
| React / Vue / Next.js | [Intégration et exemples](../integrations/javascript.fr.md) |
| C++ / CMake / Make | [SDK et `MIG::core`](../getting-started/cpp.fr.md) |
| vcpkg / Debian | [Installation des paquets](../getting-started/packages.fr.md) |
| SDL2 / SFML | [Intégration native](../integrations/overview.fr.md) |
| .NET / C# | [Bridge managé](../../bindings/dotnet/README.fr.md) |
| Godot | [Extension et intégration C#](../../integrations/godot/README.fr.md) |
| Unity | [Intégration UPM](../../integrations/unity/README.fr.md) |
| Unreal | [Plugin natif](../../integrations/unreal/README.fr.md) |

Les intégrations aux moteurs de jeu sont en **Preview** et nécessitent un
fournisseur de positions ; elles n'incluent pas le suivi caméra des applications de bureau.

## Téléchargements avancés

Préférez pip ou npm ci-dessus pour Python et JavaScript. Les paquets navigateur
téléchargeables sont des **projets d'exemple locaux**, distincts de la présentation
et du Studio en ligne : extrayez-les et lancez leur serveur web local. Ce ne sont
pas des applications de bureau et ils n'envoient pas de raccourcis aux autres applications.

| Paquet | Point de départ |
| --- | --- |
| SDK C++, paquets Debian et intégrations aux moteurs | [Catalogue de la release](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-downloads) |
| Exemples natifs autonomes et tutoriels sources | [Catalogue des exemples](../../examples/README.fr.md) |
| Exemples HTML / React / Vue / Next.js téléchargeables | [Paquets navigateur](../integrations/javascript.fr.md#archive-compilée) |

Les archives navigateur individuelles nécessitent Node 22.12+ ; l'archive
JavaScript combinée inclut Node. Suivez le README fourni dans chaque paquet.

## Comprendre et contribuer

![Des positions au calibrage, à la reconnaissance puis aux actions](../assets/architecture/engine-flow.svg)

La [documentation](../index.fr.md) détaille le format, l'architecture, les API,
le dépannage et la compilation. Consultez le [journal des modifications](../development/CHANGELOG.fr.md)
ou le [guide de contribution](CONTRIBUTING.fr.md), et signalez les problèmes
dans les [issues GitHub](https://github.com/Robin-G0/Motion-Input-Grid/issues).

Licence [Apache-2.0](../../LICENSE). Les dépendances redistribuées conservent leurs notices.
