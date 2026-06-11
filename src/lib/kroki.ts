export const KROKI_BASE_URL = "https://kroki.io";

/** Deflate + base64url, the encoding Kroki expects in GET URLs. */
export async function encodeKrokiSource(source: string): Promise<string> {
	const stream = new Blob([source])
		.stream()
		.pipeThrough(new CompressionStream("deflate"));
	const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_");
}

export async function buildKrokiUrl(
	krokiType: string,
	source: string,
): Promise<string> {
	return `${KROKI_BASE_URL}/${krokiType}/svg/${await encodeKrokiSource(source)}`;
}

/**
 * Fetches the rendered SVG and returns an object URL for use as an <img> src.
 * Kroki returns its parse errors as a 4xx text body; surface that as the
 * Error message. Callers own revoking the returned object URL.
 */
export async function renderKroki(
	krokiType: string,
	source: string,
	signal?: AbortSignal,
): Promise<string> {
	const res = await fetch(await buildKrokiUrl(krokiType, source), { signal });
	if (!res.ok) {
		const message = (await res.text()).trim();
		throw new Error(message || `Kroki request failed (${res.status})`);
	}
	return URL.createObjectURL(await res.blob());
}
