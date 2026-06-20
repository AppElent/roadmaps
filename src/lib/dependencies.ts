export interface Edge {
	predecessorId: string;
	successorId: string;
}

/**
 * True if adding `predecessorId -> successorId` would create a directed cycle,
 * i.e. the successor can already reach the predecessor (or it's a self-link).
 */
export function wouldCreateCycle(
	edges: Edge[],
	predecessorId: string,
	successorId: string,
): boolean {
	return canReach(edges, successorId, predecessorId);
}

/** Depth-first reachability from `start` to `target` (true when start === target). */
function canReach(edges: Edge[], start: string, target: string): boolean {
	const adjacency = new Map<string, string[]>();
	for (const e of edges) {
		const list = adjacency.get(e.predecessorId);
		if (list) list.push(e.successorId);
		else adjacency.set(e.predecessorId, [e.successorId]);
	}
	const seen = new Set<string>();
	const stack = [start];
	while (stack.length) {
		const node = stack.pop() as string;
		if (node === target) return true;
		if (seen.has(node)) continue;
		seen.add(node);
		for (const next of adjacency.get(node) ?? []) stack.push(next);
	}
	return false;
}

export interface ItemRect {
	left: number;
	width: number;
	top: number;
	height: number;
}

export interface DependencyArrow {
	id: string;
	path: string;
	/** Midpoint of the leading stub — anchor for the delete affordance. */
	labelX: number;
	labelY: number;
}

const STUB = 12;

/**
 * SVG elbow connectors from each predecessor's right-center to its successor's
 * left-center. Edges with an endpoint missing from `rects` are skipped (e.g. an
 * item filtered out of the current view).
 */
export function dependencyArrows(
	deps: Array<{ _id: string; predecessorId: string; successorId: string }>,
	rects: Map<string, ItemRect>,
): DependencyArrow[] {
	const arrows: DependencyArrow[] = [];
	for (const dep of deps) {
		const from = rects.get(dep.predecessorId);
		const to = rects.get(dep.successorId);
		if (!from || !to) continue;
		const sx = from.left + from.width;
		const sy = from.top + from.height / 2;
		const ex = to.left;
		const ey = to.top + to.height / 2;
		const stubX = sx + STUB;
		arrows.push({
			id: dep._id,
			path: `M ${sx} ${sy} L ${stubX} ${sy} L ${stubX} ${ey} L ${ex} ${ey}`,
			labelX: stubX,
			labelY: (sy + ey) / 2,
		});
	}
	return arrows;
}
