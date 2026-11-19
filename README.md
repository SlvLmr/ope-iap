# Opé IAP — « Coup de boost pour les ATC »

Opération flash sur les serrures de sécurité, réservée au réseau des Installateurs Agréés Picard (IAP), **du 23 au 27 novembre 2026 (jusqu’à 18h)**.

## Les pages

| Page | Pour qui | Accès |
|---|---|---|
| `index.html` | Présentation de l’opération (visio du 20/11) : 13 slides | Libre |
| `atc.html` | Espace de chaque ATC : sa to-do phoning | Code personnel |
| `suivi.html` | Tableau de suivi : direction, ADV | Code direction ou ADV |
| `bon.html` | Bon de commande imprimable (prérempli depuis l’espace ATC) | Libre, vide par défaut |

### Présentation
Flèches du clavier, espace ou clic pour avancer, `F` pour le plein écran, glisser sur mobile. Les prix et remises sont calculés à partir de `js/offre.js`. Bouton **PDF** (ou touche `P`) : export une slide par page. Slide « Le kit » : un clic sur *Mail type* affiche le mail prêt à copier, *Bon de commande* ouvre le bon, *Fiches produits* renvoie aux slides produits.

### Espace ATC
- **Objectif annuel** : CA actuel, objectif, reste à faire, et ce que les commandes de l’opération y apportent.
- Uniquement les IAP de l’ATC, triés Elite → Premium → Officiel, avec leurs coordonnées (téléphone cliquable).
- To-do par IAP : **Date / Appel / Mail / Présentation / Commande**. Chaque étape cochée est datée automatiquement.
- Filtres : à traiter, à rappeler, pas encore appelés, commandés.
- Fiche IAP : mail « Proposition et tarification suite à notre échange téléphonique » prérempli (messagerie ou copie mise en forme pour Outlook), bon de commande prérempli, saisie des quantités (montant calculé aux prix promo), date de rappel, commentaire.
- Onglet *Mail type & bon* : le mail type signé au nom de l’ATC (copie mise en forme ou texte) et un bon de commande vierge à son nom.
- Onglet *Argumentaire & prix* : fiches produits issues de picard-serrures.com.
- Lien direct : `atc.html#code=XXXX-XXXX` connecte l’ATC sans saisie.

### Suivi
- Indicateurs (CA, commandes, serrures vendues, panier moyen, IAP appelés, reste à faire des ATC), entonnoir, ventes par référence, classement des ATC avec CA actuel / objectif / reste à faire / atteinte, activité récente. Actualisation chaque minute.
- Détail de tous les IAP, filtres, **exports Excel** (commandes pour l’ADV, suivi complet).
- Direction uniquement : **objectifs annuels** (CA actuel et objectif par ATC, modifiables), **codes d’accès** (copier les liens, régénérer, désactiver, créer) et **import du listing IAP** (même format que « Listing IAP 2026 »).

## Données et sécurité

- Base Supabase du projet **COMMERCE**, tables séparées `boost_*` (aucun lien avec PICARD-ATC). Schéma : [`sql/schema.sql`](sql/schema.sql).
- **Aucune donnée IAP dans ce dépôt** : le listing est importé dans la base (le `.gitignore` bloque les fichiers Excel).
- Les tables ne sont pas lisibles directement : tout passe par des fonctions qui vérifient le code. Un ATC ne voit et ne modifie que ses IAP ; l’ADV est en lecture seule ; la direction gère les codes et le listing.
- Chaque modification est historisée (`boost_journal`).
- Les chiffres (CA, objectifs) sont stockés dans la base, jamais dans ce dépôt.
- Les codes ne sont pas écrits ici : ils se consultent dans `suivi.html`, onglet *Codes & listing*.

## Modifier l’offre
Les produits, prix et textes (mail type) sont dans [`js/offre.js`](js/offre.js). Un changement de prix doit aussi être reporté dans la fonction `boost_prix` de la base (calcul du montant côté serveur).

## Mise en ligne
GitHub Pages : *Settings → Pages → Deploy from a branch → `main` / root*. Adresse : `https://slvlmr.github.io/ope-iap/`.
