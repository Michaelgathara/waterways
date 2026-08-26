import * as THREE from 'three'
import earcut from 'earcut'
import { R, DEG, EARTH_R_KM } from './config.js'

export function llToV3(lon, lat, r = R) {
  const phi = (90 - lat) * DEG
  const theta = (lon + 180) * DEG
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  )
}

export function v3ToLL(v) {
  const n = v.clone().normalize()
  const lat = 90 - Math.acos(THREE.MathUtils.clamp(n.y, -1, 1)) / DEG
  let lon = Math.atan2(n.z, -n.x) / DEG - 180
  if (lon < -180) lon += 360
  if (lon > 180) lon -= 360
  return [lon, lat]
}

export function unwrapRing(ring) {
  const out = []
  let prev = null
  for (const [lon, lat] of ring) {
    let L = lon
    if (prev !== null) {
      while (L - prev > 180) L -= 360
      while (L - prev < -180) L += 360
    }
    out.push([L, lat])
    prev = L
  }
  return out
}

export function splitRingAtSeam(ring) {
  const n = ring.length
  let jumps = 0
  for (let i = 0; i < n; i++) {
    if (Math.abs(ring[(i + 1) % n][0] - ring[i][0]) > 180) jumps++
  }
  if (!jumps) return [ring]

  const chains = []
  let cur = []
  for (let i = 0; i < n; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % n]
    cur.push([a[0], a[1]])
    if (Math.abs(b[0] - a[0]) > 180) {
      const unwrappedB = b[0] + (b[0] < a[0] ? 360 : -360)
      const S = a[0] > 0 ? 180 : -180
      const t = (S - a[0]) / (unwrappedB - a[0])
      const lat = a[1] + (b[1] - a[1]) * t
      cur.push([S, lat])
      chains.push(cur)
      cur = [[-S, lat]]
    }
  }
  if (cur.length) {
    if (chains.length) chains[0] = cur.concat(chains[0])
    else chains.push(cur)
  }
  return chains.filter(c => c.length > 3)
}

export function subdividePair(a, b, maxStepDeg = 0.75) {
  const total = a.angleTo(b) / DEG
  const n = Math.max(1, Math.ceil(total / maxStepDeg))
  const r = b.length()
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    pts.push(new THREE.Vector3().lerpVectors(a, b, t).normalize().multiplyScalar(r))
  }
  return pts
}

export function polylineLLToV3(coords, r = R, maxStepDeg = 0.6) {
  const out = []
  let prev = null
  for (const [lon, lat] of coords) {
    const v = llToV3(lon, lat, r)
    if (prev) out.push(...subdividePair(prev, v, maxStepDeg).slice(1))
    else out.push(v)
    prev = v
  }
  return out
}

function midpointLL(a, b) {
  return new THREE.Vector3().addVectors(a, b).normalize()
}

export function alignRingIntoSpan(ring, spanMin, spanMax) {
  let best = null
  let bestScore = Infinity
  for (let k = -3; k <= 3; k++) {
    let min = Infinity
    let max = -Infinity
    let sum = 0
    for (const p of ring) {
      const L = p[0] + k * 360
      if (L < min) min = L
      if (L > max) max = L
      sum += L
    }
    const overflow = Math.max(0, min - spanMax) + Math.max(0, spanMin - max)
    const centerDist = Math.abs(sum / ring.length - (spanMin + spanMax) / 2)
    const score = overflow * 10000 + centerDist
    if (score < bestScore) {
      bestScore = score
      best = ring.map(([lon, lat]) => [lon + k * 360, lat])
    }
  }
  return best
}

export function triangulatePolygon(rings, { fillRadius = R, maxEdgeDeg = 3 } = {}) {
  const prepared = []
  const outerPieces = splitRingAtSeam(rings[0])
  for (const piece of outerPieces) {
    let minLat = Infinity
    let minLon = Infinity
    let maxLon = -Infinity
    for (const p of piece) {
      if (p[1] < minLat) minLat = p[1]
      if (p[0] < minLon) minLon = p[0]
      if (p[0] > maxLon) maxLon = p[0]
    }
    if (minLat < -83 && maxLon - minLon > 350) {
      prepared.push([...piece, [piece[piece.length - 1][0], -89.99], [piece[0][0], -89.99]])
    } else {
      prepared.push(piece)
    }
  }

  const holeIndices = []
  for (let i = 1; i < rings.length; i++) {
    for (const piece of splitRingAtSeam(rings[i])) {
      holeIndices.push(prepared.reduce((s, r) => s + r.length, 0))
      prepared.push(piece)
    }
  }

  const flat = []
  let count = 0
  prepared.forEach((ring) => {
    for (const [lon, lat] of ring) {
      flat.push(lon, lat)
      count++
    }
  })
  if (flat.length < 8) return []

  const tris = earcut(flat, holeIndices.length ? holeIndices : undefined, 2)
  const positions = []

  const getV = (idx) => llToV3(flat[idx * 2], flat[idx * 2 + 1], 1)

  const emitTri = (a, b, c, depth) => {
    const maxAng = Math.max(a.angleTo(b), b.angleTo(c), c.angleTo(a)) / DEG
    if (maxAng > maxEdgeDeg && depth < 9) {
      const ab = midpointLL(a, b)
      const bc = midpointLL(b, c)
      const ca = midpointLL(c, a)
      emitTri(a, ab, ca, depth + 1)
      emitTri(ab, b, bc, depth + 1)
      emitTri(ca, bc, c, depth + 1)
      emitTri(ab, bc, ca, depth + 1)
    } else {
      positions.push(
        a.x * fillRadius, a.y * fillRadius, a.z * fillRadius,
        b.x * fillRadius, b.y * fillRadius, b.z * fillRadius,
        c.x * fillRadius, c.y * fillRadius, c.z * fillRadius
      )
    }
  }

  for (let t = 0; t < tris.length; t += 3) {
    emitTri(getV(tris[t]), getV(tris[t + 1]), getV(tris[t + 2]), 0)
  }
  return new Float32Array(positions)
}

export function haversineKm(coords) {
  let sum = 0
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1]
    const [lon2, lat2] = coords[i]
    const dLat = (lat2 - lat1) * DEG
    const dLon = (lon2 - lon1) * DEG
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2
    sum += 2 * EARTH_R_KM * Math.asin(Math.min(1, Math.sqrt(s)))
  }
  return sum
}

export function sphericalRingAreaKm2(ring) {
  let acc = 0
  for (let i = 0; i < ring.length; i++) {
    const [lon1, lat1] = ring[i]
    const [lon2, lat2] = ring[(i + 1) % ring.length]
    acc += (lon2 - lon1) * DEG * (2 + Math.sin(lat1 * DEG) + Math.sin(lat2 * DEG))
  }
  return Math.abs(acc * EARTH_R_KM * EARTH_R_KM / 2)
}
