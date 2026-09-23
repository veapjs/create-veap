# create-veap

## 0.1.4

### Patch Changes

- Add package manager flags to create-next-app and fallback to npx on runner network failure

## 0.1.3

### Patch Changes

- Add `better-sqlite3` to scaffolded project dependencies:
  - Include `better-sqlite3: "latest"` in `FULL_MANIFEST` dependencies so generated applications have the native SQLite driver installed out-of-the-box.

## 0.1.2

### Patch Changes

- Add dedicated bin executable wrapper and update CLI binary entry point:
  - Add `bin/veap.js` executable wrapper to execute compiled CLI from dist.
  - Update `package.json` bin mapping to reference `./bin/veap.js`.

## 0.1.1

### Patch Changes

- Update default scaffold dependencies and template configuration:
  - Use `latest` for `@veap/framework` and `@veap/ui` dependencies instead of workspace protocols.
  - Remove pre-installed `@veap/minimal-template` dependency, starting generated projects with clean `.withTemplates([])`.
  - Update test expectations for scaffolded package.json dependencies.

## 0.1.0

### Minor Changes

- First releases of `create-veap` project scaffolder with the minimal templates.
