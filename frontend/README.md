# Frontend

This workspace preserves the supplied BidMyLot React/Vite design and connects it to the backend. `src/main.jsx` starts React, `App.jsx` resolves routes, `routes.js` defines URL matching, and `index.css` contains the existing design system. Data flows from pages through `src/lib/api.js`; authentication state is shared through `src/auth`. Page-level modules are loaded lazily except for the landing page. Add page-local code to its feature folder and reusable UI to `components`.
