export type ThemeMode = "light" | "dark" | "auto";

export function getInitialMode(): ThemeMode {
	if (typeof window === "undefined") {
		return "auto";
	}

	const stored = window.localStorage.getItem("theme");
	if (stored === "light" || stored === "dark" || stored === "auto") {
		return stored;
	}

	return "auto";
}

export function applyThemeMode(mode: ThemeMode) {
	const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	const resolved = mode === "auto" ? (prefersDark ? "dark" : "light") : mode;

	document.documentElement.classList.remove("light", "dark");
	document.documentElement.classList.add(resolved);

	if (mode === "auto") {
		document.documentElement.removeAttribute("data-theme");
	} else {
		document.documentElement.setAttribute("data-theme", mode);
	}

	document.documentElement.style.colorScheme = resolved;
}

export function setThemeMode(mode: ThemeMode) {
	applyThemeMode(mode);
	window.localStorage.setItem("theme", mode);
}

function isThemeMode(value: unknown): value is ThemeMode {
	return value === "light" || value === "dark" || value === "auto";
}

/**
 * Given the theme stored in Clerk metadata and the current local mode, return
 * the mode to apply, or null if nothing should change. Pure — no DOM/storage.
 */
export function reconcileTheme(
	clerkTheme: unknown,
	localTheme: ThemeMode,
): ThemeMode | null {
	if (!isThemeMode(clerkTheme)) {
		return null;
	}
	return clerkTheme === localTheme ? null : clerkTheme;
}
