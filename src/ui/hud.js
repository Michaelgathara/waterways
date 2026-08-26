export function buildHUD() {
  const hud = document.createElement('div')
  hud.id = 'hud'
  hud.innerHTML = `
    <header id="masthead">
      <h1>Waterways</h1>
      <p class="sub">one continuous body</p>
    </header>

    <aside id="legend" class="panel">
      <div class="legend-row"><span class="sw wash"></span><span>World Ocean — one connected body</span></div>
      <div class="legend-row"><span class="sw line solid"></span><span>Rivers draining to the ocean</span></div>
      <div class="legend-row"><span class="sw line dashed"></span><span>Canal-linked waters &amp; routes</span></div>
      <div class="legend-row"><span class="sw blank"></span><span>Land — left as blank paper</span></div>
      <p class="note">Isolated basins are omitted. The Caspian appears
      because the Volga–Don Canal links it back to the network.</p>
    </aside>

    <nav id="toggles" class="panel">
      <button data-key="rivers" class="tgl on">Rivers</button>
      <button data-key="lakes" class="tgl on">Lakes</button>
      <button data-key="routes" class="tgl on">Routes</button>
      <button data-key="grid" class="tgl on">Grid</button>
      <button data-key="spin" class="tgl on">Drift</button>
    </nav>

    <section id="info" class="panel hidden">
      <button id="info-close" aria-label="close">×</button>
      <p id="info-kind"></p>
      <h2 id="info-name"></h2>
      <dl id="info-stats"></dl>
      <p id="info-out"></p>
    </section>

    <footer id="credit">Natural Earth · 50&nbsp;m hydrography · drag to turn, scroll to zoom</footer>

    <div id="veil"><p id="veil-text">gathering water…</p></div>
  `
  document.body.appendChild(hud)

  const veil = hud.querySelector('#veil')
  const veilText = hud.querySelector('#veil-text')

  return {
    el: hud,
    veil: {
      show(t) { veil.classList.remove('gone'); if (t) veilText.textContent = t },
      text(t) { veilText.textContent = t },
      hide() { veil.classList.add('gone') }
    },
    info: {
      show(feature) {
        hud.querySelector('#info').classList.remove('hidden')
        hud.querySelector('#info-kind').textContent = feature.kindLabel || ''
        hud.querySelector('#info-name').textContent = feature.name
        const stats = hud.querySelector('#info-stats')
        stats.innerHTML = ''
        const add = (k, v) => {
          if (v == null) return
          const dt = document.createElement('dt'); dt.textContent = k
          const dd = document.createElement('dd'); dd.textContent = v
          stats.append(dt, dd)
        }
        if (feature.lengthKm != null) add('length', fmtKm(feature.lengthKm))
        if (feature.areaKm2 != null) add('area', fmtKm2(feature.areaKm2))
        if (feature.year) add('opened', feature.year)
        hud.querySelector('#info-out').textContent = feature.outflow || ''
      },
      hide() { hud.querySelector('#info').classList.add('hidden') }
    }
  }
}

function fmtKm(km) {
  if (km >= 1000) return Math.round(km).toLocaleString('en-US') + ' km'
  return Math.round(km) + ' km'
}

function fmtKm2(a) {
  if (a >= 1e6) return (a / 1e6).toFixed(2) + ' million km²'
  if (a >= 1e3) return Math.round(a / 1e3) + ',000 km²'
  return Math.round(a).toLocaleString('en-US') + ' km²'
}
