import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { buildHUD } from './ui/hud.js'
import { processData } from './data/connect.js'
import { buildScene } from './globe/build.js'
import { updateLineMaterialResolution } from './globe/lines.js'
import { initPicker } from './pick.js'

async function fetchJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.json()
}

const hud = buildHUD()
document.querySelector('#boot')?.remove()
hud.veil.show('fetching hydrography…')

try {
  const [land, ocean, rivers, lakes] = await Promise.all([
    fetchJSON('./data/ne_50m_land.geojson'),
    fetchJSON('./data/ne_50m_ocean.geojson'),
    fetchJSON('./data/ne_50m_rivers.geojson'),
    fetchJSON('./data/ne_50m_lakes.geojson')
  ])

  hud.veil.text('carving the network…')
  await new Promise(r => requestAnimationFrame(r))
  const fast = new URLSearchParams(location.search).has('fast')
  if (fast) {
    globalThis.__WATERWAYS_LOD = { maxEdgeDeg: 6 }
    console.log('[lod] coarse mode')
  }
  const model = processData({ land, ocean, rivers, lakes })
  console.log(
    `[model] rivers ${model.rivers.length} · routes ${model.routes.length} · lakes ${model.lakes.length} · ocean ${(model.worldOceanAreaKm2 / 1e6).toFixed(1)}M km²`
  )

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.prepend(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 1, 1200)
  camera.position.set(60, 110, 300)

  hud.veil.text('inking coastlines…')
  await new Promise(r => requestAnimationFrame(r))

  const built = buildScene(model)
  scene.add(built.root)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.rotateSpeed = 0.55
  controls.enablePan = false
  controls.minDistance = 135
  controls.maxDistance = 560
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.45

  const toggles = { rivers: true, lakes: true, routes: true, grid: true, spin: true }

  const params = new URLSearchParams(location.search)
  const layerParam = params.get('layers')
  if (layerParam) {
    for (const key of Object.keys(toggles)) toggles[key] = layerParam.includes(key)
    for (const btn of document.querySelectorAll('#toggles .tgl')) {
      btn.classList.toggle('on', toggles[btn.dataset.key])
    }
    for (const [key, group] of Object.entries(built.groups)) group.visible = toggles[key]
    controls.autoRotate = toggles.spin
  }
  if (params.get('cam')) {
    const [lon, lat, dist] = params.get('cam').split(',').map(Number)
    if (Number.isFinite(lon) && Number.isFinite(lat) && Number.isFinite(dist)) {
      const phi = (90 - lat) * Math.PI / 180
      const theta = (lon + 180) * Math.PI / 180
      camera.position.set(
        -dist * Math.sin(phi) * Math.cos(theta),
        dist * Math.cos(phi),
        dist * Math.sin(phi) * Math.sin(theta)
      )
      controls.autoRotate = false
      toggles.spin = false
    }
  }

  for (const btn of document.querySelectorAll('#toggles .tgl')) {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key
      toggles[key] = !toggles[key]
      btn.classList.toggle('on', toggles[key])
      if (key === 'spin') controls.autoRotate = toggles.spin
      else if (key in built.groups) built.groups[key].visible = toggles[key]
      if (!toggles.rivers && !toggles.routes) picker.setHover?.(null)
    })
  }

  document.querySelector('#info-close').addEventListener('click', () => hud.info.hide())

  initPicker({ camera, renderer, model, built, hud, toggles })

  function resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    updateLineMaterialResolution(w, h)
  }
  window.addEventListener('resize', resize)
  resize()

  renderer.domElement.style.cursor = 'grab'
  let dragging = false
  renderer.domElement.addEventListener('pointerdown', () => { dragging = true })
  window.addEventListener('pointerup', () => { dragging = false })

  hud.veil.hide()
  if (fast) document.querySelector('#veil').style.display = 'none'

  renderer.setAnimationLoop(() => {
    controls.update()
    built.limb.quaternion.copy(camera.quaternion)
    renderer.render(scene, camera)
  })
} catch (err) {
  console.error(err)
  hud.veil.show(`could not assemble the water — ${err.message}`)
}
