/** @odoo-module */
import { registry } from "@web/core/registry";
import { listView } from "@web/views/list/list_view";
import { FilterListController } from "./filter_list_controller";
import { FilterListRenderer } from "./filter_list_renderer";

export const filterListView = {
    ...listView,
    Controller: FilterListController,
    Renderer: FilterListRenderer,
};

registry.category("views").add("filter_list", filterListView);
