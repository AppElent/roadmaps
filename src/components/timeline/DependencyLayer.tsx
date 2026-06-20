import { dependencyArrows, type ItemRect } from "@/lib/dependencies";

export function DependencyLayer({
	deps,
	rects,
	width,
	height,
	onRemove,
}: {
	deps: Array<{ _id: string; predecessorId: string; successorId: string }>;
	rects: Map<string, ItemRect>;
	width: number;
	height: number;
	onRemove?: (dependencyId: string) => void;
}) {
	const arrows = dependencyArrows(deps, rects);
	return (
		<svg
			className="pointer-events-none absolute left-0 top-0"
			width={width}
			height={height}
			aria-hidden="true"
		>
			<defs>
				<marker
					id="dep-arrow"
					markerWidth="8"
					markerHeight="8"
					refX="6"
					refY="3"
					orient="auto"
					markerUnits="userSpaceOnUse"
				>
					<path d="M0,0 L6,3 L0,6 Z" fill="var(--rm-dep, #6b7280)" />
				</marker>
			</defs>
			{arrows.map((arrow) => (
				<g key={arrow.id} className="group/dep">
					<path
						data-dep
						d={arrow.path}
						fill="none"
						stroke="var(--rm-dep, #6b7280)"
						strokeWidth={1.5}
						markerEnd="url(#dep-arrow)"
					/>
					{onRemove ? (
						// biome-ignore lint/a11y/useSemanticElements: an SVG <g> can't be a <button>; using role="button" with keyboard handlers instead
						<g
							data-dep-delete
							role="button"
							tabIndex={0}
							aria-label="Remove dependency"
							className="pointer-events-auto cursor-pointer opacity-0 transition-opacity hover:opacity-100 group-hover/dep:opacity-100"
							onClick={() => onRemove(arrow.id)}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									onRemove(arrow.id);
								}
							}}
						>
							<circle
								cx={arrow.labelX}
								cy={arrow.labelY}
								r={7}
								fill="white"
								stroke="var(--rm-dep, #6b7280)"
							/>
							<path
								d={`M ${arrow.labelX - 3} ${arrow.labelY - 3} L ${arrow.labelX + 3} ${arrow.labelY + 3} M ${arrow.labelX + 3} ${arrow.labelY - 3} L ${arrow.labelX - 3} ${arrow.labelY + 3}`}
								stroke="var(--rm-dep, #6b7280)"
								strokeWidth={1.2}
							/>
						</g>
					) : null}
				</g>
			))}
		</svg>
	);
}
