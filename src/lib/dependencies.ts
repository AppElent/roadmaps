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
