/** @odoo-module */
import { ListController } from "@web/views/list/list_controller";
import { useState, onWillStart, onWillRender, onMounted } from "@odoo/owl";
import { session } from "@web/session";
import { useService } from "@web/core/utils/hooks";
import { browser } from "@web/core/browser/browser";

export class FilterListController extends ListController {
    static template = "is_filter_list.FilterListView";

    setup() {
        super.setup();
        this.orm = useService("orm");
        this.filterState = useState({
            filters: {},
        });
        this.initialReloadNeeded = false;

        // Patch immediately if possible
        if (this.model && this.model.root) {
             this.patchLoad();
        }

        onWillStart(async () => {
            await this.loadSavedFilters();
        });

        // Ensure load is patched (in case root is recreated)
        onWillRender(() => {
            if (this.model && this.model.root && !this.model.root.load.isPatched) {
                this.patchLoad();
            }
        });

        onMounted(() => {
            if (this.initialReloadNeeded) {
                this.applyFilters();
                this.initialReloadNeeded = false;
            }
        });
    }

    async loadSavedFilters() {
        try {
            const viewId = this.env.config.viewId;
            const resModel = this.props.resModel;
            if (!viewId || !resModel) return;

            const savedFilters = await this.orm.call(
                "is.filter.list.mem.var",
                "get_filter_values",
                [viewId, resModel]
            );
            
            if (savedFilters && Object.keys(savedFilters).length > 0) {
                Object.assign(this.filterState.filters, savedFilters);
                
                // Apply filters immediately if model is ready
                if (this.model && this.model.root) {
                    if (!this.model.root.load.isPatched) {
                        this.patchLoad();
                    }
                    // Trigger reload to apply the loaded filters
                    await this.model.root.load();
                } else {
                    this.initialReloadNeeded = true;
                }
            }
        } catch (e) {
            console.error("FilterListController: Error loading saved filters", e);
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
            console.error("FilterListController: Error saving filter", e);
        }
    }

    patchLoad() {
        const originalLoad = this.model.root.load.bind(this.model.root);
        this.model.root.load = async (params = {}) => {
             const searchDomain = this.env.searchModel.domain;
             const filterDomain = this.getFilterListDomain();
             
             // Update the config domain
             // We need to ensure we don't lose the search domain
             const combinedDomain = [...searchDomain, ...filterDomain];
             console.log("FilterListController: combinedDomain", combinedDomain);
             
             this.model.root.config.domain = combinedDomain;
             
             // Also try to pass it in params to be sure
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
                 this.patchLoad();
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
            if (!fieldDef) continue;

            if (fieldDef.type === 'selection' && fieldDef.selection) {
                // Filter on labels instead of keys for selection fields
                const matchingKeys = fieldDef.selection
                    .filter(([key, label]) => label.toLowerCase().includes(value.toLowerCase()))
                    .map(([key, label]) => key);
                
                if (matchingKeys.length > 0) {
                    domain.push([fieldName, 'in', matchingKeys]);
                } else {
                    // No match found, force empty result
                    domain.push([fieldName, 'in', []]); 
                }
            } else if (['date', 'datetime'].includes(fieldDef.type)) {
                const dateDomain = this.getDateDomain(fieldName, value, fieldDef.type);
                if (dateDomain) {
                    domain.push(...dateDomain);
                }
            } else if (['integer', 'float', 'monetary'].includes(fieldDef.type)) {
                const numDomain = this.getNumericDomain(fieldName, value);
                if (numDomain) {
                    domain.push(...numDomain);
                }
            } else if (fieldDef.type === 'boolean') {
                const boolDomain = this.getBooleanDomain(fieldName, value);
                if (boolDomain) {
                    domain.push(...boolDomain);
                }
            } else {
                domain.push([fieldName, 'ilike', value]);
            }
        }
        return domain;
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
                console.warn(`FilterListController: Invalid date format for field ${fieldName}: ${value}`);
                this.env.services.notification.add(`Champ "${fieldLabel}" : Format de date invalide "${value}"`, {
                    type: "danger",
                });
            }
        } catch (error) {
            const fieldLabel = this.props.fields[fieldName]?.string || fieldName;
            console.error("FilterListController: Error parsing date", error);
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
