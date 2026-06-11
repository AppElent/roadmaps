/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as fields from "../fields.js";
import type * as io from "../io.js";
import type * as items from "../items.js";
import type * as lanes from "../lanes.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_bundle from "../lib/bundle.js";
import type * as lib_defaults from "../lib/defaults.js";
import type * as lib_snapshot from "../lib/snapshot.js";
import type * as milestones from "../milestones.js";
import type * as roadmapVersions from "../roadmapVersions.js";
import type * as roadmaps from "../roadmaps.js";
import type * as seed from "../seed.js";
import type * as sharing from "../sharing.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  fields: typeof fields;
  io: typeof io;
  items: typeof items;
  lanes: typeof lanes;
  "lib/auth": typeof lib_auth;
  "lib/bundle": typeof lib_bundle;
  "lib/defaults": typeof lib_defaults;
  "lib/snapshot": typeof lib_snapshot;
  milestones: typeof milestones;
  roadmapVersions: typeof roadmapVersions;
  roadmaps: typeof roadmaps;
  seed: typeof seed;
  sharing: typeof sharing;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
