// What each endpoint of the catalog's three API groups does, as the objects the app hands to
// `handlers.handleAll(...)`. The group's Layer is built in the app, against the assembled `Api`: its prefix and its
// middleware make the group's type the app's own. Each builder resolves the ports once, when the group is built.
export { assistantEndpoints } from "@inventory/catalog-model/AssistantHandler"
export { importsEndpoints } from "@inventory/catalog-model/ImportsHandler"
export { itemsEndpoints } from "@inventory/catalog-model/ItemsHandler"
