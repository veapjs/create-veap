# create-veap

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
