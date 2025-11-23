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
        if (['integer', 'float', 'monetary'].includes(field.type)) {
            return "Formats supportés :\n" +
                   "- xxx : Valeur exacte\n" +
                   "- >xxx : Supérieur à\n" +
                   "- >=xxx : Supérieur ou égal à\n" +
                   "- <xxx : Inférieur à\n" +
                   "- <=xxx : Inférieur ou égal à";
        }
        if (field.type === 'date') {
            return "Formats supportés (avec opérateurs >, >=, <, <=) :\n" +
                   "- AAAA : Année (ex: 2023)\n" +
                   "- AAAA-Sww : Semaine (ex: 2023-S01)\n" +
                   "- AAAA-MM : Mois (ex: 2023-01)\n" +
                   "- AAAA-MM-JJ ou JJ/MM/AAAA : Jour exact";
        }
        if (field.type === 'datetime') {
            return "Formats supportés (avec opérateurs >, >=, <, <=) :\n" +
                   "- AAAA : Année (ex: 2023)\n" +
                   "- AAAA-Sww : Semaine (ex: 2023-S01)\n" +
                   "- AAAA-MM : Mois (ex: 2023-01)\n" +
                   "- AAAA-MM-JJ ou JJ/MM/AAAA : Jour exact\n" +
                   "- Avec Heure : AAAA-MM-JJ HH:MM (ex: 2023-01-01 14:30)\n" +
                   "  (HH, HH:MM, HH:MM:SS supportés)";
        }
        if (field.type === 'boolean') {
            return "Formats supportés :\n" +
                   "- 1 : Vrai / Oui\n" +
                   "- 0 : Faux / Non\n" +
                   "- (vide) : Tous";
        }
        return "";
    }

    async toggleOptionalField(fieldName) {
        await super.toggleOptionalField(fieldName);
        this.props.list.model.load();
    }

    toggleOptionalFieldGroup(groupId) {
        super.toggleOptionalFieldGroup(groupId);
        this.props.list.model.load();
    }
}
