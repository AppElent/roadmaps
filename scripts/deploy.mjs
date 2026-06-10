// Deploy orchestrator: deploys the Convex backend, then the Cloudflare Worker
// frontend, for one environment. Invoked via the package.json deploy scripts,
// which load the matching .env.deploy.<env> file with node --env-file=...
//
//   node --env-file=.env.deploy.prod    scripts/deploy.mjs prod
//   node --env-file=.env.deploy.dev     scripts/deploy.mjs dev
//   node --env-file=.env.deploy.preview scripts/deploy.mjs preview
//
// CONVEX_DEPLOY_KEY / VITE_CLERK_PUBLISHABLE_KEY / (optional) CLOUDFLARE_* are
// already in process.env from --env-file and are inherited by the children.
// `convex deploy --cmd` runs the frontend build with VITE_CONVEX_URL injected,
// so the bundle always matches the backend it was just deployed against.

import { spawnSync } from "node:child_process";

const target = process.argv[2];
const valid = ["prod", "dev", "preview"];
if (!valid.includes(target)) {
	console.error(`Usage: deploy.mjs <${valid.join("|")}>`);
	process.exit(1);
}

// Push Convex functions and build the frontend with the deployment's URL.
// A preview deploy key makes `convex deploy` auto-create a branch-named
// preview deployment; prod/dev keys target their fixed deployments.
const convex = [
	"convex",
	"deploy",
	"--cmd-url-env-var-name",
	"VITE_CONVEX_URL",
	"--cmd",
	"npm run build",
];

// prod → default worker; dev → archstudio-dev; preview → un-promoted version
// with an ephemeral *.workers.dev URL (does not touch prod).
const wrangler =
	target === "preview"
		? ["wrangler", "versions", "upload"]
		: target === "dev"
			? ["wrangler", "deploy", "--env", "dev"]
			: ["wrangler", "deploy"];

function run(args) {
	console.log(`\n> npx ${args.join(" ")}\n`);
	const result = spawnSync("npx", args, { stdio: "inherit", shell: true });
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

run(convex);
run(wrangler);
