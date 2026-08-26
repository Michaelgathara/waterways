import * as THREE from 'three'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { COLORS, RADII } from '../config.js'

const lineMaterials = []

export function makeLineMaterial({ color, widthPx, dashed = false, opacity = 1 }) {
  const mat = new LineMaterial({
    color: new THREE.Color(color),
    linewidth: widthPx,
    dashed,
    dashScale: 1,
    transparent: opacity < 1,
    opacity
  })
  if (dashed) {
    mat.dashSize = 2.2
    mat.gapSize = 1.6
  }
  lineMaterials.push(mat)
  return mat
}

export function updateLineMaterialResolution(w, h) {
  for (const m of lineMaterials) m.resolution.set(w, h)
}

export function buildFillMesh(positions, color, opts = {}) {
  if (!positions || !positions.length) return null
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    side: THREE.FrontSide
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.renderOrder = opts.renderOrder ?? 0
  return mesh
}

export function buildStrokeSegments(segments, { color, widthPx, opacity = 1, renderOrder = 0 }) {
  if (!segments || !segments.length) return null
  const geo = new LineSegmentsGeometry()
  geo.setPositions(segments)
  const mat = makeLineMaterial({ color, widthPx, opacity })
  const obj = new LineSegments2(geo, mat)
  obj.computeLineDistances()
  obj.renderOrder = renderOrder
  return obj
}

export function riverWidthPx(rank) {
  return Math.max(1.15, 3.4 - rank * 0.42)
}

export function buildFeatureLine(linesV3, { color, widthPx, dashed = false, renderOrder = 0 }) {
  const segs = []
  for (const pts of linesV3) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]
      const b = pts[i]
      segs.push(a.x, a.y, a.z, b.x, b.y, b.z)
    }
  }
  if (!segs.length) return null
  const geo = new LineSegmentsGeometry()
  geo.setPositions(segs)
  const mat = makeLineMaterial({ color, widthPx, dashed })
  const obj = new LineSegments2(geo, mat)
  obj.computeLineDistances()
  obj.renderOrder = renderOrder
  return obj
}
