import { iconFor, getCategoryMeta, createPopupContent } from './utils.js';

export let map;
let layers = {
  intel: L.layerGroup(),
  official: L.layerGroup(),
  reports: L.layerGroup(),
  amenities: L.layerGroup()
};

export function initLeafletMap(elementId, center, zoom) {
  map = L.map(elementId).setView(center, zoom);
  
  // CartoDB Voyager - Clear, high-performance, and no immediate API key requirement
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 20,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }).addTo(map);
  
  // Add layers to map
  layers.intel.addTo(map);
  layers.official.addTo(map);
  layers.reports.addTo(map);
  layers.amenities.addTo(map);
  
  return map;
}

export async function fetchAmenities() {
  const bounds = map.getBounds();
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="drinking_water"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
      node["service:bicycle:repair"="yes"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
      node["amenity"="bicycle_repair_station"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
    );
    out body;
  `;
  
  try {
    const resp = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    const data = await resp.json();
    layers.amenities.clearLayers();
    
    data.elements.forEach(el => {
      const f = {
        name: el.tags.name || (el.tags.amenity === 'drinking_water' ? 'Water Fountain' : 'Repair Station'),
        category: 'Rider Amenities',
        status: 'active',
        officiality: 'official',
        public_description: el.tags.description || `OSM ID: ${el.id}`,
        feature_type: 'point'
      };
      
      const marker = L.marker([el.lat, el.lon], { icon: iconFor(f) }).addTo(layers.amenities);
      marker.bindPopup(createPopupContent(f));
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
