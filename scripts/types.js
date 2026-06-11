/**
 * Shared type definitions for Automate FVTT.
 *
 * These are JSDoc typedefs only — no runtime code — establishing the core
 * vocabulary the later phases implement: a {@link Keep} owns a {@link Stockpile}
 * and is driven by {@link Rule}s (count-based or asset-based). Asset-based rules
 * are realized as {@link Asset}s placed on the scene, wired together by
 * {@link Port}s and the derived {@link AdjacencyEdge}s.
 *
 * @module types
 */

/**
 * A resource ledger: resource id → quantity on hand.
 * @typedef {Object<string, number>} Stockpile
 */

/**
 * A stronghold that owns resources and the rules that change them. One Keep per
 * scene (Phase 6); modeled as a Foundry Actor document (Phase 1).
 * @typedef {Object} Keep
 * @property {string} id                  Document id of the backing Actor.
 * @property {string} name
 * @property {?string} sceneId            Scene this Keep owns (one Keep per scene).
 * @property {Stockpile} stockpile        Resource quantities on hand.
 * @property {Object<string, number>} counts  Count-based config scalars, e.g.
 *                                            `{ henchmen: 2, garden: 3 }`.
 * @property {string[]} ruleIds           Rules bound to this Keep.
 * @property {Object<string, Object<string, number>>} buffers  Port output holds:
 *                                            bufferKey → resource → qty, for
 *                                            producers using `port` delivery.
 */

/**
 * How a {@link Rule} is sourced.
 * - `count`: driven by a scalar in {@link Keep.counts} (henchmen, garden); no map
 *   presence. Permanent — never becomes an asset.
 * - `asset`: driven by a placed {@link Asset} on the canvas; topology comes from
 *   spatial adjacency (Phases 6–7).
 * @typedef {"count"|"asset"} RuleBinding
 */

/**
 * What a rule does to the stockpile each interval.
 * @typedef {"producer"|"consumer"|"converter"|"upkeep"} RuleKind
 */

/**
 * A deterministic, world-time-driven economy rule. Evaluated against a time
 * delta by the tick dispatcher (Phase 2) and must be idempotent across large
 * jumps (compute N intervals on a one-year advance, not one).
 * @typedef {Object} Rule
 * @property {string} id
 * @property {string} keepId
 * @property {RuleBinding} binding
 * @property {RuleKind} kind
 * @property {number} intervalSeconds     Game-seconds between applications.
 * @property {Object<string, number>} inputs   Resource → amount consumed per interval.
 * @property {Object<string, number>} outputs  Resource → amount produced per interval.
 * @property {?string} countKey           For `count` binding: key into {@link Keep.counts}.
 * @property {?string} assetId            For `asset` binding: the source {@link Asset}.
 * @property {?number} assetUnits         For `asset` binding: logical unit count
 *                                            until placed assets exist (Phase 6).
 * @property {?("keep"|"port")} delivery  For `asset` binding: where output lands —
 *                                            `keep` deposits directly (adjacency
 *                                            optional), `port` holds for routing.
 *                                            Count rules always deliver to the Keep.
 */

/**
 * A placeable Factorio-style entity (drill, furnace, belt, stockpile) rendered as
 * a Tile/Token on the scene, snapped to the square grid. Movable by the GM.
 * @typedef {Object} Asset
 * @property {string} id
 * @property {string} keepId              The scene's owning Keep.
 * @property {string} placeableId         Backing Tile/Token document id.
 * @property {AssetType} assetType
 * @property {GridCoord} cell             Top-left grid cell.
 * @property {?string} recipeId           Fabricate recipe or rate this asset runs.
 * @property {Port[]} ports               Input/output ports on the asset's edges.
 */

/**
 * @typedef {"drill"|"furnace"|"belt"|"stockpile"} AssetType
 */

/**
 * A grid cell coordinate (column, row) in scene grid units.
 * @typedef {Object} GridCoord
 * @property {number} col
 * @property {number} row
 */

/**
 * One of the four square-grid edges an asset accepts from / emits to.
 * @typedef {"N"|"E"|"S"|"W"} Direction
 */

/**
 * An input or output connection point on an asset edge.
 * @typedef {Object} Port
 * @property {string} id
 * @property {"input"|"output"} flow
 * @property {Direction} side             Which edge of the asset this port is on.
 */

/**
 * A directed connection in the production graph, derived from grid adjacency +
 * port directions (Phase 7) — not hand-authored.
 * @typedef {Object} AdjacencyEdge
 * @property {string} fromAssetId
 * @property {string} fromPortId
 * @property {string} toAssetId
 * @property {string} toPortId
 */

export {}; // Mark as a module; no runtime exports.
