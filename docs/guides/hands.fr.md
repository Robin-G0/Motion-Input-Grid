# Tracking natif facultatif des mains et doigts

[English](hands.md) | [Français](hands.fr.md)

Les apps Windows/Linux utilisent HandLandmarker natif dans le même processus.
Les angles des articulations alimentent doigts/scopes et commandes/signes :
[schéma 2](../reference/configuration.fr.md), [UI Windows](../getting-started/windows.fr.md).
Rebootstrap une fois pour modèle/headers, puis -SkipBootstrap :

```powershell
powershell -ExecutionPolicy Bypass -File tools/build/build-windows.ps1
.\build\windows\bin\motion-input-grid-studio.exe --hands
.\build\windows\bin\motion-input-grid-controller.exe --config profile.json
```

Arrêtez la première caméra. Hands ON/OFF et tracking.hands sont persistés,
chargement/undo restaurent. --hands initialise Motion Input Grid Studio ; Motion Input Grid Controller
ne l'accepte que pour diagnostics. Apply de règle/signe active Hands en ON,
absence de demande=corps seul, aucune tâche main créée/inférée.
Hands n'a pas besoin de calibrage épaules, le chemin body oui. Os jaunes, statut
anatomique, View indépendant. Association utilise poignets/épaules et rejette
ambiguïté. Extension vérifie MCP/IP pouce et PIP/DIP autres, pas IP seul.
Right V Recalibrate proposé au démarrage ; activez Hands. Réaffecter V à Record
supprime le défaut. Validation 250 ms, gap/âge commandes 500 ms, verrou/recovery 1000 ms.
V accepte index/majeur>=0.7, ring/pinky<=0.4, pouce<=0.55 ; doigts d'input inchangés.
Record exige l'éditeur ouvert et son choix de landmarks/espace. OFF retire code,
liens et modèle Hands ; demande explicite rapporte erreur.

## Données

mig/hands/frame.hpp/MIG::hands : observations fixes portables sans MediaPipe/pixels.
Pose::hand_frame est emprunté jusqu'à prochaine inférence, changement ou destruction ;
copiez avant autre thread. Pose(directory) est body-only, set_hands_enabled(true)
explicite et false libère, appels sur même propriétaire. Adaptateur synchrone,
pas session SDK threadée ; native ON peut se compiler sans apps.
Au plus deux mains,21 points ordre MediaPipe, tips4/8/12/16/20. XY normalisés non
reflétés, Z relatif au poignet sans mètres/distancecaméra. Temps/séquence/aspect
identiques au corps. Seul[0,count)valide, reset à chaque inférence, pas de vieux
points réutilisés. Compte/valeurs non finies, amplitude>16, scores hors[0,1] rejetés.
model_side est label brut, score handedness pas confiance par point. Ordre tableau
pas identité ni ID persistant. Occlusion reste une incertitude même avec coordonnées.

## Exécution et signes

Pose/Hands utilisent le même RGB/temps séquentiellement sur le worker borné.
Hands ajoute du coût ; précision/latence matérielles à vérifier. RAII libère
résultats/images/modèles/DLL. Pas d'upload ajouté, mais télémétrie upstream observée.
[Performances](../architecture/performance.fr.md).
Thumb/V/OK/Open palm/Fist partagent le core. OK exige contact 3D pouce/index<=25%
largeur paume, autres trois étendus. Frame.hand_contacts est publié avec doigts
par association anatomique ; hôtes doivent fournir cette preuve pour OK.
Contact inconnu ne compte ni OK ni relâchement volontaire. Open palm/Fist demandent
cinq doigts connus étendus/fermés. Advanced édite signe/hold et stabilité/grâce.

```powershell
ctest --test-dir build/windows -C Release --output-on-failure
.\build\windows\bin\motion-input-grid-controller.exe --hands-test
.\build\windows\bin\motion-input-grid-controller.exe --camera-test --hands
.\build\windows\bin\motion-input-grid-controller.exe --session-test --hands
```

Smoke ouvre/ferme trois fois, neuf images vides, résultats/metadata vérifiés.
Tests portables indices/invalides ; caméra opt-in sans touches. Les anciens nombres
9/7 tests et cycles webcam de la page anglaise sont historiques.
Les cinq géométries sont testées synthétiquement des deux côtés ; précision humaine
non prouvée. [Préparation](../reference/support.fr.md).
Modèle v1 SHA256 fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1.
[API officielle](https://github.com/google-ai-edge/mediapipe/blob/v0.10.35/mediapipe/tasks/c/vision/hand_landmarker/hand_landmarker.h),
[coordonnées](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker).
