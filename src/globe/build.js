import * as THREE from 'three'
import { COLORS, RADII } from '../config.js'
import {
  buildBaseSphere,
  buildGraticule,
  buildLimbRing
} from './sphere.js'
import {
  buildFillMesh,
  buildStrokeSegments,
  buildFeatureLine,
  riverWidthPx
} from './lines.js'

export function buildScene(model) {
  const root = new THREE.Group()
  const groups = { grid: new THREE.Group(), rivers: new THREE.Group(), routes: new THREE.Group(), lakes: new THREE.Group() }

  const sphere = buildBaseSphere()
  root.add(sphere)

  const graticule = buildGraticule()
  graticule.visible = true
  groups.grid.add(graticule)

  const ocean = buildFillMesh(model.worldOceanPositions, COLORS.ocean, { renderOrder: 1 })
  if (ocean) root.add(ocean)

  const coast = buildStrokeSegments(model.coastSegments, {
    color: COLORS.ink,
    widthPx: 0.9,
    opacity: 0.5,
    renderOrder: 3
  })
  if (coast) root.add(coast)

  const lakeFills = []
  for (const lake of model.lakes) {
    const fill = buildFillMesh(lake.positions, COLORS.lake, { renderOrder: 2 })
    const edge = buildStrokeSegments(lake.outlineSegments, {
      color: COLORS.ink,
      widthPx: 0.8,
      opacity: 0.45,
      renderOrder: 4
    })
    if (fill) { groups.lakes.add(fill); lakeFills.push({ mesh: fill, ref: lake }) }
    if (edge) { groups.lakes.add(edge); edge.userData.ref = lake }
  }

  const caspianFill = buildFillMesh(model.caspianPositions, COLORS.caspian, { renderOrder: 2 })
  if (caspianFill) groups.lakes.add(caspianFill)
  const caspianEdge = buildStrokeSegments(model.caspianOutlineSegments, {
    color: COLORS.canalLinked,
    widthPx: 1,
    opacity: 0.55,
    renderOrder: 4
  })
  if (caspianEdge) groups.lakes.add(caspianEdge)
  model.caspian = {
    id: 'caspian',
    name: 'Caspian Sea',
    kindLabel: 'Sea · linked by canal',
    areaKm2: model.caspianAreaKm2,
    outflow: 'No natural outlet · joins ocean via Volga–Don Canal',
    polygonsLL: model.caspianPolyLL
  }

  const riverObjs = []
  for (const river of model.rivers) {
    const color = river.category === 'canal' ? COLORS.canalLinked : COLORS.river
    const width = river.category === 'canal'
      ? Math.max(riverWidthPx(river.rank), 1.3)
      : riverWidthPx(river.rank)
    const obj = buildFeatureLine(
      river.points.map(p => p.v3),
      { color, widthPx: width, dashed: river.dashed, renderOrder: river.category === 'canal' ? 7 : 6 }
    )
    if (!obj) continue
    obj.userData.feature = river
    groups.rivers.add(obj)
    riverObjs.push(obj)
  }

  const routeObjs = []
  for (const route of model.routes) {
    const obj = buildFeatureLine(
      route.points.map(p => p.v3),
      { color: COLORS.route, widthPx: 2.1, dashed: true, renderOrder: 8 }
    )
    if (!obj) continue
    obj.userData.feature = route
    groups.routes.add(obj)
    routeObjs.push(obj)
  }

  const limb = buildLimbRing()

  root.add(groups.grid, groups.lakes, groups.rivers, groups.routes, limb)

  return { root, groups, limb, riverObjs, routeObjs, lakeFills }
}
