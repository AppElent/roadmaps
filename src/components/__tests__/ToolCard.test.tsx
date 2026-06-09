// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { Map as MapIcon } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToolCard } from "../ToolCard";

describe("ToolCard", () => {
	afterEach(cleanup);

	it("renders title and description", () => {
		render(
			<ToolCard
				title="Roadmaps"
				description="Plan initiatives across lanes and timeframes."
				icon={MapIcon}
				status="active"
				onOpen={() => {}}
			/>,
		);
		expect(screen.getByText("Roadmaps")).toBeDefined();
		expect(
			screen.getByText("Plan initiatives across lanes and timeframes."),
		).toBeDefined();
	});

	it("calls onOpen when an active card is clicked", () => {
		const onOpen = vi.fn();
		render(
			<ToolCard
				title="Roadmaps"
				description="desc"
				icon={MapIcon}
				status="active"
				onOpen={onOpen}
			/>,
		);
		screen.getByRole("button", { name: /Roadmaps/i }).click();
		expect(onOpen).toHaveBeenCalledOnce();
	});

	it("shows a Soon badge and is not clickable when status is soon", () => {
		const onOpen = vi.fn();
		render(
			<ToolCard
				title="Diagrams"
				description="desc"
				icon={MapIcon}
				status="soon"
				onOpen={onOpen}
			/>,
		);
		expect(screen.getByText(/soon/i)).toBeDefined();
		expect(screen.queryByRole("button")).toBeNull();
	});
});
