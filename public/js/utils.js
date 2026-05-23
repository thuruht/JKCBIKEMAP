import { categoryMeta } from './config.js';

export function getCategoryMeta(cat) {
  return categoryMeta[cat] || {swatch: '#444444ff', copy: 'Bike map feature.'};
}

export function iconFor(f) {
  const meta = getCategoryMeta(f.category);
  const statusColor = f.status === 'active' ? '#ffffffff' : f.status === 'caution' ? '#f59e0bff' : '#ef4444ff';
  const ringWidth = f.status === 'active' ? '2px' : '3px';
  
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="width:16px;height:16px;border-radius:999px;background:${meta.swatch};border:${ringWidth} solid ${statusColor};box-shadow:0 2px 8px rgba(0,0,0,.2)"></div>`,
    iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -8]
  });
}
export function createPopupContent(f) {
  // Privacy-first: ensure descriptions are sanitized of common leak patterns
  const safeDescription = (f.public_description || '')
    .replace(/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/g, '[REDACTED IP]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED EMAIL]');

  return `
    <div style="font-family: var(--font-body); font-size: var(--text-sm);">
      <strong style="font-family: var(--font-display); font-size: var(--text-base);">${f.name}</strong><br>
      <div style="margin-top: 4px;">${safeDescription}</div>
...
      <hr style="margin: 8px 0; border: 0; border-top: 1px solid var(--color-border);">
      <div style="font-size: var(--text-xs); color: var(--color-text-muted); line-height: 1.4;">
        <strong>Status:</strong> ${f.status}<br>
        <strong>Type:</strong> ${f.officiality}<br>
        ${f.surface_note ? `<strong>Surface:</strong> ${f.surface_note}<br>` : ''}
        ${f.last_verified_at ? `<strong>Verified:</strong> ${new Date(f.last_verified_at).toLocaleDateString()}` : ''}
      </div>
    </div>
  `;
}

export function downloadGeoJSON(features) {
  const geojson = {
    type: 'FeatureCollection',
    features: features.map(f => ({
      type: 'Feature',
      id: f.id,
      geometry: f.geometry,
      properties: {
        name: f.name,
        slug: f.slug,
        feature_type: f.feature_type,
        category: f.category,
        status: f.status,
        officiality: f.officiality,
        public_description: f.public_description,
        surface_note: f.surface_note,
        weather_sensitivity: f.weather_sensitivity,
        last_verified_at: f.last_verified_at
      }
    }))
  };

  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jojomap-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
