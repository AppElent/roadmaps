// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { RoadmapCard } from "../RoadmapCard";

afterEach(cleanup);

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

test("full-card overlay button opens the roadmap", () => {
	const onOpen = vi.fn();
	render(
		<RoadmapCard
			name="Platform"
			itemCount={1}
			updatedLabel="today"
			onOpen={onOpen}
			onDuplicate={vi.fn()}
			onArchive={vi.fn()}
		/>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Open Platform" }));
	expect(onOpen).toHaveBeenCalledOnce();
});

test("archived card shows Unarchive instead of Duplicate/Archive", () => {
	const onUnarchive = vi.fn();
	render(
		<RoadmapCard
			name="Platform"
			itemCount={1}
			updatedLabel="today"
			archived
			onOpen={vi.fn()}
			onDuplicate={vi.fn()}
			onArchive={vi.fn()}
			onUnarchive={onUnarchive}
		/>,
	);
	expect(screen.queryByText("Duplicate")).toBeNull();
	expect(screen.queryByText("Archive")).toBeNull();
	fireEvent.click(screen.getByText("Unarchive"));
	expect(onUnarchive).toHaveBeenCalledOnce();
});
