# Motion Input Grid Controller

Motion Input Grid Controller exécute les profils de Motion Input Grid Studio ou [Motion Input Grid Studio Web](studio-web.fr.md).
Son exécutable reste `motion-input-grid-controller` pour préserver les scripts existants.
**Manage profile** regroupe import, export et renommage ; les commandes de session
et le retour des mouvements restent visibles pendant l’utilisation.

[English](controller.md) | [Français](controller.fr.md)

<details>
<summary>Dans cette page</summary>

- [Où trouver et lancer l'application](#où-trouver-et-lancer-lapplication)
- [Premier lancement](#premier-lancement)
- [Profils](#profils)
- [Affichage](#affichage)
- [Vérifier une action](#vérifier-une-action)
- [Si le mouvement ne fonctionne pas](#si-le-mouvement-ne-fonctionne-pas)
- [Compilation et problèmes courants](#compilation-et-problèmes-courants)

</details>

Le Motion Input Grid Controller exécute les profils créés dans Motion Input Grid Studio pendant que vous
utilisez une autre application ou jouez. Il permet de sélectionner un profil,
de voir les actions reconnues et de vérifier les mouvements avec la caméra.
Utilisez le [Motion Input Grid Studio](configurator.fr.md) pour dessiner ou modifier les mouvements.

## Où trouver et lancer l'application

> [!NOTE]
> Sur Debian, Motion Input Grid Studio, Motion Input Grid Controller et certains exemples natifs sont
> encore en cours de développement et de test. Ils peuvent ne pas fonctionner
> entièrement pour le moment.

Dans les [Releases](https://github.com/Robin-G0/Motion-Input-Grid/releases), choisissez une
archive native correspondant à votre système, lorsqu'elle est disponible :

| Système | Archive | Fichier après extraction |
| --- | --- | --- |
| Windows x64 | `motion-input-grid-<version>-windows-x64-native.zip` | `windows/motion-input-grid-controller.exe` |
| Linux x64 | `motion-input-grid-<version>-linux-x64-native.tar.gz` | `./motion-input-grid-controller` |

Ces chemins partent du dossier principal de l'archive extraite. Sous Windows,
ouvrez l'exécutable. Sous Linux, ouvrez un terminal dans ce dossier et lancez
`./motion-input-grid-controller` ; ce lanceur configure les bibliothèques fournies avant d'ouvrir
le binaire dans `bin/`. Conservez les DLL, modèles, configurations et autres
ressources de l'archive ensemble. Windows nécessite le runtime Visual C++ 2022
x64 ; les archives Linux nécessitent glibc 2.35+.

## Premier lancement

1. Fermez la caméra du Motion Input Grid Studio, puis ouvrez `motion-input-grid-controller`.
2. Ouvrez **Manage profile**, puis **Import profile** (Windows) ou **Import…** (Linux),
   et choisissez un JSON enregistré par Motion Input Grid Studio ou Motion Input Grid Studio Web.
3. Donnez un nom reconnaissable au profil. Sous Windows, modifiez le champ du nom
   puis cliquez sur **Save name**. Sous Linux, cliquez sur **Rename profile**.
4. Cliquez sur **Start**, faites face à la caméra et gardez les épaules visibles
   pendant le calibrage.
5. Essayez un mouvement : son action devient verte pendant 900 ms. Les actions
   Hold et Repeat restent éclairées tant que leurs conditions finales sont remplies.
6. Activez **Keyboard output**, puis donnez le focus à votre jeu ou application.

La sortie clavier est désactivée à chaque lancement. Les actions s'éclairent
même sans sortie clavier. Windows utilise SendInput ; Linux nécessite X11/XTest
et des touches disponibles dans l'agencement du clavier. La sortie sous Wayland
natif n'est pas disponible. Stop, la perte du suivi, les observations trop anciennes
et la fermeture relâchent les touches maintenues.

## Profils

La liste des profils permet de passer d'un profil importé à un autre, même pendant
le suivi. Le changement relâche les touches et efface la reconnaissance du profil
précédent. Windows conserve la capture ; Linux redémarre son worker propriétaire
de la caméra. Le nouveau profil se calibre avant de produire des actions.
Le dernier profil sélectionné et son nom sont restaurés au prochain lancement.
La caméra et la sortie clavier doivent toujours être activées explicitement.

Les fichiers importés sont copiés dans le dossier de données de l'application.
Déplacer le fichier d'origine ne casse pas le profil importé. **Export file**
enregistre le profil sélectionné dans un JSON utilisable avec Motion Input Grid Studio
ou les bibliothèques. Pour utiliser une configuration modifiée, importez à nouveau
son fichier comme nouveau profil. Un import invalide conserve le profil en cours.
Vous pouvez conserver jusqu'à 64 profils.

Les données sont enregistrées ici :

- Windows : `%LOCALAPPDATA%\MIG\controller`.
- Linux : `$XDG_DATA_HOME/mig/controller`, ou
  `~/.local/share/mig/controller` si `XDG_DATA_HOME` n'est pas défini.

`profiles.json` contient les noms et la dernière sélection ; les fichiers JSON
numérotés contiennent les configurations habituelles du schéma v2. Sauvegardez
le dossier entier pour conserver vos profils. Cette liste est distincte du
[format de configuration](../reference/configuration.fr.md).

## Affichage

Par défaut, seules les actions sont affichées. Leur retour visuel reste disponible
sans effectuer la conversion et le rendu de l'aperçu caméra.

Dans **View**, activez **Camera preview** pour afficher les actions et la caméra
en miroir. **Grid**, **Hand detections** et **Body dots** règlent les calques
indépendamment. Masquer les mains ne désactive pas la reconnaissance nécessaire
au profil. **Dark mode** permet de choisir le thème clair ou sombre.
Les barres de défilement des listes, menus déroulants et journaux suivent le thème
choisi sous Windows et Linux, dans Motion Input Grid Controller comme dans Motion Input Grid Studio.

**Compact background window** réduit Motion Input Grid Controller à une petite fenêtre avec
un bouton **Open**. Le suivi et la sortie clavier activée continuent. **Open**
restaure la fenêtre précédente. La réduction dans la barre des tâches laisse
également le suivi actif. Les copies/conversions d'aperçu et le rendu sont ignorés
lorsque l'aperçu est masqué. Le modèle de pose continue de traiter les images :
masquer l'interface ne dégrade pas la reconnaissance et ne désactive pas les mains.

## Vérifier une action

Activez **View → Verify bindings**, puis sélectionnez une action dans la liste.
Ses régions apparaissent sur la caméra : Required en vert, Forbidden en rouge,
Trigger en jaune et Interaction en violet. Les contours blancs indiquent une
région validée, déclenchée ou un signe en cours de maintien. Les conditions de
doigts/signes invalides et les repères manquants sont signalés en rouge.
Les numéros d'ordre figurent dans les régions ; le miroir suit la variante reconnue.

La vérification suspend toute sortie clavier tout en conservant le retour de
reconnaissance. Désactivez-la avant de jouer. Vous pouvez recalibrer sans modifier
le profil. La vérification ne modifie pas les régions et n'isole pas la reconnaissance
à une seule action : toutes les actions continuent de signaler leurs déclenchements.

## Si le mouvement ne fonctionne pas

| Ce que vous observez | Que vérifier |
| --- | --- |
| Le calibrage ne finit pas | Gardez les deux épaules visibles et relancez le calibrage. |
| L'action ne s'allume pas | Activez **Camera preview** et **Verify bindings** pour voir les régions et les conditions manquantes. |
| L'action s'allume mais aucune touche n'est envoyée | Vérifiez le binding clavier, activez **Keyboard output**, désactivez la vérification et donnez le focus à l'application cible. |
| L'action ne se déclenche pas une deuxième fois | Sortez de la région finale, puis refaites le parcours ; vérifiez aussi le cooldown du profil. |
| Un signe de main manque | Vérifiez la prise en charge des mains et leur visibilité ; consultez le [guide des mains](hands.fr.md). |

> [!NOTE]
> **Verify bindings** suspend toute sortie clavier. Les exemples et les libraries
> transmettent des événements logiques ; Motion Input Grid Controller envoie des touches lorsque
> vous activez cette option.

## Compilation et problèmes courants

Après compilation depuis les sources :

| Méthode | Fichier depuis la racine du dépôt |
| --- | --- |
| Preset Windows `release` | `build/release/bin/motion-input-grid-controller.exe` |
| Script `tools/build/build-windows.ps1` par défaut | `build/windows/bin/motion-input-grid-controller.exe` |
| Compilation du guide Linux | `build/linux-apps/bin/motion-input-grid-controller` |

Suivez les guides [Windows](../getting-started/windows.fr.md) ou
[Linux](../getting-started/linux.fr.md) pour compiler. Le guide Linux indique
également le paramètre `--runtime` pour les modèles et la bibliothèque MediaPipe.
Les presets `sdk-*` et les packages de bibliothèques ne construisent pas ces applications.

Consultez les guides [Windows](../getting-started/windows.fr.md) et [Linux](../getting-started/linux.fr.md)
pour les dépendances et commandes de compilation. Gardez les bibliothèques natives
et les modèles à côté de l'exécutable distribué. Un profil qui suit les mains
nécessite une version compilée avec leur prise en charge.
Si un profil enregistré manque ou est invalide, Motion Input Grid Controller signale le problème.
Importez un fichier valide ou choisissez un autre profil enregistré.

Le Motion Input Grid Controller utilise le même moteur de reconnaissance et ordonnanceur clavier
que Motion Input Grid Studio. Les tests automatisés couvrent la persistance des profils,
les vues, la vérification et l'annulation des sorties. La précision de la caméra
et l'envoi des touches à un jeu donné se vérifient sur votre machine.
