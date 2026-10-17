[![CI](https://github.com/veapjs/create-veap/actions/workflows/ci.yml/badge.svg)](https://github.com/veapjs/create-veap/actions/workflows/ci.yml)
[![Release](https://github.com/veapjs/create-veap/actions/workflows/release.yml/badge.svg)](https://github.com/veapjs/create-veap/actions/workflows/release.yml)
[![Version](https://img.shields.io/npm/v/create-veap?style=flat-square&color=181717&logo=npm&logoColor=959da5)](https://www.npmjs.com/package/create-veap)
[![Discord](https://img.shields.io/badge/Discord-join-5865F2?style=flat-square&logo=discord&logoColor=959da5)](https://discord.gg/qTkrCwpMW)


# create-veap

The official project initializer for [Veap Framework](https://veap.pl) applications. It scaffolds a new Next.js and Veap application from built-in or remote templates.

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

When you omit the project name in an interactive terminal, `create-veap` prompts for a project name.

## Command options

All flags are optional.

| Flag            | Description                                                                 |
| --------------- | --------------------------------------------------------------------------- |
| `--name <name>` | Provide the project name up front, skipping the interactive prompt.       |
| `--template <name>` | Select a template by name (for example `01-basic`) instead of choosing interactively. |
| `--example <url>` | Use a GitHub repository as the source for scaffolding instead of a built-in template. |
| `--choose`      | Force interactive template selection even when a template or example is available. |
| `--skip-install` | Do not run the package manager install step after scaffolding.              |
| `--help` (`-h`) | Show the usage message.                                                     |

### Automatic package manager detection

`create-veap` automatically detects the package manager from the execution command (`bun create`, `pnpm create`, `npm create`, `yarn create`, `bunx`, or `npx`) and environment variables without prompting.

## What it scaffolds

The `01-basic` template is a starting Next.js 16 App Router project with React Server Components, TypeScript, Tailwind CSS v4, the Geist font source, and an ESLint configuration.

It also scaffolds:

- `lib/veap.ts` with an `Application` composer and `NextTransportServiceProvider` (cookies, headers, and redirects via `next/headers` and `next/navigation`).
- `instrumentation.ts` with a `register()` function that runs only in the `nodejs` runtime (the initialization code contains a commented-out `ensureVeap` call).
- `.env` with placeholder environment variables.
- `AGENTS.md` with instructions for the assistant.
- `README.md` with project startup instructions.
- A base `.gitignore`.

## Documentation

For full documentation and guides, visit:
- [https://veap.pl/docs](https://veap.pl/docs)
- [Installation Guide](https://veap.pl/docs/getting-started/installation)
- [Scaffolding Guide](https://veap.pl/docs/guides/create-veap)
- [CLI Reference](https://veap.pl/docs/reference/packages/create-veap)

## License

MIT
