# waterways

An interactive globe of the world's **one continuous body of water** — no land,
only the waterways that connect: the World Ocean wash, every major river that
drains into it, the lakes threaded through the network, and the canals that
stitch basins together by hand.

Rendered as a *paper atlas inverted*: water is drawn, land is left as blank
paper. Isolated basins (Caspian is the great exception) are simply absent.

![style reference](https://img.shields.io/badge/style-paper%20atlas%20inverted-f4eedd)

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # production bundle in dist/
npm run preview
```

## Reading the map

| Mark | Meaning |
| --- | --- |
| Blue wash | World Ocean — one connected body (≈363M km²) |
| Solid ink lines | Rivers with natural drainage to the ocean |
| Dashed sepia | Canal-linked waters & navigable routes |
| Pale pool, sepia outline | The Caspian Sea — no natural outlet, rejoins the network via the Volga–Don Canal |
| Blank paper | Land — deliberately nothing |

**Controls** — drag to turn, scroll/pinch to zoom, click any water feature for
its name, kind, measured length (geodesic, km) or area (spherical, km²), and
where it drains. Toggles: Rivers · Lakes · Routes · Grid · Drift.

**URL params** — `?fast` for a low-detail mode on weak GPUs,
`?cam=lon,lat,dist` to open on a view (e.g. `?cam=50,44,235` for the Caspian).

## How "connected" is decided

Data is Natural Earth 50m hydrography, bundled locally in `public/data/`
(land, ocean, rivers & lake centerlines, lakes).

- **Ocean** — Natural Earth's world-ocean polygon minus the Caspian ring,
  which NE folds into "ocean" but which has no natural outlet.
- **Rivers** — excluded when they drain to closed basins: Syr Darya, Amu
  Darya, Helmand, Tarim, Yarkant, Jordan, Chari/Logone, Okavango–Cubango,
  Konqi, Desaguadero, and the Gharraf/Ismailya irrigation canals.
  Volga, Ural and Kura are kept but styled *canal-linked* (dashed) because
  the Volga–Don Canal reconnects the Caspian basin to the world ocean.
- **Lakes** — excluded by name when endorheic (Great Salt, Turkana, Chad,
  Issyk-Kul, Uvs, Qinghai, Titicaca, Balkhash, Van, Sevan, …). Baikal,
  Victoria, Tanganyika, the Great Lakes etc. remain — each drains seaward.
- **Routes** — Suez & Panama come from the data; Kiel, Corinth, Volga–Don,
  Erie, Welland and the White Sea–Baltic Canal are hand-authored polylines
  in `src/data/routes.js`.

## Honest limitations

- Connectivity is curated from known hydrology, not computed from a
  drainage-topology graph. A few obscure closed-basin tributaries may slip
  through; 91 unnamed small waters in the source are omitted.
- River lengths are sums of Natural Earth's traced mainstem segments, so a
  "Nile" reads shorter than the encyclopedic figure.
- Fills are triangulated on the sphere (earcut + longest-edge subdivision,
  ≤3° edges by default) — true great-circle hugging, not a flat projection.

## Stack

Vite · three.js (fat lines via `LineSegments2`, earcut triangulation) · no
frameworks, no API keys, works offline.
