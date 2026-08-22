# Configuration

`env.ts` loads `.env`, validates every backend setting with Zod, and exports one typed configuration object. Add every variable here and to `.env.example`; secret values must never go to the frontend.
