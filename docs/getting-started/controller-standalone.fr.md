# Controller autonome

[English](controller-standalone.md) | [Français](controller-standalone.fr.md)

Les packages Controller seuls sont un `.exe` Windows x64 et un `.run` Linux x64.
Ils incluent moteur, modèles, dépendances et licences, sans Studio de bureau,
SDK ou exemples. Consultez le catalogue officiel pour les téléchargements disponibles.

> [!TIP]
> **Vous venez du Studio web ?** Le [guide du Controller](../guides/controller.fr.md)
> montre l'import et le premier essai. **Pas de Python ni de compilateur à installer.**

## Utiliser un fichier publié

Téléchargez la [version officielle](https://github.com/Robin-G0/Motion-Input-Grid/releases/latest).
Lancez le `.exe`. Sous Linux, autorisez l’exécution dans les propriétés ou lancez
`sh nom-du-fichier.run`. Importez le JSON du Studio web, vérifiez les touches,
démarrez le suivi clavier désactivé, puis activez-le et donnez le focus à votre
application. Voir le [guide du Controller](../guides/controller.fr.md).

> [!IMPORTANT]
> **Importez → démarrez clavier désactivé → vérifiez le mouvement → activez la
> sortie → cliquez dans l'application cible.** Fermez la caméra du Studio d'abord.

Windows extrait les fichiers une fois dans
`%LOCALAPPDATA%\MotionInputGrid\runtime\<sha256-du-payload>\`. Chaque lancement
vérifie tous les fichiers et le marqueur de fin avant réutilisation, sans passer
normalement par `%TEMP%`. Linux garde son extraction temporaire par lancement
et son nettoyage à la fermeture normale. Un arrêt forcé peut laisser des fichiers.
Ni installation, ni droits administrateur, ni Python ou compilateur requis.
Le lanceur ne télécharge pas les dépendances. Les licences restent incluses.

<details>
<summary>Détails techniques : validation du cache Windows</summary>

Windows prépare un dossier voisin, écrit et vérifie les fichiers, puis le publie
par renommage sur le même volume. Un verrou par payload empêche deux premiers
lancements de publier une extraction partielle. Un dossier de préparation
interrompu n’est jamais accepté comme cache complet. Les caches invalides sont
mis à l’écart puis reconstruits. Les anciennes versions et dossiers `.invalid-*`
ou `.staging-*` ne sont pas supprimés automatiquement. Fermez les Controller
avant de retirer manuellement les dossiers obsolètes.

Le marqueur seul ne suffit pas : tailles et SHA-256 de tous les fichiers sont
intégrés à l’EXE, y compris manifeste et licences. Les entrées imprévues, points
de réanalyse et liens physiques sont refusés. Les fichiers vérifiés restent
verrouillés contre l’écriture et la suppression pendant l’exécution. Cela
protège le cache, sans constituer une frontière contre un attaquant contrôlant
déjà le même compte Windows ou capable de remplacer l’EXE téléchargé.

</details>

Windows inclut les DLL du runtime Visual C++ ; le lanceur utilise un CRT statique.
Les fonctions caméra et affichage du système restent nécessaires. Linux inclut
les plugins Qt, polices et bibliothèques non système et nécessite glibc 2.35+,
l’accès caméra et une session graphique. Le clavier demande X11/XTest, pas Wayland.
Le dossier temporaire doit autoriser l’exécution ; `TMPDIR` peut désigner un autre
dossier utilisateur si nécessaire.

SmartScreen peut signaler un fichier non signé. Vérifiez la source officielle.
Si vous choisissez de lui faire confiance, **Informations complémentaires**, puis
**Exécuter quand même** peuvent être proposés. Ne désactivez pas la protection
Windows. La signature et la réputation sont indépendantes du packaging.

## Construire et vérifier

`tools/packaging/package-windows-release.ps1` produit aussi le fichier autonome
avec le CRT redistribuable installé dans Visual Studio. Pour un dossier préparé :

```powershell
python tools/packaging/package-controller.py --platform windows --source distribution/windows --redist "C:/path/to/Microsoft.VC143.CRT"
```

`tools/packaging/package-linux.py --native` produit aussi le fichier Linux.
Pour un bundle natif extrait avec ses dépendances :

```sh
python3 tools/packaging/package-controller.py --platform linux --source /path/to/extracted-native-bundle
python3 tests/packaging/controller_package_tests.py
python3 tests/packaging/controller_runtime_tests.py build/releases/motion-input-grid-1.1.0-controller-linux-x64.run
```

Les fichiers sont versionnés avec un SHA-256. Les workflows des candidats vérifient
le bundle et les diagnostics intégrés à travers le fichier final ; la compilation
native doit utiliser `MIG_BUILD_TESTS=ON`. Testez une vraie caméra et la sortie
clavier sur le système cible avant publication : les tests sans écran ne les
remplacent pas.

Le test Windows vérifie aussi création, réutilisation sans réécriture, corruption
avec manifeste falsifié, cache incomplet, DLL supplémentaire, marqueur incorrect,
jonction injectée et premiers lancements concurrents. Son PATH contient seulement
Windows. Il observe les DLL chargées et refuse celles hors cache validé ou Windows.
Voir l’[inventaire des dépendances Windows](../reference/windows-runtime-dependencies.fr.md).
