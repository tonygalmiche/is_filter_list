/** @odoo-module */
import { ListRenderer } from "@web/views/list/list_renderer";

export class FilterListRenderer extends ListRenderer {
    static template = "is_filter_list.FilterListRenderer";
    static props = [...ListRenderer.props, "onFilterChange", "filters"];

    setup() {
        super.setup();
    }

    onInputChange(fieldName, ev) {
        const value = ev.target.value;
        this.props.onFilterChange(fieldName, value);
    }

    getTooltip(field) {
        const orAndHelp = "\n\nOpérateurs logiques :\n" +
                          "- val1, val2 ou val1 OU val2 : OU\n" +
                          "- val1 ET val2 : ET";
        
        if (['integer', 'float', 'monetary'].includes(field.type)) {
            return "Formats supportés :\n" +
                   "- xxx : Valeur exacte\n" +
                   "- >xxx : Supérieur à\n" +
                   "- >=xxx : Supérieur ou égal à\n" +
                   "- <xxx : Inférieur à\n" +
                   "- <=xxx : Inférieur ou égal à" + orAndHelp;
        }
        if (field.type === 'date') {
            return "Formats supportés (avec opérateurs >, >=, <, <=) :\n" +
                   "- AAAA : Année (ex: 2023)\n" +
                   "- AAAA-Sww : Semaine (ex: 2023-S01)\n" +
                   "- AAAA-MM : Mois (ex: 2023-01)\n" +
                   "- AAAA-MM-JJ ou JJ/MM/AAAA : Jour exact" + orAndHelp;
        }
        if (field.type === 'datetime') {
            return "Formats supportés (avec opérateurs >, >=, <, <=) :\n" +
                   "- AAAA : Année (ex: 2023)\n" +
                   "- AAAA-Sww : Semaine (ex: 2023-S01)\n" +
                   "- AAAA-MM : Mois (ex: 2023-01)\n" +
                   "- AAAA-MM-JJ ou JJ/MM/AAAA : Jour exact\n" +
                   "- Avec Heure : AAAA-MM-JJ HH:MM (ex: 2023-01-01 14:30)\n" +
                   "  (HH, HH:MM, HH:MM:SS supportés)" + orAndHelp;
        }
        if (field.type === 'boolean') {
            return "Formats supportés :\n" +
                   "- 1 : Vrai / Oui\n" +
                   "- 0 : Faux / Non\n" +
                   "- (vide) : Tous";
        }
        return "Opérateurs logiques :\n" +
               "- val1, val2 ou val1 OU val2 : OU\n" +
               "- val1 ET val2 : ET";
    }

    async toggleOptionalField(fieldName) {
        // Vérifier si le champ va être masqué (il est actuellement actif)
        const wasActive = this.optionalActiveFields[fieldName];
        
        await super.toggleOptionalField(fieldName);
        
        // Si le champ était actif et qu'il y avait un filtre, l'effacer
        if (wasActive && this.props.filters[fieldName]) {
            this.props.onFilterChange(fieldName, '');
        }
        
        this.props.list.model.load();
    }

    toggleOptionalFieldGroup(groupId) {
        // Récupérer les champs du groupe qui vont être masqués
        const fieldNames = this.allColumns
            .filter(
                (col) =>
                    col.type === "field" &&
                    col.relatedPropertyField &&
                    col.relatedPropertyField.id === groupId
            )
            .map((col) => col.name);
        
        // Vérifier si le groupe va être masqué (tous les champs sont actuellement actifs)
        const willBeHidden = fieldNames.every((fieldName) => this.optionalActiveFields[fieldName]);
        
        super.toggleOptionalFieldGroup(groupId);
        
        // Si le groupe est masqué, effacer les filtres des champs concernés
        if (willBeHidden) {
            for (const fieldName of fieldNames) {
                if (this.props.filters[fieldName]) {
                    this.props.onFilterChange(fieldName, '');
                }
            }
        }
        
        this.props.list.model.load();
    }
}
