import { iconFor, getCategoryMeta, createPopupContent } from './utils.js';

export let map;
let isAdmin = !!localStorage.getItem('ADMIN_TOKEN');
let currentBasemap;

const basemaps = {
  // DARK & NIGHT
  dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO', subdomains: 'abcd', maxZoom: 20
  }),
  night: L.tileLayer('https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default/{time}/{tilematrixset}{maxZoom}/{z}/{y}/{x}.{format}', {
    attribution: '&copy; NASA', bounds: [[-85.0511287776, -179.999999975], [85.0511287776, 179.999999975]], minZoom: 1, maxZoom: 8, format: 'jpg', time: '', tilematrixset: 'GoogleMapsCompatible_Level'
  }),
  esri_dark: L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri', maxZoom: 16
  }),
  // SATELLITE
  satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community', maxZoom: 19
  }),
  google_sat: L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google', maxZoom: 20
  }),
  google_hybrid: L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google', maxZoom: 20
  }),
  usgs_imagery: L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; USGS', maxZoom: 16
  }),
  // STREETS
  voyager: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO', subdomains: 'abcd', maxZoom: 20
  }),
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
  }),
  osm_fr: L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap &copy; OSM France', subdomains: ['a', 'b', 'c']
  }),
  osm_ch: L.tileLayer('https://tile.osm.ch/switzerland/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap &copy; Swiss OSM'
  }),
  public_transport: L.tileLayer('https://tile.memomaps.de/tilegen/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap &copy; MeMoMaps', maxZoom: 18
  }),
  // TOPO
  terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data: &copy; OSM contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)', maxZoom: 17
  }),
  esri_topo: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri &copy; OpenStreetMap', maxZoom: 19
  }),
  usgs_topo: L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; USGS &copy; OpenStreetMap', maxZoom: 16
  }),
  // OUTDOOR
  cyclosm: L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CyclOSM', maxZoom: 20
  }),
  pioneer: L.tileLayer('https://{s}.tile.thunderforest.com/pioneer/{z}/{x}/{y}.png?apikey=6170aad10dfd42a38d4d8c709a536f38', {
    attribution: '&copy; Thunderforest &copy; OSM', subdomains: 'abc', maxZoom: 22
  }),
  outdoors: L.tileLayer('https://{s}.tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=6170aad10dfd42a38d4d8c709a536f38', {
    attribution: '&copy; Thunderforest &copy; OSM', subdomains: 'abc', maxZoom: 22
  })
};

let layers = {
  intel: L.layerGroup(),
  official: L.layerGroup(),
  reports: L.layerGroup(),
  amenities: L.layerGroup(),
  // OVERLAYS
  railway: L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenRailwayMap', maxZoom: 19, transparent: true, opacity: 0.7
  }),
  cycling_routes: L.tileLayer('https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png', {
    attribution: '&copy; Waymarked Trails', maxZoom: 18, transparent: true, opacity: 0.8
  }),
  hiking_trails: L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {
    attribution: '&copy; Waymarked Trails', maxZoom: 18, transparent: true, opacity: 0.8
  })
};

export function initLeafletMap(elementId, center, zoom) {
  map = L.map(elementId).setView(center, zoom);
  
  // Default to Pioneer for high-fidelity trail navigation
  currentBasemap = basemaps.pioneer;
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

export function toggleOverlay(id, visible) {
  if (layers[id]) {
    if (visible) {
      layers[id].addTo(map);
    } else {
      map.removeLayer(layers[id]);
    }
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

export function renderMap(features, allFeaturesCount, onFeatureClick, onMarkerDrag, isAdminFlag) {
  Object.values(layers).forEach(group => {
    if (!(group instanceof L.TileLayer)) group.clearLayers();
  });
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
        draggable: isAdminFlag && f.feature_type === 'point'
      }).addTo(targetGroup);

      if (isAdminFlag && onMarkerDrag) {
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

let tempDrawingLine = null;
let drawingPoints = [];

export function startLineDrawing(onUpdate, onFinish) {
  if (tempDrawingLine) map.removeLayer(tempDrawingLine);
  drawingPoints = [];
  tempDrawingLine = L.polyline([], { color: '#0ea5e9ff', weight: 4, dashArray: '5 5' }).addTo(map);
  
  map.getContainer().style.cursor = 'crosshair';
  
  const onClick = (e) => {
    const p = [e.latlng.lng, e.latlng.lat];
    drawingPoints.push(p);
    tempDrawingLine.setLatLngs(drawingPoints.map(c => [c[1], c[0]]));
    if (onUpdate) onUpdate(drawingPoints);
  };
  
  map.on('click', onClick);

  // Return a cleanup/finish function
  return () => {
    map.off('click', onClick);
    map.getContainer().style.cursor = '';
    const finalPoints = [...drawingPoints];
    if (tempDrawingLine) {
      map.removeLayer(tempDrawingLine);
      tempDrawingLine = null;
    }
    drawingPoints = [];
    if (onFinish) onFinish(finalPoints);
  };
}
