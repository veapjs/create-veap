/**
 * Veap-specific dependencies layered on top of the freshly generated
 * `create-next-app` project. The CNA-provided Next/React/TypeScript/Tailwind
 * versions are intentionally NOT pinned here - we take whatever the official
 * scaffolder ships, so generated apps never lag behind the framework.
 *
 * Only `@types/node` is overridden: the engine requirement is Node >= 22.
 * The linter comes from CNA (`--eslint`); no Biome, no changesets.
 */

export interface VeapDependencyManifest {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts?: Record<string, string>;
}

/**
 * Versions deliberately pinned OVER the CNA-provided ones: the engine
 * requirement is Node >= 22. Applied after the spread merge so CNA cannot
 * win these keys.
 */
export const PINNED_DEV_DEPENDENCIES: Record<string, string> = {
  "@types/node": "^22.20.2",
};

/** Full plugin-enabled project. */
export const FULL_MANIFEST: VeapDependencyManifest = {
  dependencies: {
    dotenv: "^17.2.3",
    pg: "^8.16.3",
    "@veap/core": "^0.1.0",
    "@veap/ui": "^0.1.0",
    "@veap/minimal-template": "^0.1.0",
  },
  devDependencies: {
    ...PINNED_DEV_DEPENDENCIES,
    "@types/pg": "^8.16.0",
    rimraf: "^6.1.3",
    "tw-animate-css": "^1.4.0",
  },
};
