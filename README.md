[中文](./README-zh.md)

## Vite Build Issue: Source Code Lost After Build

### Problem Description

When building a project with the default Vite bundler, some source code appears to be missing or incorrectly processed in the production build. However, when using `rolldown-vite` as an alternative bundler, the build works correctly and all source code is preserved.

|                              | Default Vite | Rolldown Vite |
| ---------------------------- | ------------ | ------------- |
| `yarn dev`                   | ✅           | ✅            |
| `yarn build && yarn preview` | ❌           | ✅            |

### Repository Structure

This repository contains two identical projects that differ only in their `package.json`:

- **`using-default-vite/`** - Uses the default Vite bundler
- **`using-rolldown-vite/`** - Uses Rolldown-based Vite

### Reproduce Steps

1. Clone the repository

2. Build with default Vite and preview:

   ```bash
   cd using-default-vite
   yarn install
   yarn build && yarn preview
   ```

   This build result in missing source code in the output.

3. Build with rolldown-vite:

   ```bash
   cd using-rolldown-vite
   yarn install
   yarn build && yarn preview
   ```

   This build should work correctly with all source code preserved.

4. Compare the build outputs:

   - Check the generated files in devtool source panel and search `createUniforms` keyword

   ![](./diff-built.jpeg)
