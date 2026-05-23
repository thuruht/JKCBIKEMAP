import { iconFor, getCategoryMeta, createPopupContent } from './utils.js';

export let map;
let isAdmin = !!localStorage.getItem('ADMIN_TOKEN');
let currentBasemap;

const basemaps = {
  dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20
  }),
  voyager: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20
  }),
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }),
  terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data: &copy; OSM contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
    maxZoom: 17
  })
};

let layers = {
  intel: L.layerGroup(),
  official: L.layerGroup(),
  reports: L.layerGroup(),
  amenities: L.layerGroup()
};

export function initLeafletMap(elementId, center, zoom) {
  map = L.map(elementId).setView(center, zoom);
  
  // Default to Dark Mode for the Crypt aesthetic
  currentBasemap = basemaps.dark;
  currentBasemap.addTo(map);
  
  // Add feature layers to map
  layers.intel.addTo(map);
  layers.official.addTo(map);
  layers.reports.addTo(map);
  layers.amenities.addTo(map);
  
  return map;
}

export function switchBasemap(id) {
  if (basemaps[id]) {
    map.removeLayer(currentBasemap);
    currentBasemap = basemaps[id];
    currentBasemap.addTo(map);
  }
}

export async function fetchAmenities() {
  if (map.getZoom() < 14) {
    layers.amenities.clearLayers();
    return;
  }

  const bounds = map.getBounds();
  const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
  
  try {
    const resp = await fetch(`/api/amenities?bbox=${bbox}`);
    if (resp.status === 429) {
      console.warn('Amenities API busy, skipping update.');
      return;
    }
    if (!resp.ok) throw new Error('Proxy error');
    
    const data = await resp.json();
    layers.amenities.clearLayers();
    
    data.elements.forEach(el => {
      const type = el.tags.amenity || el.tags.shop || 'amenity';
      const name = el.tags.name || (el.tags.amenity === 'drinking_water' ? 'Water Fountain' : 
                   el.tags.shop === 'bicycle' ? 'Bike Shop' : 'Repair Station');
      
      const f = {
        name: name,
        category: 'Rider Amenities',
        status: 'active',
        officiality: 'official',
        public_description: el.tags.description || `Type: ${type}`,
        feature_type: 'point'
      };
      
      const marker = L.marker([el.lat, el.lon], { icon: iconFor(f) }).addTo(layers.amenities);
      marker.on('click', () => {
        const detailCard = document.getElementById('infoCard');
        if (detailCard) {
          import('./ui.js').then(ui => ui.updateInfoCard(f, detailCard, false));
        }
      });
    });
  } catch (err) {
    console.error('Failed to fetch amenities:', err);
  }
}

export function toggleLayer(layerId, visible) {
  if (visible) {
    layers[layerId].addTo(map);
  } else {
    map.removeLayer(layers[layerId]);
  }
}

export function renderMap(features, allFeaturesCount, onFeatureClick, onMarkerDrag) {
  Object.values(layers).forEach(group => group.clearLayers());
  const allBounds = [];

  features.forEach(f => {
    if (!f.geometry) return;
    const geom = f.geometry;
    
    let targetGroup = layers.intel;
    if (f.category === 'Official Regional Data') {
      targetGroup = layers.official;
    } else if (f.category === 'Field Reports') {
      targetGroup = layers.reports;
    }

    if (f.feature_type === 'point' && geom.type === 'Point') {
      const coords = [geom.coordinates[1], geom.coordinates[0]];
      
      let opacity = 1.0;
      if (f.category === 'Field Reports' && f.longevity === 'temporary' && f.created_at) {
        const ageHours = (new Date() - new Date(f.created_at)) / (1000 * 60 * 60);
        if (ageHours > 48) return;
        opacity = Math.max(0.2, 1 - (ageHours / 48));
      }

      const marker = L.marker(coords, { 
        icon: iconFor(f),
        opacity: opacity,
        draggable: isAdmin && f.feature_type === 'point'
      }).addTo(targetGroup);

      if (isAdmin && onMarkerDrag) {
        marker.on('dragend', (e) => {
          const newPos = e.target.getLatLng();
          onMarkerDrag(f, [newPos.lng, newPos.lat]);
        });
      }

      marker.on('click', () => onFeatureClick(f));
      f._layer = marker;
      allBounds.push(coords);
    } else if (f.feature_type === 'line' && geom.type === 'LineString') {
      const coords = geom.coordinates.map(c => [c[1], c[0]]);
      const meta = getCategoryMeta(f.category);
      const isPlanned = f.officiality === 'planned' || f.category === 'Planned / in progress';
      const poly = L.polyline(coords, {
        color: meta.swatch,
        weight: f.category === 'Official Regional Data' ? 3 : 5,
        opacity: .92,
        dashArray: isPlanned ? '10 8' : null
      }).addTo(targetGroup);
      poly.on('click', () => onFeatureClick(f));
      f._layer = poly;
      coords.forEach(c => allBounds.push(c));
    }
  });

  if (allBounds.length > 0 && features.length === allFeaturesCount) {
    map.fitBounds(allBounds, { padding: [28, 28] });
  }
}

export function flyToFeature(f, onFlyComplete) {
  if (!f._layer) return;
  if (f.feature_type === 'point') {
    map.flyTo(f._layer.getLatLng(), 14, { duration: 1.05 });
  } else {
    map.fitBounds(f._layer.getBounds(), { padding: [40, 40] });
  }
  if (onFlyComplete) onFlyComplete(f);
}

export function enableMapPicker(onPicked) {
  map.getContainer().style.cursor = 'crosshair';
  const onClick = (e) => {
    map.off('click', onClick);
    map.getContainer().style.cursor = '';
    onPicked([e.latlng.lng, e.latlng.lat]);
  };
  map.on('click', onClick);
}
