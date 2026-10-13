# Plugin runtime Unreal Motion Input Grid (MIG)

[English](README.md) | [Français](README.fr.md)

**Télécharger l’intégration :** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-unreal-integration) · [Linux x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-unreal-integration) · [Linux ARM64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-unreal-integration).

**Preview.** Les exports éditeur/jeu et un fournisseur réel restent à valider. Voir la [matrice de support](../../docs/reference/support.fr.md).

Extrayez le ZIP `motion-input-grid-<version>-<plateforme>-unreal.zip` adapté dans `Plugins` de
votre projet. Activez **Motion Input Grid**, recompilez le projet C++ et ajoutez
`UMIGTrackerComponent` à un acteur. Le plugin contient les sources du pont,
l'en-tête C ABI, la bibliothèque adaptée et les licences. Il cible Unreal Engine 5
sur Windows/Linux, avec des packages Linux ARM64. La compilation dans l'éditeur
et les jeux exportés doivent être vérifiés dans votre version du moteur.

Appelez `ImportJson` avant les observations. `SubmitFrame(const mig_packet&)`
accepte les paquets anatomiques sur le thread du jeu. `OnAction` diffuse une copie
des chaînes action/input pour autoriser import/reset/close dans les callbacks.
`IsActive`, `Reset` et `Close` exposent le cycle de vie de l'ABI C. Un import invalide
préserve la configuration ; une mise à jour échouée renvoie false. Le moteur C++
MIG assure toute la reconnaissance.

Le contenu `ThirdParty` provient du SDK installé. Il n'inclut ni estimateur,
ni copie statique du moteur, ni UI de démonstration, ni modèle caméra. Windows
nécessite le runtime VC++ adapté. Fournissez votre estimateur. Utilisez le ZIP
de votre cible et assemblez les bibliothèques compilées séparément avant un
export multi-plateforme. Les [démos Unreal](../../examples/unreal/README.fr.md)
restent séparées.

[Distribution](../../docs/getting-started/packages.fr.md) · [Paquet ABI C](../../docs/reference/c-abi.fr.md).
