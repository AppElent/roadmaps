// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { afterEach, describe, expect, it } from "vitest";
import { DiagramControls } from "../diagrams/DiagramControls";

function Harness() {
	const ref = useRef<HTMLDivElement | null>(null);
	return (
		<TransformWrapper>
			<DiagramControls contentRef={ref} />
			<TransformComponent>
				<div ref={ref}>content</div>
			</TransformComponent>
		</TransformWrapper>
	);
}

describe("DiagramControls", () => {
	afterEach(cleanup);

	it("renders the zoom controls with a live percentage", () => {
		render(<Harness />);
		expect(screen.getByLabelText("Zoom in")).toBeDefined();
		expect(screen.getByLabelText("Zoom out")).toBeDefined();
		expect(screen.getByLabelText("Fit to view")).toBeDefined();
		expect(screen.getByLabelText("Reset zoom")).toBeDefined();
		expect(screen.getByText("100%")).toBeDefined();
	});

	it("handles control clicks without throwing", () => {
		render(<Harness />);
		expect(() => {
			fireEvent.click(screen.getByLabelText("Zoom in"));
			fireEvent.click(screen.getByLabelText("Zoom out"));
			fireEvent.click(screen.getByLabelText("Fit to view"));
			fireEvent.click(screen.getByLabelText("Reset zoom"));
		}).not.toThrow();
	});
});
