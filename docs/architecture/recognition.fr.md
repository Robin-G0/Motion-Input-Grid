# Reconnaissance et coordonnées

[English](recognition.md) | [Français](recognition.fr.md)

> [!TIP]
> **Un geste non reconnu ?** Vérifiez d’abord les [intervalles et l’âge des observations](#faible-fréquence-et-exemples).
> Un intervalle de 180 ms et un paquet âgé de 250 ms sont deux limites différentes.

## Faible fréquence et exemples

| Limite | Valeur | Signification |
| --- | --- | --- |
| Intervalle entre observations d’un chemin | ≤ 180 ms | Un plus grand intervalle interrompt le balayage |
| Intervalle d’un maintien Interaction seul | ≤ 500 ms | Occupation réelle et bon signe requis ; un parcours combiné à Interaction conserve la limite de 180 ms |
| Âge du paquet reconnu | ≤ 250 ms | Dépend du temps courant, pas de l’intervalle entre captures |

Le moteur teste le segment entre deux positions visibles. Il n'exige pas une
frame dans chaque cellule intermédiaire. Le sweep nécessite un intervalle maximal de
180 ms ; au-delà, le chemin actif échoue plutôt que d'inventer un trajet. Interaction seul
autorise 500 ms mais exige occupation et signe réels. Une observation âgée de plus de
250 ms est rejetée. Les exemples utilisent de larges régions départ/arrivée.
Le test example-motion couvre deux poignets, 33/100/160/180 ms, sens inverse, pose
terminale seule et rupture à 181 ms.
Le viewer Python reconstruit ses outlines depuis les épaules brutes ; l'échelle MIG
étant lissée, des déplacements d'épaules peuvent créer un décalage temporaire.
Prenez ce décalage en compte lors du diagnostic d’un mouvement non reconnu.

## Grille et espaces

L'image utilise des points anatomiques normalisés non reflétés. La correction
d'aspect stabilise les distances. Les épaules donnent axe, centre et largeur.
Le calibrage acquiert une médiane stable ; une case vaut 20 % de la largeur
actuelle des épaules, filtrée sur 35 ms. Grille 27x27, limites [-9,18), origines
-9..17, ancre [4.5,3.5]. Body suit centre/axe du torse ; calibrated conserve
centre/axe initiaux avec l'échelle actuelle, pour saut/accroupissement génériques.
Après plus de 180 ms sans observation, l'échelle adopte immédiatement la valeur
fraîche. Projection et pointage inverse utilisent le même transform ; un trait
gèle sa vue jusqu'au relâchement.

### Profondeur et miroir

Le Z image du corps est relatif aux hanches, celui des mains au poignet.
Le monde du corps est en mètres relatifs aux hanches, celui des mains au centre
de la main. Ne mélangez pas ces origines. Le rapport de largeur des épaules
fournit une approximation d'approche, pas une distance caméra métrique.
Une profondeur inconnue reste absente. L'affichage reflète X une fois ; Mirror
de reconnaissance échange l'anatomie et reflète les règles autour de x=4.5.

## Reconnaissance

Un input a gardes/doigts globaux et jusqu'à 64 étapes. Les régions superposées
restent indépendantes. Visited cumule, Simultaneous demande occupation actuelle,
Ordered avance par voies anatomiques parallèles. Les numéros regroupent des
alternatives ; sans numéros l'ordre du tableau s'applique. Low référence une
zone High. Forbidden invalide la tentative lorsqu'elle est traversée.

Un seul groupe de déclenchement High peut être Trigger ou Interaction violette.
Trigger valide le préfixe ; les règles suivantes sont des métadonnées de suivi.
Interaction demande occupation, signe connu et maintien continu jusqu'à 60000 ms,
sans activation par simple balayage. Les doigts globaux/étape/région gardent
stabilité et grâce ; une observation manquante ne contourne pas une règle.
Les variantes normales arbitrent les ambiguïtés de même poignet ; Test isole
l'input. `output_active` décrit les conditions terminales actuelles, séparément
du surlignage Test persistant. Réarmement et cooldown empêchent les doublons.

### Attribution des mains et commandes

L'association native utilise les poignets du corps et rejette l'ambiguïté.
Thumb, V, OK, Open palm, Fist sont partagés entre commandes et Interaction.
Une Interaction correspondante réserve sa main. Restart/Recalibrate/RecordToggle
ont validation, relâchement volontaire et récupération fixe 1000 ms ; perdre
le tracking n'est pas relâcher volontairement.

