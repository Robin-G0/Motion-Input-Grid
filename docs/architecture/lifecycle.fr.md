# Pipeline actuel

[English](lifecycle.md) | [Français](lifecycle.fr.md)

> [!IMPORTANT]
> **Un propriétaire par moteur/session de capture.** Copiez les données empruntées avant de les transmettre à un autre thread.
> Stop rejoint le thread d’inférence ; un appel d’inférence tiers doit revenir avant la fin de l’arrêt.

Cette page décrit les propriétaires effectifs. L'[architecture](overview.fr.md)
décrit les modules ; les [performances](performance.fr.md) séparent reconnaissance,
estimation native et affichage.

## Résultats de compilation

MIG::core et MIG::format sont des bibliothèques statiques C++ portables.
MIG::hands ajoute géométrie, MIG::native capture/estimation, MIG::face seulement
un squelette. MIG::c produit mig-c.dll/libmig-c.so.1. Les applications sont Win32/GDI
sous Windows et Qt 6 sous Linux. libmediapipe.dll/.so est chargé par chemin absolu.
Les modèles Lite/Full et Hands facultatif accompagnent le runtime.
Les apps choisissent Lite, Pose natif Full ; les deux estiment 33 points corporels.

## Windows

```text
Capture Media Foundation, horodatage monotone
  -> buffers RGB/BGRX réutilisés, quatre leases
  -> boîte au dernier état, réveil du propriétaire de l'inférence
  -> corps + mains explicitement demandées, même image/temps
  -> conversion bornée des observations
  -> fraîcheur, calibrage, contraintes compilées, arbitrage
  -> snapshot immuable avec révision + événements bornés
  -> affichage et ordonnanceur Single/Hold/Repeat consenti
```

La caméra principale lit la dernière capture indépendamment. Le dernier lecteur
libère sous mutex pour empêcher une réutilisation concurrente. Le pool survit aux
leases en fermeture. Résultats natifs et snapshots peuvent allouer ; seul update
du moteur compilé ne le fait pas dans le test de régression. Les révisions de
profil/Hands/calibrage rejettent les résultats obsolètes. Pas de file illimitée
ni d'inférence dans la boucle UI.

## Linux et applications intégrées

Le worker Linux possède V4L2, tâches, moteur et commandes. Il publie images/points
copiés et jusqu'à 64 événements horodatés. Un changement arrête et rejoint avant
remplacement. Les widgets restent sur le thread principal. La capture YUYV
single-plane négocie jusqu'à 720p et les attentes poll sont bornées.

### Hôtes SDK positions et natifs

Les hôtes positions fournissent des paquets frais non reflétés, sans caméra.
Les hôtes natifs estiment RGB ou lisent capture. CaptureRuntime équilibre COM/
Media Foundation. Start/poll/stop/destroy restent sur un propriétaire ; un import
valide arrête capture, un invalide la conserve. Poll reconnaît déjà le paquet.
Les pixels expirent au poll suivant ; Python copie avant publication à l'UI.

### Sessions navigateur

La session navigateur possède modèles, WASM, stream et générations d'annulation.
Start demande capture ; Stop libère les pistes ; Dispose libère tout. Une seule
inférence par nouvelle image. React/Vue reçoivent statut/actions, pas tableaux
de points. SSR Next n'ouvre aucune ressource navigateur.

## Reconnaissance, capacités, sorties

Grille 27x27, ancre [4.5,3.5], case de 20 % de la largeur actuelle des épaules,
filtre 35 ms. Les quatre projections Body/Calibrated normal/miroir sont fixes.
Affichage reflété une fois ; Mirror d'input échange l'anatomie séparément.
Profondeurs corps/main conservent leurs origines et coordonnées métriques facultatives.

Les apps restaurent tracking.hands. Les demandes UI et règles doigts/signes
l'activent ; Pose intégré demande set_hands_enabled(true). False supprime création
et inférence Hands, pas seulement le dessin. OFF rejette les demandes non supportées.

Les inputs sont évalués avant les commandes globales. Interaction occupée avec
signe valide réserve la main. Maintien Interaction seul et commandes tolèrent
500 ms entre observations ; chemin/balayage 180 ms. Fraîcheur native/sorties
250 ms, commandes 500 ms. Un événement accepté et un état terminal actif distinct
sont produits.

### Propriété des sorties desktop

`ActionOutput` sérialise les séquences temporaires, partage les touches Hold par
compteurs et répète sans chevauchement/rattrapage. Le texte attend les modificateurs
étrangers. L'utilisateur active les sorties ; Windows utilise SendInput Unicode,
Linux XTest et le clavier X11 courant, sans Wayland natif. Test, dialogues, Stop,
reset et données anciennes libèrent. Les SDK n'injectent pas de touches.

## Arrêt et contrôles

Stop réveille/annule capture, rejoint les propriétaires puis libère tâches,
buffers et touches. L'appel opaque upstream doit revenir avant join, sans garantie
d'annulation. JSON limité à 1 Mio/profondeur 32, staging isolé et remplacement atomique.

### Portée des validations

CTest couvre règles, conversion, capacités, leases et inférence d'images vides.
Les tests UI/navigateur sont synthétiques ; ASan/UBSan concerne le portable.
Ils ne prouvent ni précision caméra ni absence de fuite tierce. MIG n'enregistre
ni ne téléverse les images, mais des connexions de télémétrie upstream ont été
observées. Les fichiers navigateur locaux suppriment le CDN, pas toute connexion
possible. [Contrôles restants](../reference/support.fr.md).
