## Vite 构建问题：构建之后丢失源码

### 问题描述

通过 `yarn create vite` 创建项目时默认 Vite，构建产物里会丢失源码；如果创建项目时选择使用 `rolldown-vite`，则一切正常。

|                              | Default Vite | Rolldown Vite |
| ---------------------------- | ------------ | ------------- |
| `yarn dev`                   | ✅           | ✅            |
| `yarn build && yarn preview` | ❌           | ✅            |

### 目录结构

这个仓库包含两个源码完全一样的项目，除了它们的 `package.json` 不一样。

- **`using-default-vite/`** - 使用默认 vite
- **`using-rolldown-vite/`** - 使用 rolldown-vite

### 复现步骤

1. 克隆仓库

2. 默认 vite 构建并预览：

   ```bash
   cd using-default-vite
   yarn install
   yarn build && yarn preview
   ```

3. rolldown-vite 构建并预览:

   ```bash
   cd using-rolldown-vite
   yarn install
   yarn build && yarn preview
   ```

4. 比较构建输出:

   - 在浏览器的 Source 面板检查生成的文件，搜索 `createUniforms` 关键字

   ![](./diff-built.jpeg)
