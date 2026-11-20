# Performances temps réel et vérification

[English](performance.md) | [Français](performance.fr.md)

> [!IMPORTANT]
> **Le temps du moteur n’est pas la latence caméra-action.** Le benchmark exclut capture,
> inférence, affichage et envoi des touches. Il ne fournit aucune mesure de latence de bout en bout.

Le moteur transforme des positions en événements. Capture, modèles, marshalling,
dessin et clavier sont des coûts séparés. Les tests synthétiques ne mesurent pas la qualité de suivi d’une webcam.

## Travail et propriété

| Symbole / limite | Valeur |
| --- | --- |
| J | 34 points corporels, dont le point `head` dérivé |
| M | Jusqu’à 64 inputs |
| K | Jusqu’à 4 096 contraintes par input |
| F | Nombre de règles de doigts compilées |
| N | Nombre de pixels capturés |
| Par scope / input | 1 024 contraintes par scope, 64 étapes par input |
| Document JSON | 1 Mio, profondeur maximale 32 |

**Construction et validation sont hors de la boucle temps réel.**

| Étape | Coût | Stockage |
| --- | --- | --- |
| Conversion capture | O(N) | RGB réutilisé, BGRX seulement si affiché |
| Inférence | Pose + Hands facultatif | Un propriétaire, allocations upstream possibles |
| Conversion points | O(J+42) | Valeurs fixes, monde facultatif |
| Grille | O(1), médiane une fois | Buffer de 90 valeurs, échelle actuelle, ancre fixe |
| Projection | O(J) par combinaison | Quatre buffers fixes Body/Calibrated miroir/normal |
| Reconnaissance | Pire O(MK+F), recontrôles groupes/tolérances | Candidats/timers/événements bornés, pas de new dans le test update |
| Transfert Windows | Dernier état borné | Quatre leases, libération dernier lecteur sous mutex |
| Transfert Linux | Dernière image, 64 événements au plus | Tâches worker, image Qt copiée |
| Dessin Windows | O(pixels+overlays) | Deux buffers réutilisés, objets GDI temporaires |
| JSON | O(octets)+validation bornée | Remplacement atomique, définitions immuables |
| Clavier | Files et états bornés | Compteurs de propriété des touches |

Seuils stricts, cases semi-ouvertes, continuité, stabilité/grâce et maintien sont
préservés. Pas de fast-math, substitution du modèle ou réduction arbitraire Hands.

## Mesurer le moteur

```sh
cmake -S . -B build/bench -G Ninja -DCMAKE_BUILD_TYPE=Release \
    -DMIG_BUILD_CONFIGURATOR=OFF -DMIG_BUILD_CONTROLLER=OFF \
    -DMIG_BUILD_BENCHMARKS=ON
cmake --build build/bench
build/bench/tests/benchmarks/mig-engine-benchmark
```

**100 000 mises à jour par cas**, préparation des points comprise, sans caméra, inférence ni UI.
Ces cas incluent des phases inactives/verrouillées ; ils ne représentent pas un
scan au pire cas de 4096 contraintes. Comparez événements
acceptés et mesures intercalées sur même machine/compilateur.

### Ce que vérifient les tests

[Le test temps réel](../../tests/core/realtime_tests.cpp) compare 64 inputs avec espaces/miroirs différents à des moteurs isolés pendant le calibrage,
mouvements, absences et données anciennes ; événements/progrès/activité et allocations
ordinaires sont vérifiés. Autres tests : doigts, interactions, alternatives, balayage,
maintien long, temps, sorties, ownership. ASan/UBSan portable ne prouve pas l'absence
de fuite dans l'estimateur tiers.

### Mesurer une vraie caméra

Mesurez séparément **capture, âge du résultat, inférence, affichage et latence caméra-touche** sur le matériel cible.
La reconnaissance et les sorties natives rejettent les résultats âgés de plus de **250 ms** ;
les commandes gestuelles ont une limite de **500 ms**. Les applications utilisent Lite CPU
par défaut ; la classe native `Pose` utilise Full par défaut. Utilisateurs et développeurs
peuvent choisir Lite, Full ou Heavy (voir le [guide Controller](../guides/controller.fr.md#affichage)
et le [guide npm](../../bindings/javascript/README.fr.md#choix-du-modele-de-pose)). Toutes les variantes prédisent
les **33 points corporels** : ignorer les jambes dans les règles ne réduit pas le travail du modèle.
[Guide officiel](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker).

| Variante | Taille | Coût attendu | Usage |
| --- | --- | --- | --- |
| Lite | 5,8 Mo, livrée | Latence minimale | Défaut ; suffit aux parcours poignets/épaules |
| Full | 9,4 Mo, livrée en natif, téléchargée à la demande dans le navigateur | Environ deux fois Lite | Points plus stables quand le CPU le permet |
| Heavy | 30,7 Mo, téléchargée à la demande et mise en cache | Plusieurs fois Lite | Points les plus précis ; la précision n'implique pas des commandes plus fiables |

Les fichiers sont vérifiés avec leur SHA-256 épinglé avant chargement et les
téléchargements sont publiés atomiquement après vérification. Le temps d'inférence
dépend surtout du modèle et du délégué : le natif utilise le CPU, le navigateur
peut demander `GPU` (WebGL) et revient au CPU en cas d'échec. Les Controllers
n'exécutent le modèle des mains que si un profil utilise règles de doigts, signes
ou commandes manuelles (`uses_hand_observations`), ce qui retire un second graphe
par image pour les profils corps seul.
L'inférence reste la cible principale du profilage. SIMD, ordonnanceur et cadence/
qualité modèle nécessitent mesures matériel et précision. Ni benchmark ni image
vide ne prouve la précision humaine ou les performances assis/debout.

Les sessions navigateur peuvent limiter la cadence d'inference, regler la capture et eviter le dessin inutile. Voir les [reglages navigateur](../../bindings/javascript/README.fr.md#reglages-de-performance-du-navigateur). Les profils sans mains reportent ce chargement. Mesurer les resultats sur le materiel reel avant de conclure sur la temperature ou la latence.
