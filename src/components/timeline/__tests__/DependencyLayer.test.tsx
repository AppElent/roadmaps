// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import type { ItemRect } from "@/lib/dependencies";
import { DependencyLayer } from "../DependencyLayer";

test("renders one path per resolvable dependency", () => {
	const rects = new Map<string, ItemRect>([
		["a", { left: 0, width: 100, top: 0, height: 36 }],
		["b", { left: 200, width: 80, top: 50, height: 36 }],
	]);
	const { container } = render(
		<DependencyLayer
			deps={[
				{ _id: "d1", predecessorId: "a", successorId: "b" },
				{ _id: "d2", predecessorId: "a", successorId: "missing" },
			]}
			rects={rects}
			width={400}
			height={200}
		/>,
	);
	expect(container.querySelectorAll("path[data-dep]")).toHaveLength(1);
});

test("renders a delete affordance only when onRemove is provided", () => {
	const rects = new Map<string, ItemRect>([
		["a", { left: 0, width: 100, top: 0, height: 36 }],
		["b", { left: 200, width: 80, top: 0, height: 36 }],
	]);
	const deps = [{ _id: "d1", predecessorId: "a", successorId: "b" }];
	const readOnly = render(
		<DependencyLayer deps={deps} rects={rects} width={400} height={200} />,
	);
	expect(readOnly.container.querySelectorAll("[data-dep-delete]")).toHaveLength(
		0,
	);
	const editable = render(
		<DependencyLayer
			deps={deps}
			rects={rects}
			width={400}
			height={200}
			onRemove={() => {}}
		/>,
	);
	expect(editable.container.querySelectorAll("[data-dep-delete]")).toHaveLength(
		1,
	);
});
