# Vérifications de préparation du 1 novembre 2026

- ZIP Chrome et Opera : mêmes octets, nom de fichier différent ; chaque fichier correspond au build Chromium.
- ZIP Firefox : chaque fichier correspond au build Firefox, manifeste spécifique Mozilla compris.
- Reconstruction isolée : sources extraites de l'archive de revue, dépendance npm locale épinglée réutilisée, build Node relancé ; tous les fichiers Chromium/Firefox reconstruits identiques aux fichiers soumis. Ce contrôle n'est pas une compilation C++→WASM indépendante ni une nouvelle installation npm depuis le réseau.
- Code/manifestes : 7 tests Node de l'extension réussis, dont reconnaissance par le vrai WASM ; versions, locales, limites des résumés, permissions et licences contrôlées.
- `web-ext lint` : 0 erreur, 0 notice, 3 avertissements d'import dynamique dans `mig/models.mjs`, `mig/session.mjs`, `mig/vision/vision_bundle.mjs`. Ressources embarquées, explication dans les notes évaluateur. Le message séparé d'échec de vérification de mise à jour de web-ext n'affecte pas ces résultats ; aucune configuration globale n'a été modifiée.
- Graphismes : PNG 64/96/128 et illustration 440×280 vérifiés ; icône carrée 128 avec dessin 96×96 et marge transparente de 16 pixels. Illustration inspectée. Aucune capture réelle d'application créée.
- Site : build statique réussi après installation hors ligne des dépendances verrouillées ; page bilingue incluse à l'identique, contact et ancres vérifiés, aucun script sur la page de confidentialité.
- Documentation : validateur du dépôt réussi pour 122 guides ; absence d'erreur de whitespace dans le diff suivi.

Les essais physiques Chrome/Firefox, les autres services et les tests complets Playwright ne sont pas présentés comme relancés pendant cette préparation. Le seul retour manuel nouvellement fourni est Opera + Canva, avec délai de reprise à reproduire. Aucun upload, signature, push, déploiement ou publication de store n'a eu lieu.

Les empreintes exactes et la reconstruction sont enregistrées dans `SHA256SUMS`, `file-hashes.json`, `runtime-provenance.json` et `VALIDATION.json` du dossier généré. Régénérer ces fichiers après toute modification et avant de soumettre une nouvelle archive.
