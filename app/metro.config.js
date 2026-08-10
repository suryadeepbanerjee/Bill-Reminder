const path = require("path");

// SDK 54 moves Metro's server root to the monorepo root (for web support), which
// makes RN gradle's `expo export:embed --entry-file index.ts` resolve the entry
// relative to the repo root: "Unable to resolve ./index.ts from <repo root>/.".
// Keep the server root on the app so relative entries resolve against app/.
process.env.EXPO_NO_METRO_WORKSPACE_ROOT = "1";

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// Monorepo: watch the shared package and hoisted node_modules so Fast Refresh picks up changes.
config.watchFolders = [
  path.join(workspaceRoot, "packages"),
  path.join(workspaceRoot, "node_modules"),
];

// Keep module resolution inside the app first, then the workspace root.
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, "node_modules"),
  path.join(workspaceRoot, "node_modules"),
];

// Resolve the @shared/* alias (mirrors tsconfig "paths" for Metro).
const sharedRoot = path.join(workspaceRoot, "packages", "shared");
const defaultResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@shared/")) {
    const target = path.join(sharedRoot, moduleName.slice("@shared/".length));
    return context.resolveRequest(context, target, platform);
  }
  return defaultResolver
    ? defaultResolver(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
