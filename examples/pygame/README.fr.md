# Pygame : caméra et actions logiques

[English](README.md) | [Français](README.fr.md)

**Télécharger cet exemple :** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-pygame-examples) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-pygame-examples).

## Ce que démontre cet exemple

Un aperçu miroir, les doigts et des objets suivant les poignets illustrent
**Left hand raised!** et **Right hand raised!**. Le second exécutable importe
votre JSON du Motion Input Grid Studio et affiche ses noms d'actions.

## Démarrage rapide — archive compilée

1. Extrayez l'archive `*-pygame-standalone`.
2. Dans ce dossier, lancez `main.exe` sous Windows ou `./main` sous Linux.
3. Gardez les deux épaules visibles pour la calibration. Baissez les mains
   dans le vert, puis montez un poignet vers le jaune. Observez le panneau.
4. Fermez la fenêtre pour libérer la caméra. `profile.exe / ./profile` permet d'importer un JSON.

Comptez 30–60 secondes avec les prérequis installés ; le chargement des modèles
dépend du matériel. Dans l'archive groupée, utilisez le dossier de l'exemple.

## Organisation du dossier

| Fichier ou dossier | Rôle |
| --- | --- |
| `main.py / profile.py` | Petit point d'entrée ; sélection du mode démo ou import. |
| `example_usage.py` | Initialisation MIG, reconnaissance et gestion des actions. |
| `application.py` | Fenêtre, événements, rendu et boucle de traitement. |
| `configuration/raised-hands.json` | Profil local schema-v2 des deux poignets. |
| `support/` | Recherche de ressources et affichage, avec leurs sources locales. |
| `requirements.txt` | Dépendances pour exécuter/modifier les sources. |
| `viewer.runtime/` | Python et dépendances de l'archive compilée, partagés entre les deux variantes. |
| `bindings/python/mig/` | Binding Python fourni dans l'archive individuelle. |

## Parcours du code

1. `example_usage.py` importe explicitement `mig` : installation, puis binding fourni.
   `parse_options()` sélectionne la configuration locale.
2. `InputSource._run()` appelle `load_configuration()` et `initialize_mig()` dans
   son worker. `mig.Tracker(library, json)` valide le profil et possède le moteur.
3. `start_tracking_camera()` appelle `start_camera(runtime, camera_index)`.
4. `process_tracking_frame()` appelle `poll_camera()`, puis `events()`. La caméra
   effectue déjà la reconnaissance ; les paquets synthétiques utilisent `update(packet)`.
5. `_publish()` copie image et actions dans une boîte bornée. L'interface appelle
   `handle_detected_actions()` pour afficher les tuples logiques.
6. `_import_pending()` traite les imports sur ce même worker, avec une limite de 1 Mio.
7. `InputSource.close()` signale l'arrêt et rejoint le worker. La sortie du contexte
   ferme MIG, même après une erreur, avant la destruction de la fenêtre.

## Dépendances et placement des ressources

Fourni : Python, Tk, Pillow, Pygame selon l'exemple, ABI MIG, MediaPipe, modèles
Lite/mains et licences. Gardez `viewer.runtime/` auprès des deux exécutables.
L'archive individuelle contient `runtime/` dans ce dossier ; l'archive groupée
le partage à sa racine. Le manifeste sert de repère, indépendamment du dossier courant.
L'exécutable compilé ne nécessite aucune installation de Python.

Externe : Windows x64 et runtime VC++, ou Linux x64 avec glibc 2.35+ et affichage
graphique. Webcam pour le suivi réel. Facultatif : Python 3.10+ et SDK MIG avec caméra.

## Exécuter les sources hors du dépôt

Copiez ce dossier, puis installez le binding et les dépendances locales :

```sh
python -m pip install motion-input-grid -r requirements.txt
# Linux : python3-tk et python3-pil.imagetk si nécessaire.
# MIG_LIBRARY : mig-c.dll / libmig-c.so.1 du SDK avec caméra.
# MIG_RUNTIME : dossier contenant libmediapipe et models/.
python main.py
python profile.py
```

Le wheel seul reconnaît des positions ; le SDK avec caméra est nécessaire ici.
`python main.py --smoke` utilise des observations déterministes puis quitte ; ce
n'est pas une mesure de précision caméra. Pygame utilise Tk pour son sélecteur
de fichier et accepte aussi le glisser-déposer JSON.

## Configuration et réutilisation

Le profil contient, pour chaque poignet, une zone Required `[-9,3,27,3]`, puis
une zone Trigger `[-9,1,27,2]`. Une pose isolée dans le jaune ne déclenche rien.
Le mode import démarre sans règles. Un JSON invalide préserve le profil précédent ;
un import valide recommence la calibration.

Reprenez le fichier d'intégration indiqué et le profil. Remplacez le callback
d'action par une commande du jeu. Fournissez des observations MediaPipe non
miroir, leur aspect original, une séquence croissante et un temps monotone.
Traitez chaque nouvelle image une fois ; fournissez des observations absentes
si le suivi est perdu. L'aperçu, les objets et le panneau sont uniquement visuels.
Gardez un propriétaire par tracker et son nettoyage. Aucune touche système n'est injectée.

## Dépannage

- Bibliothèque ou modèle absent : conservez tout le dossier extrait. Les sources
  seules nécessitent l'installation ci-dessous et ne contiennent pas les exécutables.
- Caméra occupée : fermez les autres applications et autorisez son accès.
- Aucune action : attendez la calibration des deux épaules, baissez les poignets,
  puis passez du vert au jaune. Un intervalle supérieur à 180 ms nécessite un profilage.
- Import refusé : corrigez l'erreur de schéma ; les règles précédentes restent actives.
- La fermeture attend la fin de l'inférence en cours avant de libérer MIG.
