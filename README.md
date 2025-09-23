# Devcontainer (Codespaces) Setup

This repository previously had no `.devcontainer/`. The minimal config here uses a stable base image
and avoids Docker-in-Docker/compose to prevent `spawn docker ENOENT` during Codespaces creation.

## How to use
1. Commit this folder to the repository.
2. In Codespaces, run “Rebuild Container” → “Rebuild without cache”.

If you later need additional tools, add them via `features` in `devcontainer.json` or inside `postCreate.sh`.
