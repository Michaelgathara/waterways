import * as THREE from 'three'
import { R, COLORS } from './config.js'
import { v3ToLL } from './geo.js'

const PICK_PX = 12
const SPHERE = new THREE.Sphere(new THREE.Vector3(0, 0, 0), R)
const SAMPLE_STRIDE = 6

export function initPicker({ camera, renderer, model, built, hud, toggles }) {
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const canvas = renderer.domElement

  let hovered = null
  let selected = null

  const samples = []
  for (const obj of [...built.riverObjs, ...built.routeObjs]) {
    const f = obj.userData.feature
    for (const line of f.points) {
      for (let i = 0; i < line.v3.length; i += SAMPLE_STRIDE) {
        samples.push({ v: line.v3[i], feature: f })
      }
    }
  }

  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerdown', onClick)
  canvas.addEventListener('pointerleave', () => setHover(null))

  function toNDC(e) {
    const rect = canvas.getBoundingClientRect()
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  }

  function pickAt() {
    raycaster.setFromCamera(ndc, camera)
    const hitPoint = new THREE.Vector3()
    const hitSphere = raycaster.ray.intersectSphere(SPHERE, hitPoint)

    let best = null
    let bestDist = PICK_PX
    if (hitSphere) {
      const camDir = camera.position.clone().normalize()
      const w = window.innerWidth / 2
      const h = window.innerHeight / 2
      const projV = new THREE.Vector3()
      for (const s of samples) {
        const f = s.feature
        if (f.category === 'river' && !toggles.rivers) continue
        if ((f.category === 'route' || f.category === 'canal') && !toggles.routes) continue
        if (s.n === undefined) s.n = s.v.clone().normalize()
        if (s.n.dot(camDir) < 0.12) continue
        projV.copy(s.v).project(camera)
        const d = Math.hypot(
          projV.x * w - ndc.x * w,
          projV.y * h - ndc.y * h
        )
        if (d < bestDist) { bestDist = d; best = f }
      }
    }
    if (best) return best

    if (hitSphere && toggles.lakes && model.caspian &&
      inPolys(v3ToLL(hitPoint), model.caspian.polygonsLL)) {
      return model.caspian
    }
    if (hitSphere && toggles.lakes) {
      const ll = v3ToLL(hitPoint)
      for (const lake of model.lakes) {
        if (inPolys(ll, lake.polygonsLL)) return lake
      }
    }
    return null
  }

  let pendingEvent = null
  let timer = null
  function onMove(e) {
    pendingEvent = e
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      if (!pendingEvent) return
      toNDC(pendingEvent)
      setHover(pickAt())
    }, 50)
  }

  function onClick(e) {
    if (e.button !== 0) return
    toNDC(e)
    const f = pickAt()
    if (f) {
      if (selected && selected !== f) restore(selected)
      selected = f
      applyHighlight(f)
      hud.info.show(f)
    } else {
      restore(selected)
      selected = null
      hud.info.hide()
    }
  }

  function setHover(f) {
    if (hovered === f || hovered === selected && f === null) return
    if (hovered && hovered !== selected) restore(hovered)
    hovered = f
    if (f && f !== selected) applyHighlight(f)
    canvas.style.cursor = f ? 'pointer' : 'grab'
  }

  function applyHighlight(f) {
    for (const obj of [...built.riverObjs, ...built.routeObjs]) {
      if (obj.userData.feature !== f) continue
      if (!obj.userData.baseColor) {
        obj.userData.baseColor = obj.material.color.clone()
        obj.userData.baseWidth = obj.material.linewidth
      }
      const hi = (f.category === 'route') ? COLORS.highlightRoute : COLORS.highlightRiver
      obj.material.color.set(hi)
      obj.material.linewidth = Math.min(obj.userData.baseWidth * 1.7, 5)
    }
  }

  function restore(f) {
    if (!f) return
    for (const obj of [...built.riverObjs, ...built.routeObjs]) {
      if (obj.userData.feature === f && obj.userData.baseColor) {
        obj.material.color.copy(obj.userData.baseColor)
        obj.material.linewidth = obj.userData.baseWidth
        obj.userData.baseColor = null
        obj.userData.baseWidth = null
      }
    }
  }

  return { pickAt }
}

function inRing(pt, ring) {
  let ins = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > pt[1]) !== (yj > pt[1]) &&
      pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) ins = !ins
  }
  return ins
}

function inPolys(pt, polys) {
  for (const poly of polys) {
    if (!inRing(pt, poly[0])) continue
    let hole = false
    for (let h = 1; h < poly.length; h++) if (inRing(pt, poly[h])) { hole = true; break }
    if (!hole) return true
  }
  return false
}
