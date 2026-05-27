import { categoryMeta } from './config.js';

export function getCategoryMeta(cat) {
  return categoryMeta[cat] || {swatch: '#444444ff', copy: 'Bike map feature.'};
}

export function iconFor(f) {
  const meta = getCategoryMeta(f.category);
  const statusColor = f.status === 'active' ? '#ffffffff' : f.status === 'caution' ? '#f59e0bff' : '#ef4444ff';
  const ringWidth = f.status === 'active' ? '2px' : '4px';
  const iconHtml = meta.icon || '📍';
  
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="width:28px;height:28px;border-radius:999px;background:${meta.swatch};border:${ringWidth} solid ${statusColor};box-shadow:var(--shadow-md);display:grid;place-items:center;font-size:16px;">${iconHtml}</div>`,
    iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14]
  });
}
export function createPopupContent(f) {
  // Privacy-first: ensure descriptions are sanitized of common leak patterns
  const safeDescription = (f.public_description || '')
    .replace(/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/g, '[REDACTED IP]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED EMAIL]');

  return `
    <div style="font-family: var(--font-body); font-size: var(--text-sm); padding: 4px;">
      <strong style="font-family: var(--font-display); font-size: var(--text-base); display: block; margin-bottom: 4px; line-height: 1.1;">${f.name}</strong>
      <div style="line-height: 1.4; color: var(--color-text-muted);">${safeDescription}</div>
      <hr style="margin: 12px 0; border: 0; border-top: 1px solid var(--color-border);">
      <div style="font-size: var(--text-xs); color: var(--color-text-muted); line-height: 1.6;">
        <span style="font-weight: 700; text-transform: uppercase; color: var(--color-primary);">Status:</span> ${f.status}<br>
        <span style="font-weight: 700; text-transform: uppercase; color: var(--color-primary);">Type:</span> ${f.officiality}<br>
        ${f.surface_note ? `<span style="font-weight: 700; text-transform: uppercase; color: var(--color-primary);">Surface:</span> ${f.surface_note}<br>` : ''}
        ${f.last_verified_at ? `<span style="font-weight: 700; text-transform: uppercase; color: var(--color-primary);">Verified:</span> ${new Date(f.last_verified_at).toLocaleDateString()}` : ''}
      </div>
    </div>
  `;
}

export function getAvatarHtml(user, sizeClass = 'avatar-sm') {
  if (user.avatar_url) {
    return `<img src="${user.avatar_url}" class="${sizeClass}" style="object-fit: cover; border-radius: 50%;">`;
  }
  const name = user.username || user.email || 'Anonymous';
  const initial = name.charAt(0).toUpperCase();
  const colors = ['#7a9a8c', '#4f98a3', '#a0512d', '#6b5cff', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
  const color = colors[Math.abs(name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length];
  
  return `
    <div class="${sizeClass}" style="background: ${color}; color: white; display: grid; place-items: center; font-weight: 700; border-radius: 50%; text-transform: uppercase; font-size: ${sizeClass === 'avatar-large' ? '32px' : '14px'};">
      ${initial}
    </div>
  `;
}

export function getBadgeClass(badgeName) {
  const name = badgeName.toLowerCase();
  if (name.includes('n00b')) return 'badge-noob';
  if (name.includes('legend') || name.includes('master')) return 'badge-gold';
  if (name.includes('pioneer') || name.includes('vanguard')) return 'badge-purple';
  if (name.includes('hunter')) return 'badge-blue';
  if (name.includes('finder')) return 'badge-orange';
  if (name.includes('verified')) return 'badge-green';
  if (name.includes('alert') || name.includes('hazard')) return 'badge-red';
  return 'badge-primary';
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
