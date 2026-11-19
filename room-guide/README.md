# Room guide

The page guests open from the QR code in their room: https://kushagra486.github.io/Sudha-Vatika-/room/

Plain HTML, CSS and JavaScript, no build step. It talks to the public `room-guest` Edge Function
(`supabase/functions/room-guest`), which saves requests and reviews for the dashboard's **Room desk**.

| File                                | What it is                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `index.html`, `style.css`, `app.js` | The page, its look and its screens (English and Hindi)                         |
| `config.js`                         | Phone numbers, website, Maps and delivery-app links                            |
| `places.js`                         | Places for Explore Prayagraj (position, kind, short text) and the one-day plan |
| `place-details.js`                  | About, what is there, best time and time to allow for each place               |
| `images.js`, `places/`              | Photos for the places, with the photographer's credit and licence              |
| `cards/`                            | Printable QR cards (made by `tools/make_room_cards.mjs`)                       |

Restaurants, WiFi, check-out time and the guest note are **not** in this folder: owners edit them in the
dashboard under Room desk, and the page reads them live.

Test locally: `cd room-guide && python3 -m http.server 8766`, then open http://127.0.0.1:8766/?room=101
(the function allows that address). Publishing is done by `.github/workflows/website.yml` when this folder
changes on `main`.
