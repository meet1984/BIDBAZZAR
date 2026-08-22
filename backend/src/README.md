# Backend source

`app.ts` builds the Express application without listening. `server.ts` verifies MySQL, starts the standalone HTTP server, schedules maintenance and handles shutdown. Feature modules isolate routes, controllers, services and repositories; shared transport policy belongs in middleware.
