# Nexus Core Platform

## Setup

Install dependencies:

```bash
npm install --no-package-lock
```

Create a local environment file:

```bash
cp .env.example .env
```

Fill in the Supabase and Lovable AI Gateway values in `.env`.

Run the development server:

```bash
npm run dev
```

Run verification:

```bash
npx tsc --noEmit
npm run lint
npm run build
```
