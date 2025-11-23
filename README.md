# Module Filtres Rapides pour Vues Liste (is_filter_list)

Ce module améliore l'expérience utilisateur dans Odoo 18 en ajoutant une ligne de filtres rapides directement sous les en-têtes de colonnes dans les vues liste. Il permet de filtrer les données intuitivement et rapidement sans avoir à utiliser la barre de recherche avancée ("Control Panel").

## Fonctionnalités Principales

*   **Filtres en ligne** : Ajout automatique d'un champ de saisie sous chaque colonne filtrable.
*   **Persistance Automatique** : Les filtres saisis sont mémorisés par utilisateur et par vue. Ils sont automatiquement réappliqués lorsque vous revenez sur la page ou la rechargez.
*   **Support Multi-types** : Gestion intelligente des différents types de champs (Texte, Nombres, Dates, Booléens, Sélections).
*   **Gestion des Colonnes Optionnelles** : Si une colonne est masquée par l'utilisateur, le filtre associé est automatiquement désactivé pour ne pas fausser les résultats.
*   **Sécurité** : Les champs non "recherchables" (ex: champs calculés non stockés) sont détectés et n'affichent pas de champ de saisie pour éviter les erreurs techniques.

## Guide d'Utilisation

### 1. Filtrage de Texte (Char, Text, Many2one)
*   Saisissez simplement une partie du texte recherché.
*   Le filtre effectue une recherche de type "contient" (ilike), insensible à la casse.

### 2. Filtrage de Sélections
*   Saisissez une partie du libellé de l'option désirée.
*   Le système filtrera sur les valeurs dont le libellé correspond.

### 3. Filtrage Numérique (Entier, Décimal, Monétaire)
Vous pouvez utiliser des opérateurs de comparaison mathématique.
*   `100` : Valeur égale à 100.
*   `>100` : Strictement supérieur à 100.
*   `>=100` : Supérieur ou égal à 100.
*   `<100` : Strictement inférieur à 100.
*   `<=100` : Inférieur ou égal à 100.
*   La virgule `,` est acceptée comme séparateur décimal (ex: `>10,5`).

### 4. Filtrage de Dates et Heures
Le module supporte une syntaxe riche pour les dates, avec gestion automatique des plages horaires et des fuseaux horaires.
*   **Année** : `2025` (Filtre sur toute l'année 2025).
*   **Mois** : `2025-01` (Filtre sur Janvier 2025).
*   **Semaine** : `2025-S01` (Filtre sur la semaine n°1 de 2025).
*   **Jour** : `2025-01-31` ou `31/01/2025`.
*   **Opérateurs** : Vous pouvez combiner ces formats avec des opérateurs.
    *   `>2025` : Dates après 2025.
    *   `<=2025-03` : Dates avant ou pendant Mars 2025.

### 5. Filtrage Booléen
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
*   **Compatibilité** : Conçu pour Odoo 18.0.

## Installation

Installez le module comme un module Odoo standard. Une fois installé, la fonctionnalité est active par défaut sur les vues liste compatibles.
