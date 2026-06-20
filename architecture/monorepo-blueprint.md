# Monorepo Blueprint — AlharisTech Platform

## Overview

This document defines the complete monorepo structure for the AlharisTech platform, managed with **Turborepo** and **pnpm workspaces**. Every directory, key file, and dependency is specified to ensure consistent, reproducible builds across all applications and shared packages.

---

## Monorepo Philosophy

| Principle | Implementation |
|:---|:---|
| **Single Source of Truth** | Shared types, config, and utilities live in `packages/` |
| **Incremental Builds** | Turborepo caches build artifacts per package |
| **Parallel Execution** | Independent packages build simultaneously |
| **Domain Isolation** | Business logic organized in `domains/` using DDD |
| **App Agnosticism** | Shared packages never import from `apps/` |
| **Strict Boundaries** | Import rules enforced via ESLint and Turborepo `dependsOn` |

---

## Root Configuration

### Root `package.json`

```json
{
  "name": "alharistech",
  "private": true,
  "packageManager": "pnpm@9.15.4",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "scripts": {
    "dev": "turbo dev --parallel",
    "dev:web": "turbo dev --filter=@alharistech/web",
    "dev:admin": "turbo dev --filter=@alharistech/admin",
    "dev:api": "turbo dev --filter=@alharistech/api",
    "build": "turbo build",
    "build:web": "turbo build --filter=@alharistech/web...",
    "build:api": "turbo build --filter=@alharistech/api...",
    "lint": "turbo lint",
    "lint:fix": "turbo lint:fix",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md,css}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md,css}\"",
    "test": "turbo test",
    "test:watch": "turbo test:watch",
    "typecheck": "turbo typecheck",
    "clean": "turbo clean && rm -rf node_modules .turbo",
    "db:migrate:dev": "turbo db:migrate:dev --filter=@alharistech/database",
    "db:migrate:prod": "turbo db:migrate:prod --filter=@alharistech/database",
    "db:seed": "turbo db:seed --filter=@alharistech/database",
    "db:reset": "turbo db:reset --filter=@alharistech/database",
    "db:studio": "turbo db:studio --filter=@alharistech/database",
    "sdk:generate": "turbo sdk:generate --filter=@alharistech/sdk",
    "storybook": "turbo storybook --filter=@alharistech/ui",
    "prepare": "husky install",
    "changeset": "changeset",
    "version": "changeset version",
    "release": "turbo build && changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.1",
    "@types/node": "^20.14.0",
    "husky": "^9.0.11",
    "lint-staged": "^15.2.0",
    "prettier": "^3.3.0",
    "turbo": "^2.0.0",
    "typescript": "^5.5.0"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "prettier --write",
      "eslint --fix"
    ],
    "*.{json,md,css,yaml,yml}": [
      "prettier --write"
    ]
  }
}
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "domains/*"
  - "tools/*"

catalog:
  typescript: ^5.5.0
  next: ^15.0.0
  react: ^19.0.0
  react-dom: ^19.0.0
  "@nestjs/common": ^10.4.0
  "@nestjs/core": ^10.4.0
  "@prisma/client": ^5.15.0
  prisma: ^5.15.0
  zod: ^3.23.0
  "@tanstack/react-query": ^5.40.0
  tailwindcss: ^3.4.0
  vitest: ^1.6.0
  eslint: ^8.57.0
```

### `turbo.json` — Full Pipeline Configuration

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    "tsconfig.json"
  ],
  "globalEnv": [
    "NODE_ENV",
    "DATABASE_URL",
    "REDIS_URL",
    "JWT_SECRET",
    "NEXT_PUBLIC_API_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "S3_ENDPOINT",
    "S3_ACCESS_KEY",
    "S3_SECRET_KEY",
    "S3_BUCKET",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS"
  ],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsconfig.json", "package.json"],
      "outputs": [".next/**", "dist/**", "build/**", ".expo/**", "!.next/cache/**"],
      "cache": true
    },
    "dev": {
      "dependsOn": ["^build"],
      "persistent": true,
      "cache": false
    },
    "lint": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "eslint.config.*", ".eslintrc.*"],
      "cache": true
    },
    "lint:fix": {
      "dependsOn": ["^build"],
      "cache": false
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "test/**", "vitest.config.*", "jest.config.*"],
      "outputs": ["coverage/**"],
      "cache": true
    },
    "test:watch": {
      "persistent": true,
      "cache": false
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsconfig.json"],
      "cache": true
    },
    "clean": {
      "cache": false
    },
    "db:migrate:dev": {
      "cache": false
    },
    "db:migrate:prod": {
      "cache": false
    },
    "db:seed": {
      "cache": false
    },
    "db:reset": {
      "cache": false
    },
    "db:studio": {
      "persistent": true,
      "cache": false
    },
    "sdk:generate": {
      "dependsOn": ["^build"],
      "cache": false
    },
    "storybook": {
      "persistent": true,
      "cache": false
    },
    "generate": {
      "cache": false
    },
    "deploy": {
      "dependsOn": ["build", "test", "lint"],
      "cache": false
    }
  }
}
```

---

## Root Configuration Files

### `tsconfig.json` (Root)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": false
  },
  "exclude": ["node_modules", "dist", ".next", "build"]
}
```

### `.eslintrc.js` (Root)

```js
module.exports = {
  root: true,
  extends: ["@alharistech/eslint-config/base"],
  settings: {
    "import/resolver": {
      typescript: {
        project: ["tsconfig.json", "apps/*/tsconfig.json", "packages/*/tsconfig.json"],
      },
    },
  },
};
```

### `biome.json`

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  }
}
```

---

## Apps — Complete Package Definitions

### `apps/web` — Public Website (Next.js)

```json
{
  "name": "@alharistech/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "analyze": "ANALYZE=true next build",
    "clean": "rm -rf .next"
  },
  "dependencies": {
    "@alharistech/ui": "workspace:*",
    "@alharistech/auth": "workspace:*",
    "@alharistech/sdk": "workspace:*",
    "@alharistech/types": "workspace:*",
    "@alharistech/utils": "workspace:*",
    "@alharistech/logger": "workspace:*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-query": "^5.40.0",
    "@tanstack/react-query-next-experimental": "^5.40.0",
    "next-intl": "^3.15.0",
    "zod": "^3.23.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0",
    "lucide-react": "^0.378.0",
    "next-themes": "^0.3.0",
    "date-fns": "^3.6.0",
    "sonner": "^1.4.0"
  },
  "devDependencies": {
    "@alharistech/config": "workspace:*",
    "@types/node": "^20.14.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "typescript": "^5.5.0"
  }
}
```

### `apps/admin` — Admin Dashboard (Next.js)

```json
{
  "name": "@alharistech/admin",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf .next"
  },
  "dependencies": {
    "@alharistech/ui": "workspace:*",
    "@alharistech/auth": "workspace:*",
    "@alharistech/sdk": "workspace:*",
    "@alharistech/types": "workspace:*",
    "@alharistech/utils": "workspace:*",
    "@alharistech/logger": "workspace:*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-query": "^5.40.0",
    "@tanstack/react-table": "^8.17.0",
    "@tanstack/react-query-next-experimental": "^5.40.0",
    "zod": "^3.23.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0",
    "lucide-react": "^0.378.0",
    "next-themes": "^0.3.0",
    "date-fns": "^3.6.0",
    "sonner": "^1.4.0",
    "recharts": "^2.12.0",
    "react-hook-form": "^7.51.0",
    "@hookform/resolvers": "^3.4.0",
    "next-intl": "^3.15.0"
  },
  "devDependencies": {
    "@alharistech/config": "workspace:*",
    "@types/node": "^20.14.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "typescript": "^5.5.0"
  }
}
```

### `apps/api` — API Gateway (NestJS)

```json
{
  "name": "@alharistech/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "vitest run --config vitest.config.e2e.ts",
    "test:cov": "vitest run --coverage",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@alharistech/auth": "workspace:*",
    "@alharistech/database": "workspace:*",
    "@alharistech/types": "workspace:*",
    "@alharistech/utils": "workspace:*",
    "@alharistech/logger": "workspace:*",
    "@alharistech/config": "workspace:*",
    "@nestjs/common": "^10.4.0",
    "@nestjs/core": "^10.4.0",
    "@nestjs/platform-express": "^10.4.0",
    "@nestjs/swagger": "^7.3.0",
    "@nestjs/graphql": "^12.1.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/throttler": "^5.2.0",
    "@nestjs/cache-manager": "^2.2.0",
    "@nestjs/event-emitter": "^2.0.0",
    "@nestjs/bullmq": "^10.1.0",
    "@apollo/server": "^4.10.0",
    "graphql": "^16.8.0",
    "@prisma/client": "^5.15.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "zod": "^3.23.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "swagger-ui-express": "^5.0.0",
    "cache-manager": "^5.5.0",
    "cache-manager-redis-yet": "^5.0.0",
    "bullmq": "^5.7.0",
    "ioredis": "^5.4.0",
    "bcryptjs": "^2.4.3",
    "uuid": "^9.0.1",
    "date-fns": "^3.6.0",
    "helmet": "^7.1.0",
    "cookie-parser": "^1.4.6",
    "compression": "^1.7.4",
    "express": "^4.19.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@alharistech/config": "workspace:*",
    "@nestjs/cli": "^10.4.0",
    "@nestjs/schematics": "^10.1.0",
    "@nestjs/testing": "^10.4.0",
    "@types/express": "^4.17.21",
    "@types/node": "^20.14.0",
    "@types/bcryptjs": "^2.4.6",
    "@types/uuid": "^9.0.8",
    "@types/passport-jwt": "^4.0.1",
    "@types/cookie-parser": "^1.4.7",
    "@types/compression": "^1.7.5",
    "typescript": "^5.5.0",
    "vitest": "^1.6.0",
    "@vitest/coverage-v8": "^1.6.0",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2",
    "prisma": "^5.15.0",
    "tsx": "^4.11.0"
  }
}
```

### `apps/desktop` — Desktop App (Tauri + React)

```json
{
  "name": "@alharistech/desktop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist src-tauri/target"
  },
  "dependencies": {
    "@alharistech/ui": "workspace:*",
    "@alharistech/sdk": "workspace:*",
    "@alharistech/types": "workspace:*",
    "@alharistech/utils": "workspace:*",
    "@alharistech/logger": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tauri-apps/api": "^2.0.0",
    "zod": "^3.23.0",
    "@tanstack/react-query": "^5.40.0"
  },
  "devDependencies": {
    "@alharistech/config": "workspace:*",
    "@tauri-apps/cli": "^2.0.0",
    "typescript": "^5.5.0",
    "vite": "^5.3.0",
    "@vitejs/plugin-react": "^4.3.0"
  }
}
```

### `apps/mobile` — Mobile App (React Native / Expo)

```json
{
  "name": "@alharistech/mobile",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "expo start",
    "build:ios": "expo build:ios",
    "build:android": "expo build:android",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf .expo dist"
  },
  "dependencies": {
    "@alharistech/ui": "workspace:*",
    "@alharistech/sdk": "workspace:*",
    "@alharistech/types": "workspace:*",
    "@alharistech/utils": "workspace:*",
    "@alharistech/logger": "workspace:*",
    "react": "^19.0.0",
    "react-native": "^0.74.0",
    "expo": "^51.0.0",
    "zod": "^3.23.0",
    "@tanstack/react-query": "^5.40.0",
    "react-native-safe-area-context": "^4.10.0",
    "react-native-screens": "^3.31.0",
    "@react-navigation/native": "^6.1.0",
    "@react-navigation/native-stack": "^6.9.0",
    "expo-secure-store": "^13.0.0",
    "expo-localization": "^15.0.0"
  },
  "devDependencies": {
    "@alharistech/config": "workspace:*",
    "@types/react": "^19.0.0",
    "typescript": "^5.5.0"
  }
}
```

---

## Packages — Complete Shared Packages

### `packages/ui` — Shared UI Components

```json
{
  "name": "@alharistech/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./components/*": "./src/components/*.tsx",
    "./layouts/*": "./src/layouts/*.tsx",
    "./forms/*": "./src/forms/*.tsx",
    "./hooks/*": "./src/hooks/*.ts"
  },
  "scripts": {
    "build": "tsc",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "storybook": "storybook dev -p 6006",
    "storybook:build": "storybook build",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@alharistech/types": "workspace:*",
    "@alharistech/utils": "workspace:*",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-toast": "^1.1.5",
    "@radix-ui/react-tooltip": "^1.0.7",
    "@radix-ui/react-popover": "^1.0.7",
    "@radix-ui/react-avatar": "^1.0.4",
    "@radix-ui/react-checkbox": "^1.0.4",
    "@radix-ui/react-switch": "^1.0.3",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-slot": "^1.0.2",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0",
    "lucide-react": "^0.378.0",
    "class-variance-authority": "^0.7.0",
    "react-hook-form": "^7.51.0",
    "@hookform/resolvers": "^3.4.0",
    "zod": "^3.23.0"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwindcss": "^3.4.0"
  },
  "devDependencies": {
    "@alharistech/config": "workspace:*",
    "@storybook/react": "^8.1.0",
    "@storybook/addon-essentials": "^8.1.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "vitest": "^1.6.0",
    "@testing-library/react": "^15.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "typescript": "^5.5.0",
    "tailwindcss": "^3.4.0"
  }
}
```

### `packages/auth` — Shared Authentication Logic

```json
{
  "name": "@alharistech/auth",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./client": "./src/client.ts",
    "./server": "./src/server.ts",
    "./middleware": "./src/middleware.ts",
    "./types": "./src/types.ts"
  },
  "scripts": {
    "build": "tsc",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@alharistech/types": "workspace:*",
    "@alharistech/utils": "workspace:*",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@alharistech/config": "workspace:*",
    "typescript": "^5.5.0",
    "vitest": "^1.6.0"
  }
}
```

### `packages/database` — Database Layer

```json
{
  "name": "@alharistech/database",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./client": "./src/client.ts",
    "./schema": "./src/schema/index.ts"
  },
  "scripts": {
    "build": "tsc",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "db:migrate:dev": "prisma migrate dev",
    "db:migrate:prod": "prisma migrate deploy",
    "db:seed": "tsx src/seeds/index.ts",
    "db:reset": "prisma migrate reset --force",
    "db:studio": "prisma studio",
    "db:generate": "prisma generate",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@prisma/client": "^5.15.0",
    "@alharistech/types": "workspace:*",
    "@alharistech/utils": "workspace:*"
  },
  "devDependencies": {
    "@alharistech/config": "workspace:*",
    "prisma": "^5.15.0",
    "typescript": "^5.5.0",
    "tsx": "^4.11.0"
  }
}
```

### `packages/sdk` — JavaScript SDK

```json
{
  "name": "@alharistech/sdk",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./client": "./src/client.ts",
    "./endpoints/*": "./src/endpoints/*.ts"
  },
  "scripts": {
    "build": "tsc",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "sdk:generate": "tsx scripts/generate.ts",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@alharistech/types": "workspace:*",
    "@alharistech/utils": "workspace:*",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@alharistech/config": "workspace:*",
    "typescript": "^5.5.0",
    "vitest": "^1.6.0",
    "tsx": "^4.11.0"
  }
}
```

### `packages/config` — Shared Configuration

```json
{
  "name": "@alharistech/config",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./eslint/base": "./eslint/base.js",
    "./eslint/next": "./eslint/next.js",
    "./eslint/nest": "./eslint/nest.js",
    "./eslint/react": "./eslint/react.js",
    "./typescript/base": "./typescript/base.json",
    "./typescript/next": "./typescript/next.json",
    "./typescript/nest": "./typescript/nest.json",
    "./typescript/react": "./typescript/react.json",
    "./tailwind/base": "./tailwind/base.ts",
    "./vitest/base": "./vitest/base.ts"
  },
  "scripts": {},
  "devDependencies": {
    "typescript": "^5.5.0"
  },
  "peerDependencies": {
    "typescript": "^5.5.0",
    "eslint": "^8.57.0",
    "tailwindcss": "^3.4.0"
  }
}
```

### `packages/logger` — Structured Logging

```json
{
  "name": "@alharistech/logger",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./transports/*": "./src/transports/*.ts"
  },
  "scripts": {
    "build": "tsc",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@alharistech/types": "workspace:*",
    "winston": "^3.13.0",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "@alharistech/config": "workspace:*",
    "@types/winston": "^2.4.4",
    "typescript": "^5.5.0",
    "vitest": "^1.6.0"
  }
}
```

### `packages/types` — Shared TypeScript Types

```json
{
  "name": "@alharistech/types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./user": "./src/user.ts",
    "./customer": "./src/customer.ts",
    "./order": "./src/order.ts",
    "./product": "./src/product.ts",
    "./service": "./src/service.ts",
    "./ticket": "./src/ticket.ts",
    "./api": "./src/api.ts",
    "./auth": "./src/auth.ts",
    "./common": "./src/common.ts"
  },
  "scripts": {
    "build": "tsc",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@alharistech/config": "workspace:*",
    "typescript": "^5.5.0"
  }
}
```

### `packages/utils` — Shared Utilities

```json
{
  "name": "@alharistech/utils",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./date": "./src/date.ts",
    "./string": "./src/string.ts",
    "./validation": "./src/validation.ts",
    "./formatting": "./src/formatting.ts",
    "./cn": "./src/cn.ts",
    "./result": "./src/result.ts",
    "./pagination": "./src/pagination.ts"
  },
  "scripts": {
    "build": "tsc",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@alharistech/types": "workspace:*",
    "date-fns": "^3.6.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "@alharistech/config": "workspace:*",
    "typescript": "^5.5.0",
    "vitest": "^1.6.0"
  }
}
```

---

## Domain Structure — DDD within Monorepo

Each domain lives in `domains/` and follows Hexagonal Architecture (Ports & Adapters):

```
domains/identity/
├── application/
│   ├── commands/
│   │   ├── register-user.command.ts
│   │   ├── login.command.ts
│   │   └── refresh-token.command.ts
│   ├── queries/
│   │   ├── get-user-by-id.query.ts
│   │   └── search-users.query.ts
│   ├── handlers/
│   │   ├── register-user.handler.ts
│   │   └── login.handler.ts
│   └── services/
│       └── authentication.service.ts
├── domain/
│   ├── entities/
│   │   ├── user.entity.ts
│   │   └── session.entity.ts
│   ├── value-objects/
│   │   ├── email.vo.ts
│   │   ├── password.vo.ts
│   │   └── phone-number.vo.ts
│   ├── repositories/
│   │   ├── user.repository.ts          ← Port (interface)
│   │   └── session.repository.ts       ← Port (interface)
│   └── events/
│       ├── user-registered.event.ts
│       └── user-logged-in.event.ts
├── infrastructure/
│   ├── persistence/
│   │   ├── user.repository.impl.ts     ← Adapter (Prisma)
│   │   └── session.repository.impl.ts  ← Adapter (Redis)
│   ├── messaging/
│   │   └── auth-event.publisher.ts
│   └── external/
│       └── sms-provider.adapter.ts
├── presentation/
│   ├── controllers/
│   │   └── auth.controller.ts
│   ├── resolvers/
│   │   └── auth.resolver.ts
│   └── dtos/
│       ├── register-user.dto.ts
│       └── login.dto.ts
├── index.ts                            ← Barrel export
├── package.json
└── tsconfig.json
```

Each domain has its own `package.json`:

```json
{
  "name": "@alharistech/domain-identity",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./index.ts",
  "types": "./index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  },
  "dependencies": {
    "@alharistech/database": "workspace:*",
    "@alharistech/types": "workspace:*",
    "@alharistech/utils": "workspace:*",
    "@alharistech/logger": "workspace:*",
    "@alharistech/auth": "workspace:*",
    "zod": "^3.23.0",
    "@prisma/client": "^5.15.0"
  },
  "devDependencies": {
    "@alharistech/config": "workspace:*",
    "typescript": "^5.5.0",
    "vitest": "^1.6.0"
  }
}
```

### All Domains

| Domain | Package Name | Business Concern |
|:---|:---|:---|
| `domains/identity/` | `@alharistech/domain-identity` | Authentication, users, roles, sessions |
| `domains/customer/` | `@alharistech/domain-customer` | CRM, customer profiles, companies |
| `domains/service/` | `@alharistech/domain-service` | Services catalog, categories |
| `domains/commerce/` | `@alharistech/domain-commerce` | Orders, invoices, payments |
| `domains/support/` | `@alharistech/domain-support` | Tickets, help desk |
| `domains/content/` | `@alharistech/domain-content` | CMS, pages, blog, media |
| `domains/notification/` | `@alharistech/domain-notification` | Email, SMS, push, in-app |
| `domains/analytics/` | `@alharistech/domain-analytics` | Reports, dashboards, metrics |
| `domains/ai/` | `@alharistech/domain-ai` | AI agents, prompts, embeddings |

---

## Build Order & Dependency Graph

Turborepo resolves build order automatically via `dependsOn: ["^build"]`. The topological build order is:

```
Phase 1 (No dependencies):
  @alharistech/config
  @alharistech/types

Phase 2 (Depends on Phase 1):
  @alharistech/utils         → depends on @alharistech/types
  @alharistech/logger        → depends on @alharistech/types

Phase 3 (Depends on Phase 2):
  @alharistech/auth          → depends on types, utils
  @alharistech/database      → depends on types, utils
  @alharistech/ui            → depends on types, utils
  @alharistech/sdk           → depends on types, utils

Phase 4 (Domain packages):
  @alharistech/domain-*      → depends on database, types, utils, auth, logger

Phase 5 (Apps):
  @alharistech/web           → depends on ui, auth, sdk, types, utils, logger
  @alharistech/admin         → depends on ui, auth, sdk, types, utils, logger
  @alharistech/api           → depends on auth, database, types, utils, logger, config
  @alharistech/desktop       → depends on ui, sdk, types, utils, logger
  @alharistech/mobile        → depends on ui, sdk, types, utils, logger
```

---

## Import Boundary Rules

Enforced via ESLint `import/no-restricted-paths`:

```js
// .eslintrc.js (root)
rules: {
  'import/no-restricted-paths': ['error', {
    zones: [
      // apps/ CANNOT import from other apps/
      { target: './apps/*', from: './apps/*',
        except: ['./apps/*/package.json'], message: 'Apps cannot import from other apps' },
      // packages/ CANNOT import from apps/
      { target: './packages/*', from: './apps/*',
        message: 'Shared packages cannot import from apps' },
      // packages/types CANNOT import from any package except config
      { target: './packages/types', from: './packages/*',
        except: ['./packages/config'], message: 'types package must be dependency-free' },
      // packages/config CANNOT import from any package
      { target: './packages/config', from: './packages/*',
        message: 'config package must have zero internal dependencies' },
    ],
  }],
}
```

---

## Directory Structure Quick Reference

```
Alharistech/
├── .github/workflows/        CI/CD pipeline definitions
├── apps/
│   ├── web/                  @alharistech/web — Public website (Next.js)
│   ├── admin/                @alharistech/admin — Admin dashboard (Next.js)
│   ├── api/                  @alharistech/api — API Gateway (NestJS)
│   ├── desktop/              @alharistech/desktop — Desktop app (Tauri)
│   └── mobile/               @alharistech/mobile — Mobile app (React Native)
├── packages/
│   ├── ui/                   @alharistech/ui — Shared UI components (shadcn/ui)
│   ├── auth/                 @alharistech/auth — Authentication logic
│   ├── database/             @alharistech/database — Database (Prisma)
│   ├── sdk/                  @alharistech/sdk — JavaScript SDK
│   ├── config/               @alharistech/config — ESLint, TS, Tailwind configs
│   ├── logger/               @alharistech/logger — Structured logging
│   ├── types/                @alharistech/types — Shared TypeScript types
│   └── utils/                @alharistech/utils — Utility functions
├── domains/                  9 domain modules (DDD)
├── infrastructure/
│   ├── k8s/                  Kubernetes manifests
│   └── terraform/            Infrastructure as Code
├── docs/                     All documentation
├── specs/                    Detailed specifications per domain
├── tasks/                    Implementation plans per phase
├── scripts/                  Helper scripts
├── tools/                    Internal tooling
├── turbo.json                Turborepo configuration
├── package.json              Root workspace
├── pnpm-workspace.yaml       Workspace definition
├── tsconfig.json             Root TypeScript
├── biome.json                Linter + Formatter
└── CHANGELOG.md              Release history
```
