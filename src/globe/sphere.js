import * as THREE from 'three'
import { COLORS, RADII, R, DEG } from '../config.js'

export function buildBaseSphere() {
  const geo = new THREE.SphereGeometry(RADII.base, 96, 64)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const cLight = new THREE.Color(COLORS.paper)
  const cDeep = new THREE.Color(COLORS.paperDeep)
  const tmp = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / RADII.base
    const t = THREE.MathUtils.smoothstep(Math.abs(y), 0.15, 1)
    tmp.lerpColors(cLight, cDeep, t * 0.9)
    colors[i * 3] = tmp.r
    colors[i * 3 + 1] = tmp.g
    colors[i * 3 + 2] = tmp.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true })
  return new THREE.Mesh(geo, mat)
}

export function buildGraticule(stepDeg = 15) {
  const verts = []
  for (let lon = -180; lon < 180; lon += stepDeg) {
    let prev = null
    for (let lat = -88; lat <= 88; lat += 2) {
      const v = llToVec(lon, lat, RADII.grid)
      if (prev) verts.push(prev.x, prev.y, prev.z, v.x, v.y, v.z)
      prev = v
    }
  }
  for (let lat = -75; lat <= 75; lat += stepDeg) {
    let prev = null
    for (let lon = -180; lon <= 180; lon += 2) {
      const v = llToVec(lon, lat, RADII.grid)
      if (prev) verts.push(prev.x, prev.y, prev.z, v.x, v.y, v.z)
      prev = v
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
  const mat = new THREE.LineBasicMaterial({ color: COLORS.grid, transparent: true, opacity: 0.14 })
  return new THREE.LineSegments(geo, mat)
}

export function buildLimbRing() {
  const verts = []
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2
    verts.push(Math.cos(a) * RADII.limb, Math.sin(a) * RADII.limb, 0)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
  const mat = new THREE.LineBasicMaterial({ color: COLORS.ink, transparent: true, opacity: 0.35 })
  const ring = new THREE.Line(geo, mat)
  ring.frustumCulled = false
  return ring
}

function llToVec(lon, lat, r) {
  const phi = (90 - lat) * DEG
  const theta = (lon + 180) * DEG
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  )
}
