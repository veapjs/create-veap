# create-veap

The official project initializer for [Veap Framework](https://veap.pl) applications. Scaffolds a full plugin-enabled Veap project on top of the official `create-next-app`.

## Quickstart

Initialize a new Veap project using your preferred package manager:

```bash
# Using Bun (recommended)
bun create veap my-app

# Using pnpm
pnpm create veap my-app

# Using npm
npm create veap my-app

# Using Yarn
yarn create veap my-app
```

Or execute directly through a package runner:

```bash
bunx create-veap my-app
# or
npx create-veap my-app
```

When you omit the project name in an interactive terminal, `create-veap` prompts for a project name and optional Docker configuration.

## Command options

| Flag             | Description                                                                  |
| ---------------- | ---------------------------------------------------------------------------- |
| `--docker`       | Generate Docker configuration (`Dockerfile`, `compose.yml`, `.dockerignore`). |
| `--no-docker`    | Skip Docker configuration without prompting.                                |
| `--skip-install` | Do not run the package manager install step.                                 |
| `--pm <manager>` | Specify package manager (`bun`, `pnpm`, `npm`, `yarn`).                      |
| `--pnpm`         | Force pnpm as package manager.                                              |
| `--bun`          | Force Bun as package manager.                                               |
| `--npm`          | Force npm as package manager.                                               |
| `--yarn`         | Force Yarn as package manager.                                              |

### Automatic package manager detection

`create-veap` automatically detects the package manager from the execution command (`bun create`, `pnpm create`, `npm create`, `yarn create`, `bunx`, or `npx`) and environment variables without prompting.

If you want to use a different package manager than the runner (for example, executing via Bun while configuring the generated project for pnpm), pass the target package manager flag:

```bash
bun create veap my-app --pnpm
```

## What it scaffolds

- Next.js 16 App Router with React Server Components, TypeScript, and Tailwind CSS v4.
- Veap overlay with virtual routing (`app/[[...catchAll]]/page.tsx` and `app/api/[...catchAll]/route.ts`).
- Service provider composition root in `lib/veap.ts`.
- Workspace configuration for plugins (`plugins/` directory).
- Default environment configuration (`.env`) with generated `ENCRYPTION_KEY` and local SQLite database.
- Agent instructions (`AGENTS.md`) and project guide (`README.md`).

## Documentation

For full documentation and guides, visit:
- [https://veap.pl/docs](https://veap.pl/docs)
- [Installation Guide](https://veap.pl/docs/getting-started/installation)
- [CLI Reference](https://veap.pl/docs/reference/cli)

## License

MIT
