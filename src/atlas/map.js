// 全臺地圖：Leaflet 底圖、縣市輪廓、地景標記群聚、歷史圖層疊圖與古今滑桿
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { BASEMAPS, HISTORY_LAYERS, HISTORY_ATTRIBUTION } from './layers.js';

const TAIWAN = L.latLngBounds([21.7, 118.1], [26.5, 122.2]);
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
export const displayCity = name => String(name || '').replace(/^台/, '臺');

export function createMap(el, { onSelect, onCounty, onView }) {
  const map = L.map(el, { zoomControl: false, minZoom: 6, maxZoom: 18, maxBounds: TAIWAN.pad(0.6), worldCopyJump: false, attributionControl: true, zoomSnap: 0.25 });
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noreferrer">Leaflet</a>');
  L.control.zoom({ position: 'bottomright', zoomInTitle: '放大', zoomOutTitle: '縮小' }).addTo(map);
  map.createPane('history').style.zIndex = 250;
  map.createPane('counties').style.zIndex = 300;
  map.fitBounds(TAIWAN, { padding: [10, 10] });
  // 任意地點：放大到街區層級後點地圖，可直接生成現代 3D 街景（OSM）
  map.on('click', e => {
    if (map.getZoom() < 14) return;
    const { lat, lng } = e.latlng, href = `./?place=osm&lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}`;
    L.popup({ className: 'osm-pop', closeButton: true, autoPan: false }).setLatLng(e.latlng)
      .setContent(`<div class="osm-pop-in"><strong>${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E</strong><a href="${href}">在這裡生成現代 3D 街景 ↗</a><a href="./?place=tw&ll=${lat.toFixed(5)},${lng.toFixed(5)}">在全臺立體地景中飛到這裡 ↗</a><small>依 OpenStreetMap 自動生成</small></div>`).openOn(map);
  });

  // 底圖
  let base = null, baseId = null, tileErrors = 0;
  function setBasemap(id) {
    const def = BASEMAPS.find(b => b.id === id) || BASEMAPS[0];
    if (base) map.removeLayer(base);
    base = null; baseId = def.id; tileErrors = 0;
    el.classList.toggle('no-basemap', !def.url);
    if (def.url) {
      base = L.tileLayer(def.url, { attribution: def.attribution, maxNativeZoom: def.maxNativeZoom, maxZoom: 18, errorTileUrl: BLANK, crossOrigin: false });
      base.on('tileerror', () => { if (++tileErrors === 8) el.dispatchEvent(new CustomEvent('basemap-error', { detail: def })); });
      base.addTo(map);
    }
  }

  // 縣市輪廓（內政部開放資料，離線可用）
  let counties = null, selectedCities = [];
  const countyStyle = f => {
    const on = selectedCities.includes(displayCity(f.properties.name));
    return { pane: 'counties', color: on ? '#a34730' : '#5b6e61', weight: on ? 2.2 : 0.9, opacity: on ? 0.95 : 0.55, fillColor: on ? '#d9a65b' : '#e9e4d2', fillOpacity: el.classList.contains('no-basemap') ? (on ? 0.55 : 0.85) : (on ? 0.18 : 0) };
  };
  fetch(new URL('data/tw-counties.geo.json', document.baseURI)).then(r => r.json()).then(geo => {
    counties = L.geoJSON(geo, {
      style: countyStyle,
      onEachFeature: (f, layer) => {
        const name = displayCity(f.properties.name);
        layer.bindTooltip(name, { sticky: true, className: 'county-tip', direction: 'top' });
        layer.on('click', e => { L.DomEvent.stopPropagation(e); onCounty?.(name); });
      },
    }).addTo(map);
  }).catch(() => {});
  function highlightCities(list) { selectedCities = list; counties?.setStyle(countyStyle); }

  // 地景標記與群聚
  const cluster = L.markerClusterGroup({
    showCoverageOnHover: false, maxClusterRadius: 46, spiderfyDistanceMultiplier: 1.6,
    iconCreateFunction: c => {
      const kids = c.getAllChildMarkers(), live = kids.filter(m => m.options.scene.status === 'live').length;
      return L.divIcon({ className: 'cluster-pin', html: `<span><b>${kids.length}</b><small>${live ? live + ' 上線' : '候選'}</small></span>`, iconSize: [52, 52] });
    },
  }).addTo(map);
  const markers = new Map();
  function setScenes(list, activeId) {
    cluster.clearLayers(); markers.clear();
    const layers = [];
    for (const s of list) {
      if (s.lat == null || s.lng == null) continue;
      const icon = L.divIcon({ className: `scene-pin ${s.status}${s.id === activeId ? ' active' : ''}`, html: `<i></i><span>${s.name}</span>`, iconSize: [18, 18], iconAnchor: [9, 9] });
      const m = L.marker([s.lat, s.lng], { icon, scene: s, title: s.name, keyboard: true, riseOnHover: true });
      m.on('click', () => onSelect?.(s.id, true));
      markers.set(s.id, m); layers.push(m);
    }
    cluster.addLayers(layers);
  }
  function focusScene(scene, fly = true) {
    if (scene.lat == null) return;
    const m = markers.get(scene.id);
    markers.forEach((mk, id) => mk.getElement()?.classList.toggle('active', id === scene.id));
    if (!fly) return;
    const z = Math.max(map.getZoom(), 15);
    if (m) cluster.zoomToShowLayer(m, () => map.flyTo([scene.lat, scene.lng], z, { duration: 0.8 }));
    else map.flyTo([scene.lat, scene.lng], z, { duration: 0.8 });
  }
  function fitScenes(list) {
    const pts = list.filter(s => s.lat != null).map(s => [s.lat, s.lng]);
    if (!pts.length) return;
    if (pts.length === 1) map.flyTo(pts[0], 15, { duration: 0.8 });
    else map.flyToBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 15, duration: 0.8 });
  }

  // 歷史圖層：透明度、古今滑桿（左側古、右側今）
  let history = null, historyId = null, opacity = 0.85, swipe = null;
  function setHistory(id) {
    if (history) map.removeLayer(history);
    history = null; historyId = null;
    const def = HISTORY_LAYERS.find(h => h.id === id);
    if (def) {
      historyId = def.id;
      history = L.tileLayer(def.url, { pane: 'history', opacity, attribution: HISTORY_ATTRIBUTION, errorTileUrl: BLANK, maxZoom: 18, maxNativeZoom: def.maxNativeZoom || 16 });
      history.addTo(map);
    }
    clip();
  }
  function setOpacity(v) { opacity = v; history?.setOpacity(v); }
  function setSwipe(v) { swipe = v; clip(); }
  function clip() {
    const pane = map.getPane('history');
    if (swipe == null || !history) { pane.style.clip = ''; return; }
    const size = map.getSize(), nw = map.containerPointToLayerPoint([0, 0]), se = map.containerPointToLayerPoint(size);
    const x = map.containerPointToLayerPoint([size.x * swipe, 0]).x;
    pane.style.clip = `rect(${nw.y}px, ${x}px, ${se.y}px, ${nw.x}px)`;
  }
  map.on('move zoom resize', clip);
  map.on('moveend', () => { const c = map.getCenter(); onView?.(c.lat, c.lng, map.getZoom()); });

  return {
    map, setBasemap, setHistory, setOpacity, setSwipe, setScenes, focusScene, fitScenes, highlightCities,
    get basemap() { return baseId; }, get history() { return historyId; },
    setView: (lat, lng, z) => map.setView([lat, lng], z, { animate: false }),
    invalidate: () => { map.invalidateSize(); clip(); },
  };
}
