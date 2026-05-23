import { iconFor, getCategoryMeta, createPopupContent } from './utils.js';

export let map;
let layers = {
  intel: L.layerGroup(),
  official: L.layerGroup(),
  reports: L.layerGroup()
};

export function initLeafletMap(elementId, center, zoom) {
  map = L.map(elementId).setView(center, zoom);
  
  // High-performance, rider-friendly tiles (Stadia Maps - Alidade Smooth)
  L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', {
    maxZoom: 20,
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  
  // Add layers to map
  layers.intel.addTo(map);
  layers.official.addTo(map);
  layers.reports.addTo(map);
  
  return map;
}

export function toggleLayer(layerId, visible) {
  if (visible) {
    layers[layerId].addTo(map);
  } else {
    map.removeLayer(layers[layerId]);
  }
}

export function renderMap(features, allFeaturesCount, onFeatureClick) {
  Object.values(layers).forEach(group => group.clearLayers());
  const allBounds = [];

  features.forEach(f => {
    if (!f.geometry) return;
    const geom = f.geometry;
    
    // Determine which layer group this belongs to
    let targetGroup = layers.intel;
    if (f.category === 'Official Regional Data') {
      targetGroup = layers.official;
    } else if (f.category === 'Field Reports') {
      targetGroup = layers.reports;
    }

    if (f.feature_type === 'point' && geom.type === 'Point') {
      const coords = [geom.coordinates[1], geom.coordinates[0]];
      
      // Calculate opacity based on age for Field Reports (Decay feature)
      let opacity = 1.0;
      if (f.category === 'Field Reports' && f.longevity === 'temporary' && f.created_at) {
        const ageHours = (new Date() - new Date(f.created_at)) / (1000 * 60 * 60);
        if (ageHours > 48) return; // Hide temporary reports older than 48 hours
        opacity = Math.max(0.2, 1 - (ageHours / 48));
      }

      const marker = L.marker(coords, { 
        icon: iconFor(f),
        opacity: opacity
      }).addTo(targetGroup);
      marker.bindPopup(createPopupContent(f));
      marker.on('click', () => onFeatureClick(f));
      f._layer = marker;
      allBounds.push(coords);
    } else if (f.feature_type === 'line' && geom.type === 'LineString') {
      const coords = geom.coordinates.map(c => [c[1], c[0]]);
      const meta = getCategoryMeta(f.category);
      const isPlanned = f.officiality === 'planned' || f.category === 'Planned / in progress';
      const poly = L.polyline(coords, {
        color: meta.swatch,
        weight: f.category === 'Official Regional Data' ? 3 : 5, // Official data slightly thinner
        opacity: .92,
        dashArray: isPlanned ? '10 8' : null
      }).addTo(targetGroup);
      poly.bindPopup(createPopupContent(f));
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
    f._layer.openPopup();
  } else {
    map.fitBounds(f._layer.getBounds(), { padding: [40, 40] });
    f._layer.openPopup();
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
