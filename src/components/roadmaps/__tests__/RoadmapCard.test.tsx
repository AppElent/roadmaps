// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { RoadmapCard } from "../RoadmapCard";

test("renders the roadmap name and item count", () => {
	render(
		<RoadmapCard
			name="Platform"
			itemCount={12}
			updatedLabel="today"
			onOpen={vi.fn()}
			onDuplicate={vi.fn()}
			onArchive={vi.fn()}
		/>,
	);
	expect(screen.getByText("Platform")).toBeTruthy();
	expect(screen.getByText(/12 items/)).toBeTruthy();
});
