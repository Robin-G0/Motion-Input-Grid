# Package Python Motion Input Grid (MIG)

[English](https://github.com/Robin-G0/Motion-Input-Grid/blob/main/bindings/python/README.md) | [Français](https://github.com/Robin-G0/Motion-Input-Grid/blob/main/bindings/python/README.fr.md)

## Installer depuis PyPI

```sh
python -m pip install motion-input-grid
python -c "from mig import Tracker; print('MIG OK')"
```

Le nom de distribution est `motion-input-grid` ; l'import reste `mig`.
Utilisez de préférence un environnement virtuel Python 3.10+. Les wheels
couvrent Windows x64 et Linux x64/ARM64 avec glibc 2.35+. Sur une autre
plateforme, pip peut compiler le sdist et nécessite un compilateur C++20
et CMake 3.25+. Pour installer une version précise :
`python -m pip install motion-input-grid==1.0.2`.

Alternative locale : `python -m pip install /chemin/motion_input_grid-1.0.2-<tags>.whl`.
Pour compiler depuis le dépôt complet : `python -m pip install ./bindings/python`.

## Envoyer des observations

Enregistrez un profil depuis le Motion Input Grid Studio sous `profile.json`. Passez `None`
pour utiliser le moteur fourni ou un chemin explicite vers un SDK externe.
Cet exemple envoie **une frame** ; votre application doit alimenter le tracker
à chaque nouvelle observation. Une seule frame ne suffit pas pour calibrer et
reconnaître un mouvement complet.

Les wheels fournissent l'ABI C de positions et ses licences : `mig-c.dll` sous
Windows et `libmig-c.so.1` sous Linux. Aucun modèle ni estimateur caméra n'est
inclus. Le sdist contient le moteur C++ et les en-têtes JSON ; sa compilation
demande CMake 3.25+ et un compilateur C++20. Les builds Linux utilisent GCC et
ses notices de runtime.

```python
from pathlib import Path
from mig import Packet, Tracker

profile = Path("profile.json").read_text(encoding="utf-8")
with Tracker(None, profile) as tracker:
    frame = Packet(timestamp_ms=20, sequence=1, aspect=16 / 9)
    frame.set_body(11, 0.65, 0.45)
    frame.set_body(12, 0.35, 0.45)
    frame.set_body(15, 0.4, 0.6)
    for action, input_id in tracker.update(frame):
        print(action, input_id)
```

## Cycle de vie et caméra

Utilisez des timestamps croissants en millisecondes et des numéros de séquence
croissants. Le calibrage demande environ une seconde avec les deux épaules visibles.
Les indices MediaPipe sont anatomiques et non reflétés ; un point absent a une
confiance nulle. Un seul thread possède chaque tracker. Fermez-le explicitement
ou utilisez un context manager.

`start_camera(runtime_directory)` et `poll_camera()` utilisent éventuellement
un SDK natif avec son runtime MediaPipe et ses modèles. `poll_camera()` effectue
déjà la reconnaissance : lisez ensuite `events()` sans soumettre la frame à nouveau.
Les viewers demandent l'extension `mig_camera_image` ; `Tracker.camera_image()`
copie les pixels. Les callbacks sont des événements logiques ; l'application
choisit comment les utiliser ou envoyer des touches.

[Exemples caméra](https://github.com/Robin-G0/Motion-Input-Grid/tree/main/examples) ·
[Contrat ABI](https://github.com/Robin-G0/Motion-Input-Grid/blob/main/docs/reference/c-abi.fr.md) ·
[Parcours du code](https://github.com/Robin-G0/Motion-Input-Grid/blob/main/docs/getting-started/examples.fr.md) ·
[Démarrage](https://github.com/Robin-G0/Motion-Input-Grid/blob/main/docs/getting-started/bootstrap.fr.md).
