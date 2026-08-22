# Frontend source

`main.jsx` mounts the auth provider and app; `App.jsx` renders the page selected by `routes.js`; `index.css` provides shared styles. Feature folders own pages, `components` owns reusable interface pieces, `auth` owns sessions/guards, `lib` owns external data clients, and `hooks` owns reusable state logic. Pages fetch only through `lib/api.js` and render loading, error, and empty states. Add each new route to both `routes.js` and `App.jsx`.
