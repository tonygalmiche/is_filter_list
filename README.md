# Module Filtres Rapides pour Vues Liste (is_filter_list)

Ce module améliore l'expérience utilisateur dans Odoo 18 en ajoutant une ligne de filtres rapides directement sous les en-têtes de colonnes dans les vues liste. Il permet de filtrer les données intuitivement et rapidement sans avoir à utiliser la barre de recherche avancée ("Control Panel").

## Fonctionnalités Principales

*   **Filtres en ligne** : Ajout automatique d'un champ de saisie sous chaque colonne filtrable.
*   **Persistance Automatique** : Les filtres saisis sont mémorisés par utilisateur et par vue. Ils sont automatiquement réappliqués lorsque vous revenez sur la page ou la rechargez.
*   **Chargement Optimisé** : Les filtres sauvegardés sont appliqués **avant** le premier affichage des données, évitant ainsi tout effet de "flash" désagréable.
*   **Support Multi-types** : Gestion intelligente des différents types de champs (Texte, Nombres, Dates, Booléens, Sélections).
*   **Opérateurs Logiques** : Support des opérateurs OU et ET pour des recherches complexes.
*   **Wildcards** : Utilisation du caractère `*` pour des recherches de type "commence par", "se termine par", etc.
*   **Gestion des Colonnes Optionnelles** : Si une colonne est masquée par l'utilisateur, le filtre associé est automatiquement effacé et désactivé pour ne pas fausser les résultats.
*   **Sécurité** : Les champs non "recherchables" (ex: champs calculés non stockés) sont détectés et n'affichent pas de champ de saisie pour éviter les erreurs techniques.

## Guide d'Utilisation

### 1. Filtrage de Texte (Char, Text, Many2one)

#### Recherche simple
*   Saisissez simplement une partie du texte recherché.
*   Le filtre effectue une recherche de type "contient" (ilike), insensible à la casse.

#### Wildcards avec `*`
Le caractère `*` permet de spécifier où doit se trouver le texte recherché :

| Syntaxe | Comportement | Exemple |
|---------|--------------|---------|
| `abc` | Contient "abc" | "**abc**def", "xy**abc**", "x**abc**y" |
| `abc*` | Commence par "abc" | "**abc**def", "**abc**123" |
| `*abc` | Se termine par "abc" | "xyz**abc**", "123**abc**" |
| `abc*xyz` | Commence par "abc" et se termine par "xyz" | "**abc**123**xyz**" |

### 2. Opérateurs Logiques (OU / ET)

Ces opérateurs fonctionnent sur **tous les types de champs**.

#### Opérateur OU
Utilisez la virgule `,` ou le mot-clé `OU` pour chercher plusieurs valeurs alternatives :
*   `toto, tutu` → Contient "toto" **OU** "tutu"
*   `toto OU tutu` → Même résultat
*   `2024-01 OU 2024-02` → Janvier **OU** Février 2024
*   `Paris, Lyon, Marseille` → Ville est Paris **OU** Lyon **OU** Marseille

#### Opérateur ET
Utilisez le mot-clé `ET` pour combiner plusieurs conditions :
*   `toto ET tutu` → Contient "toto" **ET** "tutu"
*   `>100 ET <500` → Valeur supérieure à 100 **ET** inférieure à 500
*   `>2024-01 ET <2024-06` → Entre Février et Mai 2024

#### Combinaison avec Wildcards
*   `toto*, *tutu` → Commence par "toto" **OU** se termine par "tutu"
*   `abc* ET *xyz` → Commence par "abc" **ET** se termine par "xyz"

> **Note** : Les virgules dans les nombres décimaux (ex: `1,5`) sont préservées et ne sont pas interprétées comme séparateur OU.

### 3. Filtrage de Sélections
*   Saisissez une partie du libellé de l'option désirée.
*   Le système filtrera sur les valeurs dont le libellé correspond.

### 4. Filtrage Numérique (Entier, Décimal, Monétaire)
Vous pouvez utiliser des opérateurs de comparaison mathématique.
*   `100` : Valeur égale à 100.
*   `>100` : Strictement supérieur à 100.
*   `>=100` : Supérieur ou égal à 100.
*   `<100` : Strictement inférieur à 100.
*   `<=100` : Inférieur ou égal à 100.
*   La virgule `,` est acceptée comme séparateur décimal (ex: `>10,5`).

#### Exemples avec opérateurs logiques
*   `10, 20, 30` → Valeur égale à 10 **OU** 20 **OU** 30
*   `>100 ET <200` → Valeur entre 100 et 200 (exclus)

### 5. Filtrage de Dates et Heures
Le module supporte une syntaxe riche pour les dates, avec gestion automatique des plages horaires et des fuseaux horaires.
*   **Année** : `2025` (Filtre sur toute l'année 2025).
*   **Mois** : `2025-01` (Filtre sur Janvier 2025).
*   **Semaine** : `2025-S01` (Filtre sur la semaine n°1 de 2025).
*   **Jour** : `2025-01-31` ou `31/01/2025`.
*   **Opérateurs** : Vous pouvez combiner ces formats avec des opérateurs.
    *   `>2025` : Dates après 2025.
    *   `<=2025-03` : Dates avant ou pendant Mars 2025.

#### Exemples avec opérateurs logiques
*   `2024-01 OU 2024-03` → Janvier **OU** Mars 2024
*   `>2024-01 ET <2024-06` → Entre Février et Mai 2024 (exclus)

### 6. Filtrage Booléen
Pour filtrer les cases à cocher :
*   **Pour VRAI (Coché)** : Saisissez `1`, `true`, `vrai`, `yes` ou `oui`.
*   **Pour FAUX (Décoché)** : Saisissez `0`, `false`, `faux`, `no` ou `non`.
*   Laissez vide pour tout afficher.

## Comment l'utiliser sur vos vues

Pour activer cette fonctionnalité sur une vue liste existante, vous devez surcharger la vue XML et ajouter l'attribut `js_class="filter_list"` à la balise `<list>` (ou `<tree>`).

### Exemple de surcharge XML

```xml
<record id="view_account_move_filter_list" model="ir.ui.view">
    <field name="name">account.move.filter.list</field>
    <field name="model">account.move</field>
    <field name="inherit_id" ref="account.view_move_tree"/>
    <field name="arch" type="xml">
        <xpath expr="//list" position="attributes">
            <attribute name="js_class">filter_list</attribute>
        </xpath>
    </field>
</record>
```

Si vous créez une nouvelle vue :

```xml
<record id="my_custom_view_tree" model="ir.ui.view">
    <field name="name">my.custom.model.tree</field>
    <field name="model">my.custom.model</field>
    <field name="arch" type="xml">
        <list js_class="filter_list">
            <field name="name"/>
            <field name="date"/>
            <!-- ... -->
        </list>
    </field>
</record>
```

## Détails Techniques

*   **Modèle de stockage** : `is.filter.list.mem.var` est utilisé pour stocker les préférences de filtrage des utilisateurs.
*   **Architecture** : Le module étend `ListController` et `ListRenderer` via OWL (Odoo Web Library).
*   **Chargement optimisé** : Les filtres sauvegardés sont chargés de manière asynchrone et appliqués avant le premier rendu grâce à un patch de la méthode `model.load()`.
*   **Compatibilité** : Conçu pour Odoo 18.0.

## Installation

Installez le module comme un module Odoo standard. Une fois installé, la fonctionnalité est active par défaut sur les vues liste compatibles.
