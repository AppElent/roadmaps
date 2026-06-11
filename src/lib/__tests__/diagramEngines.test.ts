import { expect, test } from "vitest";
import { DIAGRAM_ENGINES, DIAGRAM_TYPES } from "../diagramEngines";

test("every diagram type has an engine with a starter and sane debounce", () => {
	expect(DIAGRAM_TYPES.length).toBeGreaterThan(0);
	for (const type of DIAGRAM_TYPES) {
		const engine = DIAGRAM_ENGINES[type];
		expect(engine.id).toBe(type);
		expect(engine.label.length).toBeGreaterThan(0);
		expect(engine.starterSource.trim().length).toBeGreaterThan(0);
		expect(engine.debounceMs).toBeGreaterThanOrEqual(100);
		expect(engine.debounceMs).toBeLessThanOrEqual(5000);
	}
});

test("kroki engines declare a kroki type", () => {
	for (const type of DIAGRAM_TYPES) {
		const engine = DIAGRAM_ENGINES[type];
		if (engine.strategy === "kroki") {
			expect(engine.krokiType).toBeTruthy();
		}
	}
});
