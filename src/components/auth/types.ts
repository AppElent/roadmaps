import type React from "react";

export type SlotClassNames<Slot extends string> = Partial<Record<Slot, string>>;

export interface SocialProvider {
	id: string; // e.g. "google"
	label: string;
	strategy: `oauth_${string}`;
}

export interface AuthConfig {
	appName: string;
	logo?: React.ReactNode;
	paths: {
		signIn: string;
		signUp: string;
		forgotPassword: string;
		afterAuth: string;
		account: string;
	};
	features: { forgotPassword: boolean };
	socialProviders: SocialProvider[];
}

interface ClerkLikeError {
	errors?: { longMessage?: string; message?: string }[];
}

/** Extract a readable message from a thrown Clerk error (or any error). */
export function clerkErrorMessage(
	err: unknown,
	fallback = "Something went wrong.",
): string {
	const e = err as ClerkLikeError;
	const first = e?.errors?.[0];
	return first?.longMessage ?? first?.message ?? fallback;
}
