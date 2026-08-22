# Backend

This workspace is the Express/TypeScript modular monolith. `src/app.ts` composes middleware and routes; `src/server.ts` owns standalone startup, database verification, maintenance timers and graceful shutdown. Each feature follows route → controller → service → repository → MySQL. Passenger loads `app.js` without binding a port.
