# RESPAWN

> One life. Twenty choices. Eight billion consequences.

A pixel-art life sim built for the **AIDAMS Cohesion Day** (ESSEC × CentraleSupélec, group 7). Start as a first-year AIDAMS student, make the choices that shape a life (associations, PM's 8AM class, the exchange, your first job, your rhythm, family, money, legacy), and discover at the end **what the Earth would look like in 2100 if 8 billion people lived like you**. Every scene is narrated by Claude; every number comes from sourced data.

## Play / develop
```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
```

## How to contribute (no coding needed for content)
- All story and numbers live in [`src/content/data/`](src/content/data). Edit a JSON file, then run `npm run check-data`.
- Game design: [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md). Content rules: [`docs/CONTENT_GUIDE.md`](docs/CONTENT_GUIDE.md).
- Using Claude Code? It reads [`CLAUDE.md`](CLAUDE.md) automatically.

## Stack
Vite · React · TypeScript · Tailwind · Motion · Zustand · Zod · Claude API (Haiku 5.5 narration, Opus 5.5 finale) · Vercel.
