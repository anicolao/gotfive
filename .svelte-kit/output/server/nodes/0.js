

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/fallbacks/layout.svelte.js')).default;
export const imports = ["_app/immutable/nodes/0.BoIndZ-q.js","_app/immutable/chunks/Cu3uDmNK.js","_app/immutable/chunks/DEDqjojZ.js"];
export const stylesheets = [];
export const fonts = [];
