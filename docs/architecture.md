# Classic Architecture Notes

This repository is intentionally **lean**. It is a portfolio project, not a product organization template.

## Why `docs/` exists

`docs/` stays because it contains real project documentation and curated preview assets.

- `docs/architecture.md` explains the structure for reviewers
- `docs/screenshots/` contains README + manifest previews

If the folder only stored throwaway exports, it should not exist. In this repository it is useful, so `docs` is the correct umbrella name.

## Why `docs` is better than `preview`

`preview` is only accurate for screenshots.

This folder now contains screenshots **and** architectural documentation, so `docs` is the more correct, scalable and professional name.

## Why `css/` exists

The project has enough styling complexity to justify a dedicated stylesheet directory with meaningful subgroups:

- `base/` for reset, tokens and global foundations
- `layout/` for page-level structure
- `components/` for reusable UI pieces
- `utilities/` for helper and responsive rules

This should not be split further unless the project becomes meaningfully larger.

## Why `js/` exists

JavaScript is separated by responsibility:

- configuration
- secure randomness
- password generation
- theme management
- clipboard behaviour
- UI orchestration
- PWA registration

That makes the project easy to follow without needing a framework or build layer.

## Why there is no generated bundle in the repo

Generated bundles, minified duplicates and build-only service-worker templates were removed because they added maintenance cost without improving reviewability.

For a portfolio repository, source-of-truth files are more valuable than generated mirrors.

## Why only `vercel.json` remains

A portfolio repository should not commit deployment configuration for every possible host.

This version keeps a single committed deployment target:

- `vercel.json` for Vercel

The app still works on other static hosts because paths are relative, but extra platform-specific config files are intentionally omitted.

## Why `tests/` exists

Automated tests are real and useful here:

- unit coverage for generation logic
- project invariants
- e2e checks

If those tests were not maintained, the folder should be removed. Here it earns its place.

## Why `scripts/` exists

`scripts/` contains only maintenance tasks with real value:

- screenshot regeneration
- production URL replacement

There is no placeholder automation and no speculative tooling.
