import { expect, test, vi } from "vitest";
import { buildKrokiUrl, encodeKrokiSource, renderKroki } from "../kroki";

async function decode(encoded: string): Promise<string> {
	const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
	const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
	const stream = new Blob([bytes])
		.stream()
		.pipeThrough(new DecompressionStream("deflate"));
	return await new Response(stream).text();
}

test("encodeKrokiSource round-trips through deflate + base64url", async () => {
	const source = "@startuml\nAlice -> Bob: Hello\n@enduml";
	expect(await decode(await encodeKrokiSource(source))).toBe(source);
});

test("encoded output is URL-safe", async () => {
	const encoded = await encodeKrokiSource("flowchart TD\n A-->B & C?");
	expect(encoded).toMatch(/^[A-Za-z0-9\-_=]+$/);
});

test("buildKrokiUrl targets the kroki.io SVG endpoint", async () => {
	const url = await buildKrokiUrl("plantuml", "@startuml\n@enduml");
	expect(url).toMatch(/^https:\/\/kroki\.io\/plantuml\/svg\/[A-Za-z0-9\-_=]+$/);
});

test("renderKroki surfaces the Kroki error body on failure", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response("Syntax error in line 2", { status: 400 })),
	);
	try {
		await expect(renderKroki("plantuml", "bad input")).rejects.toThrow(
			"Syntax error in line 2",
		);
	} finally {
		vi.unstubAllGlobals();
	}
});
