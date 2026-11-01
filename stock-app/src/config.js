// Where the server lives.
//
//  - On your computer (npm run dev): the server runs on port 3001 of the same machine.
//  - When hosted: set VITE_API_URL in Vercel to your server's address,
//    for example https://sanrio-exchange.onrender.com   (no slash at the end)
const fromEnv = import.meta.env.VITE_API_URL;

export const API = fromEnv
  ? fromEnv.replace(/\/$/, "")
  : `http://${window.location.hostname}:3001`;
