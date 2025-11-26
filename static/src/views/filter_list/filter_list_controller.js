/** @odoo-module */
import { ListController } from "@web/views/list/list_controller";
import { useState, onWillRender } from "@odoo/owl";
import { session } from "@web/session";
import { useService } from "@web/core/utils/hooks";
import { browser } from "@web/core/browser/browser";

export class FilterListController extends ListController {
    static template = "is_filter_list.FilterListView";

    setup() {
        // Initialiser les services et l'état AVANT d'appeler super.setup()
        this.orm = useService("orm");
        this.filterState = useState({
            filters: {},
        });
        this._filtersLoaded = false;
        this._savedFiltersPromise = null;
        this._initialLoadDone = false;

        // Lancer le chargement des filtres sauvegardés immédiatement (avant super.setup)
        // Cela démarre la requête async le plus tôt possible
        this._savedFiltersPromise = this._loadSavedFiltersAsync();

        // Maintenant appeler super.setup() qui va déclencher useModelWithSampleData
        super.setup();

        // Patcher la méthode load du model IMMÉDIATEMENT après super.setup()
        // pour intercepter le premier chargement et y injecter les filtres
        this._patchModelLoad();

        // Patch du load de root pour les rechargements suivants (après le premier)
        onWillRender(() => {
            if (this.model && this.model.root && !this.model.root.load.isPatched) {
                this.patchRootLoad();
            }
        });
    }

    /**
     * Patch la méthode model.load() pour intercepter le premier chargement
     * et y ajouter les filtres sauvegardés
     */
    _patchModelLoad() {
        const originalLoad = this.model.load.bind(this.model);
        const controller = this;

        this.model.load = async (searchParams = {}) => {
            // Pour le premier chargement, attendre que les filtres soient chargés
            if (!controller._initialLoadDone) {
                await controller._savedFiltersPromise;
                
                // Ajouter le domaine des filtres aux searchParams
                const filterDomain = controller.getFilterListDomain();
                if (filterDomain.length > 0) {
                    const currentDomain = searchParams.domain || [];
                    searchParams = {
                        ...searchParams,
                        domain: [...currentDomain, ...filterDomain]
                    };
                }
                
                controller._initialLoadDone = true;
            }
            
            return originalLoad(searchParams);
        };
    }

    /**
     * Charge les filtres sauvegardés de manière asynchrone
     */
    async _loadSavedFiltersAsync() {
        try {
            const viewId = this.env.config.viewId;
            const resModel = this.props.resModel;
            
            if (!viewId || !resModel) {
                this._filtersLoaded = true;
                return;
            }

            const savedFilters = await this.orm.call(
                "is.filter.list.mem.var",
                "get_filter_values",
                [viewId, resModel]
            );
            
            if (savedFilters && Object.keys(savedFilters).length > 0) {
                Object.assign(this.filterState.filters, savedFilters);
            }
            
            this._filtersLoaded = true;
        } catch (e) {
            this._filtersLoaded = true;
        }
    }

    async saveFilter(fieldName, value) {
        try {
            const viewId = this.env.config.viewId;
            const resModel = this.props.resModel;
            if (!viewId || !resModel) return;

            await this.orm.call(
                "is.filter.list.mem.var",
                "set_filter_value",
                [viewId, resModel, fieldName, value]
            );
        } catch (e) {
            // Erreur silencieuse lors de la sauvegarde du filtre
        }
    }

    /**
     * Patch la méthode load de model.root pour les rechargements 
     * déclenchés par l'utilisateur (changement de filtre, pagination, etc.)
     */
    patchRootLoad() {
        const originalLoad = this.model.root.load.bind(this.model.root);
        const controller = this;
        
        this.model.root.load = async (params = {}) => {
            const searchDomain = controller.env.searchModel.domain;
            const filterDomain = controller.getFilterListDomain();
             
            // Combiner le domaine de recherche avec le domaine des filtres
            const combinedDomain = [...searchDomain, ...filterDomain];
             
            controller.model.root.config.domain = combinedDomain;
             
            // Passer le domaine combiné dans les params
            const newParams = { ...params, domain: combinedDomain };
             
            return originalLoad(newParams);
        };
        this.model.root.load.isPatched = true;
    }

    onFilterChange(fieldName, value) {
        if (value) {
            this.filterState.filters[fieldName] = value;
        } else {
            delete this.filterState.filters[fieldName];
        }
        this.saveFilter(fieldName, value);
        this.applyFilters();
    }

    applyFilters() {
        if (this.model.root) {
            if (!this.model.root.load.isPatched) {
                this.patchRootLoad();
            }
            this.model.root.load();
        }
    }

    getFilterListDomain() {
        const domain = [];
        const fields = this.props.fields;
        
        // Get hidden fields from LocalStorage to exclude them
        const hiddenFields = this.getHiddenFields();

        for (const [fieldName, value] of Object.entries(this.filterState.filters)) {
            // Skip if field is hidden
            if (hiddenFields.includes(fieldName)) {
                continue;
            }

            const fieldDef = fields[fieldName];
            if (!fieldDef) continue;

            // Parse OR/AND operators in the value
            const fieldDomain = this.parseFilterExpression(fieldName, value, fieldDef);
            if (fieldDomain && fieldDomain.length > 0) {
                domain.push(...fieldDomain);
            }
        }
        return domain;
    }

    /**
     * Parse une expression de filtre avec support des opérateurs OU et ET
     * Syntaxe: 
     *   - "valeur1, valeur2" ou "valeur1 OU valeur2" => OU
     *   - "valeur1 ET valeur2" => ET
     * Le ET est prioritaire sur le OU (évalué en premier)
     */
    parseFilterExpression(fieldName, value, fieldDef) {
        // Séparer par OU (virgule ou " OU ")
        // Attention: ne pas splitter les virgules dans les nombres (ex: 1,5)
        const orParts = this.splitByOr(value);
        
        if (orParts.length > 1) {
            // Construire un domaine avec des OU
            const orDomains = [];
            for (const part of orParts) {
                const partDomain = this.parseAndExpression(fieldName, part.trim(), fieldDef);
                if (partDomain && partDomain.length > 0) {
                    orDomains.push(partDomain);
                }
            }
            
            if (orDomains.length === 0) return null;
            if (orDomains.length === 1) return orDomains[0];
            
            // Construire le domaine OR avec la syntaxe Odoo: ['|', cond1, cond2]
            return this.buildOrDomain(orDomains);
        }
        
        // Pas de OU, vérifier le ET
        return this.parseAndExpression(fieldName, value, fieldDef);
    }

    /**
     * Sépare une chaîne par les opérateurs OU (virgule ou " OU ")
     * en tenant compte des nombres avec virgule
     */
    splitByOr(value) {
        // D'abord séparer par " OU " (insensible à la casse)
        let parts = value.split(/\s+OU\s+/i);
        
        if (parts.length > 1) {
            return parts;
        }
        
        // Sinon, séparer par virgule, mais pas si c'est un nombre décimal
        // Regex: virgule suivie d'un espace ou en fin, ou précédée d'un espace
        // Mais pas virgule entre deux chiffres (nombre décimal)
        const result = [];
        let current = '';
        let i = 0;
        
        while (i < value.length) {
            if (value[i] === ',') {
                // Vérifier si c'est une virgule décimale (chiffre avant et après)
                const before = i > 0 ? value[i - 1] : '';
                const after = i < value.length - 1 ? value[i + 1] : '';
                
                if (/\d/.test(before) && /\d/.test(after)) {
                    // C'est une virgule décimale, on la garde
                    current += value[i];
                } else {
                    // C'est un séparateur OU
                    if (current.trim()) {
                        result.push(current.trim());
                    }
                    current = '';
                }
            } else {
                current += value[i];
            }
            i++;
        }
        
        if (current.trim()) {
            result.push(current.trim());
        }
        
        return result.length > 0 ? result : [value];
    }

    /**
     * Parse une expression avec opérateur ET
     */
    parseAndExpression(fieldName, value, fieldDef) {
        // Séparer par " ET " (insensible à la casse)
        const andParts = value.split(/\s+ET\s+/i);
        
        if (andParts.length > 1) {
            // Construire un domaine avec des ET (comportement par défaut d'Odoo)
            const andDomains = [];
            for (const part of andParts) {
                const partDomain = this.getSingleValueDomain(fieldName, part.trim(), fieldDef);
                if (partDomain && partDomain.length > 0) {
                    andDomains.push(...partDomain);
                }
            }
            return andDomains;
        }
        
        // Pas de ET, traiter comme valeur simple
        return this.getSingleValueDomain(fieldName, value, fieldDef);
    }

    /**
     * Construit un domaine OR à partir de plusieurs domaines
     * Odoo utilise la notation polonaise: ['|', cond1, '|', cond2, cond3] pour (cond1 OR cond2 OR cond3)
     */
    buildOrDomain(domains) {
        if (domains.length === 0) return [];
        if (domains.length === 1) return domains[0];
        
        // Aplatir les domaines simples et construire la notation polonaise
        const result = [];
        
        // Pour N conditions, on a besoin de N-1 opérateurs '|'
        for (let i = 0; i < domains.length - 1; i++) {
            result.push('|');
        }
        
        // Ajouter toutes les conditions
        for (const domain of domains) {
            // Si le domaine a plusieurs conditions (ET implicite), les wrapper avec '&'
            if (domain.length > 1) {
                // Ajouter N-1 opérateurs '&' pour N conditions
                for (let i = 0; i < domain.length - 1; i++) {
                    result.push('&');
                }
            }
            result.push(...domain);
        }
        
        return result;
    }

    /**
     * Génère le domaine pour une seule valeur (sans OU ni ET)
     */
    getSingleValueDomain(fieldName, value, fieldDef) {
        if (!value || !value.trim()) return null;
        value = value.trim();

        if (fieldDef.type === 'selection' && fieldDef.selection) {
            // Filter on labels instead of keys for selection fields
            const matchingKeys = fieldDef.selection
                .filter(([key, label]) => label.toLowerCase().includes(value.toLowerCase()))
                .map(([key, label]) => key);
            
            if (matchingKeys.length > 0) {
                return [[fieldName, 'in', matchingKeys]];
            } else {
                // No match found, force empty result
                return [[fieldName, 'in', []]]; 
            }
        } else if (['date', 'datetime'].includes(fieldDef.type)) {
            const dateDomain = this.getDateDomain(fieldName, value, fieldDef.type);
            if (dateDomain) {
                return dateDomain;
            }
        } else if (['integer', 'float', 'monetary'].includes(fieldDef.type)) {
            const numDomain = this.getNumericDomain(fieldName, value);
            if (numDomain) {
                return numDomain;
            }
        } else if (fieldDef.type === 'boolean') {
            const boolDomain = this.getBooleanDomain(fieldName, value);
            if (boolDomain) {
                return boolDomain;
            }
        } else {
            return [[fieldName, 'ilike', value]];
        }
        
        return null;
    }

    getHiddenFields() {
        if (!this.model || !this.model.root) return [];
        const list = this.model.root;

        // Reconstruct the key used by ListRenderer to store optional fields
        let keyParts = {
            fields: [...list.fieldNames],
            model: list.resModel,
            viewMode: "list",
            viewId: this.env.config.viewId,
        };

        const parts = ["model", "viewMode", "viewId", "relationalField", "subViewType"];
        const viewIdentifier = [];
        parts.forEach((partName) => {
            if (partName in keyParts) {
                viewIdentifier.push(keyParts[partName]);
            }
        });
        keyParts.fields
            .sort((left, right) => (left < right ? -1 : 1))
            .forEach((fieldName) => {
                return viewIdentifier.push(fieldName);
            });
        
        const key = `optional_fields,${viewIdentifier.join(",")}`;
        const localStorageValue = browser.localStorage.getItem(key);
        
        if (localStorageValue !== null) {
            const activeFields = localStorageValue.split(",");
            // Identify optional columns that are NOT in activeFields
            const optionalColumns = this.props.archInfo.columns.filter(col => col.optional);
            const hiddenOptionalFields = optionalColumns
                .filter(col => !activeFields.includes(col.name))
                .map(col => col.name);
                
            return hiddenOptionalFields;
        } else {
            // If no LS, use default optional="hide"
            const optionalColumns = this.props.archInfo.columns.filter(col => col.optional === "hide");
            return optionalColumns.map(col => col.name);
        }
    }

    getBooleanDomain(fieldName, value) {
        value = value.trim().toLowerCase();
        if (value === "") return null;

        if (['1', 'true', 'vrai', 'yes', 'oui'].includes(value)) {
            return [[fieldName, '=', true]];
        }
        if (['0', 'false', 'faux', 'no', 'non'].includes(value)) {
            return [[fieldName, '=', false]];
        }
        return null;
    }

    getNumericDomain(fieldName, value) {
        value = value.trim();
        if (!value) return null;

        let operator = '=';
        let numberPart = value;

        // Check for operators
        if (value.startsWith('>=')) {
            operator = '>=';
            numberPart = value.substring(2);
        } else if (value.startsWith('>')) {
            operator = '>';
            numberPart = value.substring(1);
        } else if (value.startsWith('<=')) {
            operator = '<=';
            numberPart = value.substring(2);
        } else if (value.startsWith('<')) {
            operator = '<';
            numberPart = value.substring(1);
        } else if (value.startsWith('=')) {
            operator = '=';
            numberPart = value.substring(1);
        }

        numberPart = numberPart.trim().replace(',', '.');
        const number = parseFloat(numberPart);

        if (isNaN(number)) {
             return null;
        }

        return [[fieldName, operator, number]];
    }

    getDateDomain(fieldName, value, type) {
        try {
            const { DateTime } = window.luxon;
            value = value.trim();

            let operator = null;
            let datePart = value;

            // Operators
            const operatorMatch = value.match(/^([<>]=?)(.*)$/);
            if (operatorMatch) {
                operator = operatorMatch[1];
                datePart = operatorMatch[2].trim();
            }

            // Split date and time
            const parts = datePart.split(/\s+/);
            const dateString = parts[0];
            const timeString = parts.length > 1 ? parts[1] : null;

            let start = null;
            let end = null;

            // Year (1900-2100)
            if (/^\d{4}$/.test(dateString)) {
                const year = parseInt(dateString);
                if (year >= 1900 && year <= 2100) {
                    start = DateTime.fromObject({ year }).startOf('year').toISODate();
                    end = DateTime.fromObject({ year }).endOf('year').toISODate();
                }
            }
            // Week (YYYY-Sww)
            else if (/^(\d{4})-S(\d{1,2})$/.test(dateString)) {
                const match = dateString.match(/^(\d{4})-S(\d{1,2})$/);
                const year = match[1];
                let week = match[2];
                if (week.length === 1) week = '0' + week;
                
                // Use ISO format YYYY-Www which is safer than fromObject
                const dt = DateTime.fromISO(`${year}-W${week}`);
                if (dt.isValid) {
                    start = dt.startOf('week').toISODate();
                    end = dt.endOf('week').toISODate();
                }
            }
            // Month (YYYY-MM)
            else if (/^(\d{4})-(\d{1,2})$/.test(dateString)) {
                const match = dateString.match(/^(\d{4})-(\d{1,2})$/);
                const year = parseInt(match[1]);
                const month = parseInt(match[2]);
                const dt = DateTime.fromObject({ year, month });
                if (dt.isValid) {
                    start = dt.startOf('month').toISODate();
                    end = dt.endOf('month').toISODate();
                }
            }
            // Day
            else {
                let dt = this.parseDate(dateString);
                if (dt && dt.isValid) {
                    start = dt.toISODate();
                    end = dt.toISODate();
                }
            }

            if (start && end) {
                let startTime = '00:00:00';
                let endTime = '23:59:59';

                if (timeString) {
                    const timeParts = this.parseTime(timeString);
                    if (timeParts) {
                        startTime = timeParts.start;
                        endTime = timeParts.end;
                    }
                }

                let startDateTime = start + ' ' + startTime;
                let endDateTime = end + ' ' + endTime;

                if (type === 'datetime') {
                    let userTz = 'UTC';
                    
                    // 1. Try user service
                    if (this.env.services.user && this.env.services.user.context && this.env.services.user.context.tz) {
                        userTz = this.env.services.user.context.tz;
                    } 
                    // 2. Try session
                    else if (session.user_context && session.user_context.tz) {
                        userTz = session.user_context.tz;
                    }
                    // 3. Try Luxon default zone (Odoo sets this)
                    else if (window.luxon && window.luxon.Settings.defaultZone && window.luxon.Settings.defaultZone.name) {
                        userTz = window.luxon.Settings.defaultZone.name;
                    }
                    // 4. Try browser timezone
                    else {
                         userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    }

                    const startDt = DateTime.fromFormat(startDateTime, 'yyyy-MM-dd HH:mm:ss', { zone: userTz });
                    const endDt = DateTime.fromFormat(endDateTime, 'yyyy-MM-dd HH:mm:ss', { zone: userTz });
                    
                    if (startDt.isValid) startDateTime = startDt.toUTC().toFormat('yyyy-MM-dd HH:mm:ss');
                    if (endDt.isValid) endDateTime = endDt.toUTC().toFormat('yyyy-MM-dd HH:mm:ss');
                }

                if (operator) {
                    if (type === 'datetime') {
                        // If time is specified, treat as a Point (start of the range) for operators
                        // e.g. > 10 means > 10:00:00, not > 10:59:59
                        if (timeString) {
                             if (operator === '>') return [[fieldName, '>', startDateTime]];
                             if (operator === '>=') return [[fieldName, '>=', startDateTime]];
                             if (operator === '<') return [[fieldName, '<', startDateTime]];
                             if (operator === '<=') return [[fieldName, '<=', startDateTime]];
                        } else {
                            // Date only: treat as Range
                            // e.g. > 2025 means > 2025-12-31 23:59:59
                            // For > operator, user expects "strictly after the start of the day"
                            // e.g. > 24/09/2025 should include 24/09/2025 10:00:00
                            if (operator === '>') return [[fieldName, '>', startDateTime]];
                            if (operator === '>=') return [[fieldName, '>=', startDateTime]];
                            if (operator === '<') return [[fieldName, '<', startDateTime]];
                            if (operator === '<=') return [[fieldName, '<=', endDateTime]];
                        }
                    } else {
                        if (operator === '>') return [[fieldName, '>', end]];
                        if (operator === '>=') return [[fieldName, '>=', start]];
                        if (operator === '<') return [[fieldName, '<', start]];
                        if (operator === '<=') return [[fieldName, '<=', end]];
                    }
                } else {
                    if (type === 'datetime') {
                        return [
                            [fieldName, '>=', startDateTime],
                            [fieldName, '<=', endDateTime]
                        ];
                    } else {
                        return this.getRangeDomain(fieldName, start, end, type);
                    }
                }
            } else {
                const fieldLabel = this.props.fields[fieldName]?.string || fieldName;
                this.env.services.notification.add(`Champ "${fieldLabel}" : Format de date invalide "${value}"`, {
                    type: "danger",
                });
            }
        } catch (error) {
            const fieldLabel = this.props.fields[fieldName]?.string || fieldName;
            this.env.services.notification.add(`Champ "${fieldLabel}" : Erreur lors du traitement de la date "${value}"`, {
                type: "danger",
            });
        }

        return null;
    }

    parseTime(value) {
        // HH
        if (/^\d{1,2}$/.test(value)) {
            let hh = value.padStart(2, '0');
            return { start: `${hh}:00:00`, end: `${hh}:59:59` };
        }
        // HH:MM or HH-MM
        if (/^(\d{1,2})[:\-](\d{1,2})$/.test(value)) {
            const match = value.match(/^(\d{1,2})[:\-](\d{1,2})$/);
            let hh = match[1].padStart(2, '0');
            let mm = match[2].padStart(2, '0');
            return { start: `${hh}:${mm}:00`, end: `${hh}:${mm}:59` };
        }
        // HH:MM:SS or HH-MM-SS
        if (/^(\d{1,2})[:\-](\d{1,2})[:\-](\d{1,2})$/.test(value)) {
            const match = value.match(/^(\d{1,2})[:\-](\d{1,2})[:\-](\d{1,2})$/);
            let hh = match[1].padStart(2, '0');
            let mm = match[2].padStart(2, '0');
            let ss = match[3].padStart(2, '0');
            return { start: `${hh}:${mm}:${ss}`, end: `${hh}:${mm}:${ss}` };
        }
        return null;
    }

    parseDate(value) {
        const { DateTime } = window.luxon;
        // Try ISO YYYY-MM-DD
        let dt = DateTime.fromFormat(value, 'yyyy-MM-dd');
        if (dt.isValid) return dt;
        // Try FR d/M/yyyy (handles dd/MM/yyyy too)
        dt = DateTime.fromFormat(value, 'd/M/yyyy');
        if (dt.isValid) return dt;
        return null;
    }

    getRangeDomain(fieldName, start, end, type) {
        if (type === 'datetime') {
            return [
                [fieldName, '>=', start + ' 00:00:00'],
                [fieldName, '<=', end + ' 23:59:59']
            ];
        } else {
            return [
                [fieldName, '>=', start],
                [fieldName, '<=', end]
            ];
        }
    }
}
