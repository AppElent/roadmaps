import { diagramSeeder } from "./diagrams";
import { roadmapSeeder } from "./roadmaps";
import type { Seeder } from "./types";

/** All seedable object types. Add a new module here to extend the demo seed. */
export const SEEDERS: Seeder[] = [roadmapSeeder, diagramSeeder];
