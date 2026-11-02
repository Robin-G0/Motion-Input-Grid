# Validation manuelle et observation connue

| Combinaison | Évidence disponible au 1 novembre 2026 | Ce qui reste à préciser |
|---|---|---|
| Opera + Canva | L'utilisateur confirme que le contrôle a bien fonctionné. Après une sortie du champ puis un retour, absence de réponse quelques secondes, puis reprise spontanée. | Versions navigateur/OS, mode manuel/auto, durée approximative, éclairage/épaules visibles et reproductibilité non communiqués. |
| Chrome + quatre services | Pas de nouveau test manuel utilisateur communiqué. | Tester suivant/précédent, animations, focus texte, arrêt, caméra et mode automatique. |
| Firefox + quatre services | Les essais automatisés existants couvrent le chargement caméra/modèles/CSP, pas une validation de chaque service réel. | Mêmes essais manuels ; compte de service si nécessaire. |
| macOS / Linux, caméras physiques | Aucun nouveau résultat communiqué. | Confirmer matériel, permissions et récupération du tracking. |

## Retour au champ de la caméra

Observation conservée telle quelle ; cause non établie, aucun correctif dans cette préparation de store. Pour reproduire : démarrer en manuel, faire fonctionner les deux gestes, sortir 5 secondes du champ, revenir épaules visibles, chronométrer la première reconnaissance. Refaire après recalibration puis en mode automatique, noter versions et résultats. Ne pas annoncer une reprise instantanée sur la fiche.

## Parcours minimal par combinaison

- Installation du ZIP exact destiné au store ; noter version et SHA-256.
- Calibration puis suivant/précédent, retour au repos et animation intermédiaire.
- Réassociation de touche et import du profil d'exemple.
- Focus dans un champ texte, changement d'onglet et fermeture de présentation.
- Mode automatique : armement, entrée/sortie diaporama, éventuelle fenêtre enfant.
- Sortie du champ, retour, recalibration ; absence de touche involontaire.
- Arrêt et fermeture de la fenêtre contrôleur : piste caméra terminée et icône grise.

Joindre aux résultats des captures prises réellement par l'utilisateur. Ce document ne transforme pas un test Chromium en validation Opera, ni un chargement de modèles Firefox en test Canva.
