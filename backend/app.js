// cPanel Phusion Passenger Application Startup File
// Express app instance is exported without invoking http.Server.listen() to prevent port binding collisions (EADDRINUSE).
import { app } from "./dist/app.js";

export default app;
