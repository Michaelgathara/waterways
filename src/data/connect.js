import {
  triangulatePolygon,
  polylineLLToV3,
  haversineKm,
  sphericalRingAreaKm2,
  llToV3
} from '../geo.js'
import { RADII } from '../config.js'
import { outflowFor } from './metadata.js'
import { AUTHORED_ROUTES, DATA_ROUTES } from './routes.js'

const CANAL_LINKED_RIVERS = new Set(['Volga', 'Ural', 'Kura'])

const EXCLUDED_RIVERS = new Set([
  'Syr Darya', 'Amu Darya', 'Helmand', 'Tarim', 'Yarkant',
  'Jordan', 'Chari', 'Logone', 'Ouham',
  'Okavango', 'Cubango', 'Cuito',
  'Konqi', 'Desaguadero',
  'Gharraf Canal', 'Ismailya Canal'
])

const EXCLUDED_LAKES = new Set([
  'Great Salt Lake', 'Utah Lake', 'Lake Turkana', 'Lake Chad',
  'Issyk-Kul', 'Uvs Nuur', 'Qinghai Hu', 'Salton Sea',
  'Razzaza Lake', 'Lake Tharthar', 'Lago Titicaca', 'Lago Poopó',
  'Lake Van', 'Lake Sevan', 'Lake Balkhash', 'Sasykkol', 'Alakol',
  'Tengiz', 'Karakul', 'Nam Co', 'Selincuo', 'Siling Co',
  'Ayakkum Hu', 'Aqqikkol Hu', 'Ebinur Hu', 'Ulungur Hu',
  'Bosten Hu', 'Hulun Nur', 'Buir Nur'
])

export function processData({ land, ocean, rivers, lakes }) {
  const model = { rivers: [], routes: [], lakes: [] }

  const oceanPolys = ocean.features[0].geometry.coordinates
  const worldPolys = []
  const caspianPolys = []
  for (const poly of oceanPolys) {
    if (polyContainsPoint(poly, [50.5, 42])) caspianPolys.push(poly)
    else worldPolys.push(poly)
  }

  const lod = globalThis.__WATERWAYS_LOD || {}
  const fillEdgeDeg = lod.maxEdgeDeg ?? 3

  model.worldOceanPositions = mergePositions(
    worldPolys.map(p => triangulatePolygon(p, { fillRadius: RADII.oceanFill, maxEdgeDeg: fillEdgeDeg }))
  )
  model.worldOceanAreaKm2 = worldPolys.reduce((s, p) => s + ringAreas(p), 0)

  model.caspianPositions = mergePositions(
    caspianPolys.map(p => triangulatePolygon(p, { fillRadius: RADII.caspianFill }))
  )
  model.caspianAreaKm2 = caspianPolys.reduce((s, p) => s + ringAreas(p), 0)
  model.caspianPolyLL = caspianPolys
  model.caspianOutlineSegments = buildOutlineSegments(caspianPolys)

  model.coastSegments = buildCoastSegments(land)

  const seenRouteNames = new Set()
  for (const f of rivers.features) {
    const p = f.properties
    const name = p.name
    if (!name || EXCLUDED_RIVERS.has(name)) continue

    const routeMeta = DATA_ROUTES.find(r => r.name === name)
    if (routeMeta && !seenRouteNames.has(name)) {
      seenRouteNames.add(name)
      pushLine(model.routes, {
        name,
        kindLabel: 'Navigable canal',
        coords: geomToLines(f.geometry),
        radius: RADII.route,
        dashed: true,
        category: 'route',
        meta: routeMeta
      })
      continue
    }
    if (/canal/i.test(name)) continue

    if (CANAL_LINKED_RIVERS.has(name)) {
      pushLine(model.rivers, {
        name,
        kindLabel: 'River · linked by canal',
        coords: geomToLines(f.geometry),
        radius: RADII.canalRiver,
        dashed: true,
        category: 'canal'
      })
      continue
    }

    pushLine(model.rivers, {
      name,
      kindLabel: p.featurecla === 'Lake Centerline' ? 'Channel through lake' : 'River',
      coords: geomToLines(f.geometry),
      radius: RADII.river,
      rank: p.scalerank ?? 4,
      category: 'river'
    })
  }

  for (const r of AUTHORED_ROUTES) {
    pushLine(model.routes, {
      name: r.name,
      kindLabel: 'Navigable canal',
      coords: [r.path],
      radius: RADII.route,
      dashed: true,
      category: 'route',
      meta: r
    })
  }

  let skippedUnnamed = 0
  for (const f of lakes.features) {
    const p = f.properties
    if (!p.name) { skippedUnnamed++; continue }
    if (EXCLUDED_LAKES.has(p.name)) continue

    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    const areaKm2 = polys.reduce((s, poly) => s + ringAreas(poly), 0)
    const positions = mergePositions(polys.map(poly => triangulatePolygon(poly, { fillRadius: RADII.lakeFill })))
    if (!positions.length) continue

    model.lakes.push({
      id: 'lake-' + model.lakes.length,
      name: p.name,
      featurecla: p.featurecla || 'Lake',
      polygonsLL: polys,
      outlineSegments: buildOutlineSegments(polys),
      positions,
      areaKm2,
      outflow: outflowFor(p.name)
    })
  }
  console.log(`[connect] ${skippedUnnamed} unnamed small waters omitted`)

  model.lakes.sort((a, b) => b.areaKm2 - a.areaKm2)

  const totals = new Map()
  for (const r of model.rivers) {
    const key = r.name + '|' + r.category
    totals.set(key, (totals.get(key) || 0) + r.lengthKm)
  }
  for (const r of model.rivers) r.lengthKm = totals.get(r.name + '|' + r.category)

  return model
}

function pushLine(list, opts) {
  const lines = opts.coords.filter(c => c.length > 1)
  if (!lines.length) return
  const points = lines.map(coords => ({
    v3: polylineLLToV3(coords, opts.radius),
    ll: coords
  }))
  const lengthKm = lines.reduce((s, c) => s + haversineKm(c), 0)
  list.push({
    id: `${opts.category}-${list.length}-${opts.name}`,
    name: opts.name,
    kindLabel: opts.kindLabel,
    category: opts.category || 'route',
    rank: opts.rank ?? 3,
    dashed: !!opts.dashed,
    radius: opts.radius,
    points,
    lengthKm,
    outflow: opts.meta?.joins || outflowFor(opts.name),
    year: opts.meta?.year || null
  })
}

function geomToLines(geom) {
  if (geom.type === 'LineString') return [geom.coordinates]
  return geom.coordinates
}

function polyContainsPoint(poly, pt) {
  const inRing = (ring) => {
    let ins = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if ((yi > pt[1]) !== (yj > pt[1]) &&
        pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) ins = !ins
    }
    return ins
  }
  if (!inRing(poly[0])) return false
  for (let h = 1; h < poly.length; h++) if (inRing(poly[h])) return false
  return true
}

function ringAreas(poly) {
  let total = sphericalRingAreaKm2(poly[0])
  for (let h = 1; h < poly.length; h++) total -= sphericalRingAreaKm2(poly[h])
  return Math.abs(total)
}

function mergePositions(arrays) {
  let len = 0
  for (const a of arrays) len += a.length
  const out = new Float32Array(len)
  let off = 0
  for (const a of arrays) {
    out.set(a, off)
    off += a.length
  }
  return out
}

function eachLandRing(landGeoJson, cb) {
  for (const f of landGeoJson.features) {
    const g = f.geometry
    if (!g) continue
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
    for (const poly of polys) for (const ring of poly) cb(ring)
  }
}

function buildCoastSegments(landGeoJson) {
  const segs = []
  eachLandRing(landGeoJson, ring => {
    let prev = null
    let prevLon = null
    for (const [lon, lat] of ring) {
      const v = llToV3(lon, lat, RADII.coast)
      if (prev && Math.abs(lon - prevLon) < 180) {
        segs.push(prev.x, prev.y, prev.z, v.x, v.y, v.z)
      }
      prev = v
      prevLon = lon
    }
  })
  return new Float32Array(segs)
}

function buildOutlineSegments(polys) {
  const out = []
  for (const poly of polys) {
    for (const ring of poly) {
      let prev = null
      let prevLon = null
      for (const [lon, lat] of ring) {
        const v = llToV3(lon, lat, RADII.lakeEdge)
        if (prev && Math.abs(lon - prevLon) < 180) {
          out.push(prev.x, prev.y, prev.z, v.x, v.y, v.z)
        }
        prev = v
        prevLon = lon
      }
    }
  }
  return new Float32Array(out)
}
