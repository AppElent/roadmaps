/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_CLERK_PUBLISHABLE_KEY: string;
	readonly VITE_CONVEX_URL: string;
	/** Dev-only test-login credentials; present only on non-prod (test) builds. */
	readonly VITE_TEST_USER_EMAIL?: string;
	readonly VITE_TEST_USER_PASSWORD?: string;
}
