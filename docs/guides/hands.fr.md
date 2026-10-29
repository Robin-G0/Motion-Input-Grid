# Tracking natif facultatif des mains et doigts

[English](hands.md) | [Français](hands.fr.md)

## Pour un premier essai

> [!TIP]
> **Un mouvement de poignet simple suffit pour commencer.** Le suivi des doigts
> est facultatif. Découvrez d'abord le [guide présentation](presentations.fr.md)
> ou le [Studio web](studio-web.fr.md).

| Vous voulez… | À faire |
| --- | --- |
| Reconnaître un trajet du poignet | Dessinez **Required** puis **Trigger** ; gardez les épaules visibles. |
| Ajouter une condition de doigts ou de signe | Utilisez une version avec suivi des mains et les réglages de doigts / région violette **Interaction**. |
| Masquer les mains à l'écran | Modifiez l'affichage : cela ne désactive pas le suivi demandé par le profil. |

> [!WARNING]
> **Les doigts cachés restent incertains**, même si le modèle renvoie des points.
> Essayez avec la sortie clavier désactivée et vérifiez aussi le relâchement du signe.
> Les tests automatiques ne mesurent pas la précision sur votre main.

## Pour les développeurs

Les apps Windows/Linux utilisent HandLandmarker natif dans le même processus.
Les angles des articulations alimentent doigts/scopes et commandes/signes :
[schéma 2](../reference/configuration.fr.md), [UI Windows](../getting-started/windows.fr.md).

### Compiler et lancer

Relancez une fois le bootstrap pour obtenir le modèle et les en-têtes. Les compilations suivantes peuvent utiliser `-SkipBootstrap` :

```powershell
powershell -ExecutionPolicy Bypass -File tools/build/build-windows.ps1
.\build\windows\bin\motion-input-grid-studio.exe --hands
.\build\windows\bin\motion-input-grid-controller.exe --config profile.json
```

### Activer le suivi

**Arrêtez la première caméra** avant d’ouvrir la seconde application.
**Hands ON/OFF** et `tracking.hands` sont enregistrés dans le profil ; le chargement
et l'annulation restaurent ce réglage. `--hands` l'active au démarrage du Studio.
Le Controller accepte ce drapeau uniquement pour les diagnostics.

Appliquer une règle de doigts ou de signe active les mains dans une version qui
les prend en charge. Sans demande explicite, **seul le corps est suivi** : le modèle
des mains n'est ni chargé ni exécuté.

Le suivi des mains ne nécessite pas de calibrage des épaules ; le parcours du corps
en a besoin. Les os des mains apparaissent en jaune. **View** contrôle l'affichage
indépendamment du suivi.

L'association anatomique utilise les poignets et les épaules et rejette les cas
ambigus. L'extension vérifie MCP/IP pour le pouce et PIP/DIP pour les autres doigts.

<details>
<summary>Avancé : commandes, seuils et options de compilation</summary>

### Commandes globales et seuils

**Right V → Recalibrate** est proposé au démarrage ; activez **Hands**. Réaffecter V à Record
supprime le défaut. Validation 250 ms, gap/âge commandes 500 ms, verrou/recovery 1000 ms.
V accepte index/majeur>=0.7, ring/pinky<=0.4, pouce<=0.55 ; doigts d'input inchangés.
Record exige l'éditeur ouvert et son choix de landmarks/espace. OFF retire code,
liens et modèle Hands ; demande explicite rapporte erreur.

</details>

## Données

`mig/hands/frame.hpp`, exporté par `MIG::hands`, fournit des observations portables
de capacité fixe, sans en-têtes MediaPipe ni pixels.

> [!IMPORTANT]
> `Pose::hand_frame()` renvoie une référence empruntée. **Copiez-la avant la prochaine
> inférence ou avant de la transmettre à un autre thread.**

`Pose(directory)` suit uniquement le corps par défaut. Appelez explicitement
`set_hands_enabled(true)` pour activer les mains et `false` pour libérer la tâche.
Ces appels et l'inférence appartiennent au **même thread propriétaire**. Cet adaptateur
est synchrone ; ce n'est pas une session SDK complète avec son propre thread.
Le runtime natif peut être compilé sans les applications.

| Donnée | Contrat |
| --- | --- |
| Mains et points | Au plus **deux mains**, chacune avec **21 points** dans l'ordre MediaPipe ; extrémités : `4/8/12/16/20`. |
| Coordonnées | XY normalisés, non reflétés ; Z relatif au poignet, sans distance en mètres. |
| Métadonnées | Temps, séquence et rapport d'image identiques à ceux du corps. |
| Validité | Seul `[0,count)` est valide. Réinitialisation à chaque inférence, sans réutiliser les points absents. |
| Rejet | Comptes invalides, valeurs non finies, amplitude supérieure à 16 et scores hors `[0,1]`. |
| Identité | `model_side` est le label brut ; le score de latéralité n'est pas une confiance par point. L'ordre du tableau n'est pas une identité persistante. |

## Exécution et signes

### Coût et limites

Pose et mains traitent la même image RGB et le même horodatage, séquentiellement sur le worker borné.
Hands ajoute du coût ; précision/latence matérielles à vérifier. RAII libère
résultats/images/modèles/DLL. Pas d'upload ajouté, mais télémétrie upstream observée.
[Performances](../architecture/performance.fr.md).

### Signes reconnus

**Thumb**, **V**, **OK**, **Open palm** et **Fist** partagent le même cœur. OK exige contact 3D pouce/index<=25%
largeur paume, autres trois étendus. Frame.hand_contacts est publié avec doigts
par association anatomique ; hôtes doivent fournir cette preuve pour OK.
Contact inconnu ne compte ni OK ni relâchement volontaire. Open palm/Fist demandent
cinq doigts connus étendus/fermés. Advanced édite signe/hold et stabilité/grâce.

### Vérifier

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
