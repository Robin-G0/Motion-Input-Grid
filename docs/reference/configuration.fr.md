# Format de configuration MIG, schéma 2

[English](configuration.md) | [Français](configuration.fr.md)

> [!TIP]
> **Besoin d’un profil prêt à importer ?** Utilisez l’[exemple HI complet](#exemple-complet-hi-du-studio).
> Consultez ensuite les sections correspondant aux champs à modifier ; cette page est une référence.

## Revue d'import

L'import desktop valide le profil et affiche tous ses mouvements et actions dans
une revue défilante. Les touches d'un accord sont simultanées ; les actions numérotées
sont successives ; le texte est cité avec ses caractères de contrôle échappés.
Hold exécute le préfixe une fois puis maintient l'accord final ; Repeat affiche son
intervalle. Accepter importe le profil avec sortie clavier désactivée ; activez-la
séparément. Annuler conserve le profil précédent.

**System interaction** couvre Windows/Super, les principaux raccourcis de fenêtres
et de session, Sleep et les touches de lancement. L'effet dépend du système et de
l'application active : ce label n'est pas une garantie de sécurité. X11 et l'OS
peuvent ne pas émettre certaines touches pourtant valides dans le format.

Limites centralisées dans `mig/core/input.hpp` : 256 actions, 1 024 touches sérialisées
et 16 384 octets UTF-8 de texte par input. Les exemples utilisent au plus une action.
Touches dupliquées, réservées, indéfinies, souris/gamepad et Unicode-packet sont rejetées,
ainsi que l'UTF-8 invalide, sans troncature. Le SDK valide le même format ; la revue
est une responsabilité de l'interface desktop. MIG n'exécute pas directement de shell.

<details>
<summary>Dans cette page</summary>

- [Racine et inputs](#racine-et-inputs)
- [Clavier et modes](#clavier-et-modes)
- [Grille et contraintes](#grille-et-contraintes)
- [Doigts et commandes globales](#doigts-et-commandes-globales)
- [Interaction violette](#interaction-violette)
- [Enregistrement et validation](#enregistrement-et-validation)
- [Présentation et layers](#présentation-et-layers)
- [Exemples JSON de la référence](#exemples-json-de-la-référence)
- [Liste des profils du Motion Input Grid Controller](#liste-des-profils-du-motion-input-grid-controller)

</details>

Les exemples utilisent [raised-hands.json](../../examples/common/raised-hands.json) :
deux inputs de poignet en espace body, quatre bandes horizontales Required vertes
puis Trigger jaune. Les ordres exigent un chemin, pas un test de hauteur écrit
dans le langage hôte. Hands sert à dessiner les doigts ; aucun signe n'est exigé
pour lever le poignet. Les exemples n'associent aucune touche.

### Parseur et remplacement du document

**Seul `schema_version: 2` est accepté.** Anciennes versions, legacy_path et champs
inconnus sont rejetés avant de remplacer le document. load_configuration(path)
et parse_configuration(texte) ont la même validation stricte : 1 Mio, profondeur
32. serialize_configuration exporte sans fichier ; save_configuration remplace
atomiquement. Sous Windows, les conflits temporaires de partage/verrouillage sont
retentés pendant 500 ms au maximum. Un échec persistant conserve le profil sauvegardé
et indique l’erreur système. Native, WebAssembly, Python, C# et Qt partagent parseur/moteur sans
schéma spécifique. Un import ABI C réussi arrête capture ; un invalide la conserve.
Consentements, fenêtres et paquets runtime ne sont pas sérialisés.

## Racine et inputs

| Champ | Contrat |
| --- | --- |
| schema_version | 2 exclusivement |
| inputs | Obligatoire, 0..64 inputs |
| tracking | Facultatif, {"hands":false} par défaut |
| controls | Facultatif, commandes globales décrites plus bas |

Les deux apps restaurent Hands au chargement. Appliquer doigts/commandes
l'active dans ON. Une règle de doigt exige des observations, jamais contournée
par leur absence.

### Champs d’un input

Chaque input exige un `id` stable, un `name` affiché et une `action` logique, au plus **80 octets UTF-8**
chacun. Les identifiants des inputs, étapes et contraintes, les noms, actions et
références de tolérance ne peuvent pas contenir NUL (`\u0000`) : les interfaces
natives utilisent des chaînes terminées par NUL. Champs facultatifs :

| Champ | Valeurs / défaut |
| --- | --- |
| keyboard | Tableau chronologique, vide/absent = événement logique seulement |
| mirror | false |
| space | calibrated par défaut, ou body |
| max_duration_ms | 0..10000, 0 = aucune limite |
| cooldown_ms | 0..10000, 0 = aucun cooldown |
| constraints, fingers | Gardes/prérequis et doigts de tout le mouvement |
| steps | Étapes décrites ci-dessous |
| recordings | Traces revues, métadonnées d'édition |
| action_mode | single_press par défaut, hold ou repeat |
| repeat_interval_ms | 20..60000, défaut 200 |

Cooldown démarre au déclenchement et bloque normal/miroir jusqu'à échéance.
Il ne remplace pas le verrou de relâchement/réarmement. Repeat concerne les
sorties de l'activation actuelle, pas de nouveaux événements. Restart efface
l'échéance. Une durée positive commence avec la tentative ; les nouveaux inputs
n'ont pas de limite. La récupération des commandes globales reste fixe 1000 ms.

## Clavier et modes

`keyboard` contient jusqu'à 256 objets, chacun exactement text UTF-8 ou keys.
Un accord keys contient 1..255 codes virtuels Windows uniques dans 1..255.
Une touche peut répéter dans les objets successifs, jamais dans un même accord.
Le texte total est limité à 16384 octets UTF-8 ; NUL et UTF-8 invalide sont rejetés.
Le texte vide ne fait rien. L'ancienne limite huit touches a disparu, les anciens
champs key/keys au niveau input sont rejetés, sans lecteur rétrocompatible.

L'éditeur accepte :

- `"Hello world" _ Enter` : texte puis entrée.
- `Ctrl + C` : accord simultané.
- `A _ A _ "done" _ Ctrl + S` : actions successives avec répétitions.
- `None` : événement logique seul.

_ sépare les actions, + lie les touches ; dans les guillemets ce sont des
caractères littéraux. Échappements : \" \\ \n \r \t.
Noms : Alt+F4, Space, Left, F1..F24, VK:65 ; Plus désigne la touche plus.
Keys/Ctrl+K et Edit keys montrent les éléments reconnus dans des boîtes et
défilent les longues séquences. Une expression invalide interdit Apply.

### Exécution et annulation des touches

**Keyboard On** envoie à l'application au premier plan. Windows utilise Unicode
SendInput, modificateurs d'abord puis libération inverse après 80 ms pour Single.
Séparation 20 ms, au plus 16 séquences en attente par input, séquences temporaires
sérialisées. Hold peut coexister via compteurs de propriété : libérer un input
ne relâche pas la touche encore détenue par un autre. Le texte attend les
modificateurs étrangers et est envoyé en petits lots non bloquants. Linux XTest
utilise le layout X11 courant, sans Unicode complet ni Wayland natif :
[limites Linux](../getting-started/linux.fr.md).

### Modes de sortie

- **Single press** exécute une séquence par trigger, sans répétition si maintenue.
- **Hold** exécute le préfixe une fois et maintient le dernier accord jusqu'à la fin
  des conditions. `"Ready" _ Enter _ Shift` maintient finalement Shift.
  Une séquence Hold non vide doit finir par des touches ; texte seul invalide.
- **Repeat** exécute immédiatement puis aux intervalles début-à-début tant que
  l'action reste active. Pas de séquence chevauchée ni rafale de rattrapage.
  Le pulse vaut au plus 80 ms ou la moitié de l'intervalle, le gap au plus 20 ms.
  Le timer UI détermine l'exécution effective.

L'activation reste vivante avec occupation actuelle du groupe High/Low final,
doigts input/étape/région et signe Interaction. Les prérequis verts ne sont pas
revisités. Sans région de déclenchement, Ordered utilise le dernier groupe
Required de chaque voie ; Visited/Simultaneous exigent leurs groupes simultanés.
Gardes Forbidden, points/signes/doigts perdus, ancienneté et gaps arrêtent.
Un trigger balayé sans occupation finale émet Single mais pas Hold/Repeat.
Mirror conserve la main anatomique ayant activé. Une sortie terminée ne reprend
pas sans nouveau trigger. Test peut rester surligné alors que la sortie est inactive.

Stop, Restart, Recalibrate, remplacement du document, clavier désactivé, Test,
dialogues, éditeur clavier et données anciennes annulent et relâchent.
Le volet montre mode, intervalle, Held/Repeating. Les événements restent uniques ;
les hôtes SDK utilisent Engine::action_active ou InputProgress::output_active.
Ces flags et le consentement clavier ne sont jamais du JSON.

## Grille et contraintes

Grille 27x27, frontières -9..18, origines de case -9..17, ancre [4.5,3.5].
cell [x,y] = unité, [x,y,width,height] = région, valeurs entières, sans dépassement.
Bords minimaux inclus, maximaux exclus. Case = 20 % de la largeur actuelle des
épaules corrigée d'aspect. Body suit centre/axe ; calibrated garde centre/axe
initiaux et suit l'échelle actuelle, pour saut/accroupissement ordinaires.
Les coordonnées moteur sont anatomiques, l'aperçu est reflété.

Une contrainte exige id unique dans l'input, landmark connu, cell, type
(required/forbidden/trigger/interaction), priority (high/low). Facultatifs :
tolerance_for, fingers locaux et order 0..1024, défaut 0. Interaction exige aussi
son objet interaction. Les chevauchements restent indépendants.

- Required doit être visitée par son landmark.
- Forbidden invalide la tentative à toute priorité ; globale durant tout le
  mouvement, locale pendant son étape.
- Trigger appartient aux étapes et déclenche après ses prérequis. Un seul
  groupe High de déclenchement Trigger/Interaction par input. Plusieurs Triggers
  non numérotés sont plusieurs groupes et sont invalides. Les Required après
  Trigger en Ordered et étapes ultérieures ne retardent pas le déclenchement.
  Sans Trigger, la complétion déclenche.
- Interaction violette ajoute signe connu et maintien continu.
- Low Required/Trigger/Interaction référence un High de même type/landmark/scope
  via tolerance_for : alternative, pas visite obligatoire supplémentaire.
  Low Forbidden peut être indépendant ou référencer sa garde High.
  High ne référence jamais tolerance_for.

Input générique : 1..64 étapes. Chaque étape a id unique, constraints non vide
et au moins un High Required/Trigger/Interaction. mode défaut visited,
hold_ms 0..1000 défaut 0, fingers facultatif.

| Mode | Sémantique |
| --- | --- |
| visited | Cumule les visites Required dans n'importe quel ordre |
| simultaneous | Toutes les régions Required occupées ensemble |
| ordered | Ordre indépendant par landmark ; les voies progressent en parallèle |

### Alternatives numérotées

En Ordered, `order` positif numérote High Required/Trigger/Interaction. Même étape,
landmark et numéro = alternatives ; une région suffit. Les numéros croissent
indépendamment de leur position JSON. Chaque landmark garde sa voie/prérequis.
Forbidden et Low gardent `order: 0` ; la tolérance garde sa référence High.
Un groupe numéroté a un seul type. Les doigts locaux s'appliquent à la région
réellement touchée et sa tolérance. Seules les cases contactées sont surlignées.
Plusieurs jaunes numérotées peuvent constituer un seul groupe Trigger.

Une voie entièrement sans numéro suit l'ordre du tableau. Mélanger High positifs
numérotés/non numérotés dans une voie est rejeté. L'éditeur numérote la voie lors
du premier numéro manuel. Passer à Visited/Simultaneous retire explicitement les
numéros dans le profil. Peignez une ligne **Order: 1**,
puis une ligne **Order: 2** : une case de chaque ligne suffit. Repeindre du même type
change son numéro sans superposition. Auto continue les numéros ; Forbidden = X.

Les étapes suivent le tableau, au plus une par observation. Les Required globales
sont des prérequis cumulés, les Forbidden des gardes. Doigts stables et régions
s'appliquent ensemble. Un mouvement maintenu ne répète pas les événements.
Mode normal réarme après sortie du départ, Test verrouille jusqu'à Restart.
Restart garde le calibrage ; Recalibrate remplace l'ancre.

### Points corporels disponibles

Le registre `mig/core/input.hpp` couvre 33 points et head dérivé : milieu des
oreilles visibles, sinon nez. left_hand/right_hand sont alias des poignets.
Noms : nose, left/right_eye_inner, eye, eye_outer, ear, mouth_left/right,
left/right_shoulder, elbow, wrist, hand, pinky, index, thumb, hip, knee, ankle,
heel, foot_index. Mirror reflète autour de x=4.5 et échange côtés et mains des
doigts ; head/nose gardent leur identité.

## Doigts et commandes globales

Une règle exige hand left/right, finger thumb/index/middle/ring/pinky, pose
extended/closed. stable_ms 50..500 défaut 100, grace_ms 0..300 défaut 150.
Au plus dix règles/scope, sans doublon main/doigt. Input s'applique toujours,
step pendant progression, constraint pendant validation de la région.
Liste vide sans exigence. Extension >=0.7 étendu, <=0.3 fermé, confiance >=0.6.
La stabilité doit être acquise avant la grâce. Angles articulaires natifs et
association anatomique ambiguë rejetée ; précision humaine à vérifier.

### Commandes globales de l’application

`controls` contient restart/recalibrate/record_toggle facultatifs : gesture
none/thumb/v/ok/open_palm/fist et hand left/right. Par défaut désactivés.
Thumb exige seulement pouce étendu ; V index et majeur. `validation_ms` 100..1000
défaut 250, post_gesture_delay_ms exactement 1000. La récupération commence à
validation, efface reconnaissance et suspend les échantillons d'enregistrement.
Une commande maintenue se verrouille jusqu'à un relâchement connu volontaire,
pas une disparition des mains. Un couple signe/main n'appartient qu'à une
commande ; doublons rejetés. L'éditeur retire l'ancienne affectation, notamment
Right V Recalibrate si réaffecté à Record.

V global : index/majeur>=0.7, annulaire/auriculaire<=0.4, pouce<=0.55.
Thumb reste strict >=0.7/<=0.3. Les cinq observations doivent être connues.
Ces tolérances ne modifient pas les contraintes de doigts persistées.
Commandes : intervalles et résultats jusqu’à **500 ms** ; mouvements, overlays et clavier **250 ms**.
`record_toggle` reste un champ valide pour le backend d’enregistrement conservé ;
le Studio actuel n’expose pas d’outils d’enregistrement. Statut et logs indiquent
la reconnaissance et la récupération des commandes.

## Interaction violette

Seul type interaction exige l'objet interaction ; les autres le rejettent.
Elle appartient aux étapes et émet la même action que Trigger. Un groupe de
déclenchement High au plus, commun aux deux types. Chaque alternative numérotée
garde son hand/gesture/hold_ms. Les doigts existants restent requis partout.

hand left/right anatomique, gesture thumb/v/ok/open_palm/fist, jamais none.
`hold_ms` 0..60000, défaut 0 immédiat. Landmark doit être actuellement dans la zone
et main correspondre au signe ; traverser rapidement ne suffit pas. Maintien
démarre après prérequis et hold de l'étape. Sortir, perdre signe/points, données
anciennes, Restart ou rupture remet le timer à zéro. Inputs composés seulement
Interaction/Forbidden tolèrent 500 ms entre observations ; chemins/balayages 180 ms.
Clavier exige toujours 250 ms. Une Interaction occupée avec son signe réserve la
main des commandes globales, même en cooldown, pour empêcher Recalibrate d'interrompre.
Hors zone, les commandes fonctionnent normalement. Les doigts gardent leur grâce.
Low doit copier exactement les paramètres du High cible et partager son timer ;
chaque alternative High numérotée a son propre timer. Mirror échange main/landmark.
Réarmement et cooldown ordinaires s'appliquent après déclenchement.

OK : distance 3D pouce/index divisée par largeur paume indexMCP-pinkyMCP, correction
d'aspect ; ratio<=0.25, confiance contact>=0.6, majeur/annulaire/auriculaire>=0.7.
Paume/contact absent ou dégénéré rejette. Open palm exige cinq extensions>=0.7 ;
Fist cinq<=0.3 ; confiance>=0.6 pour chaque doigt. Ces classifieurs servent
commandes, statut et cellules Interaction.

### Modifier une Interaction dans Studio

Consultez le [parcours Windows](../getting-started/windows.fr.md) ou
l’[éditeur JSON Linux](../getting-started/linux.fr.md) pour modifier une Interaction.
`hand`, `gesture` et `hold_ms` restent des champs explicites de la contrainte ;
gauche/droite désignent toujours les mains de l’utilisateur. La progression distingue
les observations absentes, un mauvais signe, des doigts invalides et le maintien écoulé/requis.

Pour Interaction seul, mismatch des doigts globaux remet le timer à zéro et
attend sans verrouiller définitivement ; la règle n'est jamais contournée.
Details montre doigts/scopes/poses/délais et Interaction avec séquence clavier.
Le volet s'allume vert 900 ms pour chaque événement, y compris Test, indépendant
du clavier/logs ; Stop/remplacement efface, rien de cela n'est sérialisé.

## Enregistrement et validation

> [!NOTE]
> **Le Studio actuel n’expose pas d’outils d’enregistrement.** Le schéma conserve les
> traces des anciens profils ; ces points ne deviennent jamais des règles implicites.

Chaque entrée `recordings` contient un `landmark` et des points `[[x,y]]`.
Limites par input : **34 traces**, **2 048 points finis** par trace, dans `[-9,18)`.
Le backend conservé échantillonne tous les points sélectionnés simultanément,
au plus 20 Hz pendant 60 secondes, avec une base figée. La conversion doit tenir
dans 64 étapes. Ces limites internes ne désignent pas une barre d’enregistrement disponible.

| Élément validé | Limite |
| --- | --- |
| Document JSON | 1 Mio, profondeur 32 |
| ID, nom, action | 80 octets UTF-8 |
| Contraintes | 1 024 par scope, 4 096 par input |
| Traces | 34 × 2 048 points au maximum |

Enums ou landmarks inconnus, doublons, cases invalides, version non supportée,
Trigger mal placé ou tolérance incohérente **rejettent tout l’import**.
La sauvegarde valide avant remplacement atomique. Images, surlignage, étape actuelle,
verrous de signes et état vivant du recorder ne sont jamais sérialisés.

Jump/Crouch utilisent head/épaules dans des régions plus hautes/basses,
sans branche spéciale du moteur. Les cellules d'exemple ne sont pas universelles.
Low doit référencer High dans le même scope ; mettre fingers sur Trigger exige
seulement ce contact, sur l'input l'exige pendant tout le mouvement.

## Présentation et layers

L’éditeur projette la même grille anatomique que la reconnaissance. La vue Body
utilise la base, l’aspect, le centre, l’axe et l’échelle du snapshot ; le pointage
applique le transform inverse. Un trait fige la vue jusqu’au relâchement.
Full grid montre les **27 × 27 cases**, y compris hors de l’image caméra.

| Repère visuel | Sens dans le schéma |
| --- | --- |
| Required vert | Prérequis spatial |
| Trigger jaune | Région de déclenchement |
| Forbidden rouge / X | Garde qui invalide une tentative |
| Interaction violette | Déclenchement avec signe et maintien facultatif |
| Contour Low | Tolérance liée à une région High, sans visite obligatoire supplémentaire |
| Numéro | Progression dans la voie d’un landmark anatomique |

**Les couleurs complètent les noms et les symboles.** Thème, visibilité, onglets,
sélection et viewport sont des états UI, jamais des champs du profil. Les layers
regroupent les contraintes existantes par landmark, sans tableau JSON supplémentaire.

### Réaffecter un layer

Dans le Studio Windows actuel, changer le point suivi **réaffecte immédiatement ses
zones** et met à jour le mouvement. Une collision de destination conserve les deux
dessins. IDs, cases, ordres, tolérances et réglages doigts/Interaction restent intacts.
Les mains explicites des règles et l’identité des traces capturées sont conservées :
**vérifiez les règles anatomiques quand vous changez de côté**. File > Save persiste le document.

Les options séparées de parties du corps, d’enregistrement et d’Undo/Redo ont été retirées.
Consultez le [parcours Windows](../getting-started/windows.fr.md) et le
[guide Linux](../getting-started/linux.fr.md) pour les commandes disponibles.

### Démarrage et comportement des intégrations

Démarrage normal vide avec Right V Recalibrate, Hands désactivé jusqu'à demande.
configs/default.json est ouvert explicitement ou via --config, jamais imposé aux
nouvelles définitions. Les commandes activent Hands et le sauvegardent.
Recalibrate efface grille/progrès avec récupération 1 000 ms/verrou maintenu.

Profile importeurs commencent inputs vide, rapportent action/ID textuels.
Succès remplace/recalibre ; échec conserve. Python importe/redémarre capture sur
son propriétaire ; C++ garde caméra et remplace moteur. Tous respectent
tracking.hands ; démos l'activent pour dessiner. Fenêtres/chemins ne sont pas JSON.
Capture Motion Input Grid Controller/ABI rejette observations âgées de plus de 250 ms via horloge actuelle ;
hôtes positions possèdent leur horloge.

React/Vue/Next partagent schéma 2/session ; import valide efface retour et
recalibre sans redémarrer vidéo, invalide conserve. Framework/thème/URL/retour
sont de la présentation. Callbacks logiques, pas injection ni ordonnanceur
Hold/Repeat. [JavaScript](../integrations/javascript.fr.md). Cette préparation ne change aucun
champ ni migration. [Démarrage](../getting-started/bootstrap.fr.md), [code](../getting-started/examples.fr.md).

## Exemples JSON de la référence

Les extraits ci-dessous conservent les noms/champs exacts. Les objets partiels
s'insèrent dans leur scope décrit ci-dessus ; seul le document Jump est complet.

### Séquence clavier

```json
"keyboard": [
  {"text": "Hello world"},
  {"keys": [13]},
  {"keys": [17, 67]},
  {"keys": [67]},
  {"keys": [67]}
]
```

### Mode Repeat

```json
"action_mode": "repeat",
"repeat_interval_ms": 375,
"keyboard": [{"keys": [17, 67]}]
```

### Alternatives numérotées

```json
[
  {"id":"bottom_a","landmark":"right_wrist","cell":[1,5],"type":"required","priority":"high","order":1},
  {"id":"bottom_b","landmark":"right_wrist","cell":[2,5],"type":"required","priority":"high","order":1},
  {"id":"top_a","landmark":"right_wrist","cell":[1,3],"type":"required","priority":"high","order":2},
  {"id":"top_b","landmark":"right_wrist","cell":[2,3],"type":"required","priority":"high","order":2}
]
```

### Interaction OK

```json
{
  "id": "confirm", "landmark": "left_wrist", "cell": [4, 5],
  "type": "interaction", "priority": "high",
  "interaction": {"hand": "left", "gesture": "ok", "hold_ms": 400}
}
```

### Document Jump

```json
{
  "schema_version": 2,
  "tracking": {"hands": false},
  "controls": {
    "restart": {"gesture": "thumb", "hand": "left"},
    "recalibrate": {"gesture": "v", "hand": "right"},
    "record_toggle": {"gesture": "thumb", "hand": "right"},
    "validation_ms": 250,
    "post_gesture_delay_ms": 1000
  },
  "inputs": [{
    "id": "jump", "name": "Jump", "action": "jump", "keyboard": [{"keys": [32]}],
    "mirror": false, "space": "calibrated", "max_duration_ms": 0, "cooldown_ms": 0,
    "steps": [{
      "id": "rise", "mode": "simultaneous",
      "constraints": [
        {"id": "head_high", "landmark": "head", "cell": [4,-2,1,3], "type": "required", "priority": "high"},
        {"id": "left_rise", "landmark": "left_shoulder", "cell": [6,1], "type": "required", "priority": "high"},
        {"id": "right_rise", "landmark": "right_shoulder", "cell": [2,1], "type": "required", "priority": "high"}
      ]
    }]
  }]
}
```

## Liste des profils du Motion Input Grid Controller

Le Motion Input Grid Controller conserve les noms dans un `profiles.json` séparé, avec `version: 1`,
`selected` (indice à partir de zéro, ou -1) et un tableau `profiles` contenant
des objets `{ "id": "1", "name": "Jeu" }`. Les identifiants numériques désignent
les fichiers gérés `1.json`, `2.json`, etc., qui restent des configurations du schéma v2.
La liste est limitée à 64 entrées et 64 Kio ; les noms à 256 octets UTF-8.
Les imports et modifications de liste utilisent un remplacement atomique.
L’aperçu, la vérification et l’activation du clavier sont des réglages de session
et ne changent pas le JSON des mouvements. Voir le [Motion Input Grid Controller](../guides/controller.fr.md).

## Exemple complet HI du Studio

Le profil complet [studio-hi.json](../../configs/studio-hi.json) est l’exemple du tutoriel interactif du site. Importez-le directement dans Studio ou Controller. Il suit le poignet gauche anatomique dans le repère du corps : passez dans la bande verte inférieure puis dans la bande jaune supérieure pour émettre `next_slide` et appuyer une fois sur la flèche droite. Testez les dimensions avec votre caméra.

```json
{
  "schema_version": 2,
  "tracking": {"hands": false},
  "inputs": [{
    "id": "hi", "name": "HI", "action": "next_slide", "space": "body",
    "cooldown_ms": 700,
    "keyboard": [{"keys": [39]}],
    "action_mode": "single_press",
    "steps": [{
      "id": "wave", "mode": "ordered",
      "constraints": [
        {"id": "start", "landmark": "left_wrist", "cell": [-4, 4, 18, 4],
         "type": "required", "priority": "high", "order": 1},
        {"id": "finish", "landmark": "left_wrist", "cell": [-4, -3, 18, 6],
         "type": "trigger", "priority": "high", "order": 2}
      ]
    }]
  }]
}
```

> [!IMPORTANT]
> **Omettre `keyboard` ou utiliser `[]` n’envoie aucune touche.** Le nom de l’action logique ne définit aucun raccourci implicite.

| Définition | Résultat |
| --- | --- |
| `[{"keys":[17,39]}]` | Un raccourci simultané Ctrl+Droite |
| `[{"keys":[17]},{"keys":[39]}]` | Appuie/relâche Ctrl, puis appuie/relâche Droite |
| `action_mode: "hold"` | Maintient seulement le dernier accord tant que l’activation reste valide |
| `action_mode: "repeat"` | Répète la séquence tant que l’activation reste valide |

Aucune touche implicite ni délai personnalisé. `blocking` n’est pas un champ du
profil : utilisez `type: "forbidden"`. Seul **`schema_version: 2`** est accepté.
