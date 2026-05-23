import { categoryMeta } from './config.js';
import { getCategoryMeta } from './utils.js';
import { flyToFeature } from './map.js';

const modal = document.getElementById('featureModal');
const helpModal = document.getElementById('helpModal');
const featureForm = document.getElementById('featureForm');
const categorySelect = document.getElementById('f_category');

export function updateInfoCard(f, infoCardElement, isAdmin = false) {
  const content = document.getElementById('infoCardContent');
  infoCardElement.style.display = 'block';
  
  const statusColor = f.status === 'active' ? '#10b981' : f.status === 'caution' ? '#f59e0b' : '#ef4444';
  
  content.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-right: 20px; gap: 8px;">
      <h3 style="margin: 0; line-height: 1.2;">${f.name}</h3>
      <div style="display: flex; gap: 4px; flex-shrink: 0;">
        <span style="background: ${statusColor}; color: white; font-size: 9px; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; font-weight: 700;">${f.status}</span>
        ${isAdmin ? `<button class="jump-btn" id="editFeatureBtn" style="padding: 2px 6px; font-size: 9px; margin: 0;">Edit</button>` : ''}
      </div>
    </div>
    <p style="margin: 8px 0; font-size: var(--text-sm); line-height: 1.4;">${f.public_description || 'No description available.'}</p>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; border-top: 1px solid var(--color-border); padding-top: 8px;">
      <div>
        <div style="font-size: 9px; color: var(--color-text-faint); text-transform: uppercase; font-weight: 700;">Category</div>
        <div style="font-size: 11px; font-weight: 500;">${f.category}</div>
      </div>
      <div>
        <div style="font-size: 9px; color: var(--color-text-faint); text-transform: uppercase; font-weight: 700;">Officiality</div>
        <div style="font-size: 11px; font-weight: 500;">${f.officiality}</div>
      </div>
    </div>
    <div style="margin-top: 12px; display: flex; gap: 8px;">
      ${f.poster_email ? `<button class="jump-btn" id="deleteFeatureBtn" style="padding: 4px 8px; font-size: 10px; background: #fee2e2; color: #991b1b; border-color: #fecaca;">Delete Report</button>` : ''}
    </div>
    ${f.surface_note ? `<p class="note" style="margin-top: 8px;"><strong>Surface:</strong> ${f.surface_note}</p>` : ''}
    ${f.admin_note ? `<div style="background: var(--color-primary-soft); padding: 8px; border-radius: 6px; margin-top: 12px;">
      <div style="font-size: 9px; color: var(--color-primary); text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Admin Note</div>
      <div style="font-size: 11px; line-height: 1.4;">${f.admin_note}</div>
    </div>` : ''}
  `;

  if (isAdmin && document.getElementById('editFeatureBtn')) {
    document.getElementById('editFeatureBtn').onclick = () => openModal(f);
  }

  if (document.getElementById('deleteFeatureBtn')) {
    document.getElementById('deleteFeatureBtn').onclick = async () => {
      const token = prompt('Enter your unique delete token for this report:');
      if (!token) return;
      if (!confirm('Are you sure you want to permanently delete this report?')) return;
      
      try {
        const resp = await fetch(`/api/features/${f.id}?token=${token}`, { method: 'DELETE' });
        if (!resp.ok) throw new Error('Invalid token or unauthorized');
        alert('Report deleted successfully.');
        location.reload(); // Hard refresh to clear map for now, better to call refreshData if possible
      } catch (err) {
        alert(err.message);
      }
    };
  }

  document.getElementById('closeInfoCard').onclick = () => {
    infoCardElement.style.display = 'none';
  };
}

export function switchTab(tabId) {
  const tabs = ['explore', 'search', 'admin'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    const panel = document.getElementById(`panel-${t}`);
    if (t === tabId) {
      btn.classList.add('active');
      panel.style.display = 'block';
    } else {
      btn.classList.remove('active');
      panel.style.display = 'none';
    }
  });
}

export function openHelpModal() {
  helpModal.style.display = 'grid';
}

export function closeHelpModal() {
  helpModal.style.display = 'none';
}

export function openModal(f = null, type = 'point') {
  populateCategorySelect();
  modal.style.display = 'grid';
  if (f) {
    document.getElementById('modalTitle').textContent = 'Edit Feature';
    document.getElementById('f_id').value = f.id;
    document.getElementById('f_type').value = f.feature_type;
    document.getElementById('f_name').value = f.name;
    document.getElementById('f_category').value = f.category;
    document.getElementById('f_status').value = f.status;
    document.getElementById('f_officiality').value = f.officiality || 'official';
    document.getElementById('f_visibility').value = f.visibility || 'public';
    document.getElementById('f_description').value = f.public_description || '';
    document.getElementById('f_surface_note').value = f.surface_note || '';
    document.getElementById('f_longevity').value = f.longevity || 'temporary';
    document.getElementById('f_poster_email').value = f.poster_email || '';
    document.getElementById('f_geometry').value = JSON.stringify(f.geometry);
    } else {
    document.getElementById('modalTitle').textContent = `Add ${type === 'point' ? 'Point' : 'Line'}`;
    document.getElementById('f_id').value = '';
    document.getElementById('f_type').value = type;
    featureForm.reset();
    document.getElementById('f_type').value = type;
    document.getElementById('f_longevity').value = 'temporary';
    document.getElementById('f_poster_email').value = '';
    document.getElementById('f_geometry').value = type === 'point' 
    ...
      : '{"type":"LineString","coordinates":[[0,0],[0,0]]}';
  }
}

export function closeModal() {
  modal.style.display = 'none';
}

function populateCategorySelect() {
  if (categorySelect.options.length > 0) return;
  Object.keys(categoryMeta).forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });
}

export function renderLegend(features, containerElement, onFeatureJump) {
  const categorySelect = document.getElementById('categorySelect');
  const featureTiles = document.getElementById('featureTiles');
  
  if (!categorySelect || !featureTiles) return;

  const categories = [...new Set(features.map(f => f.category))].sort();
  
  // Populate category dropdown if needed
  if (categorySelect.options.length <= 1) {
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      categorySelect.appendChild(opt);
    });
  }

  const renderTiles = (selectedCat) => {
    featureTiles.innerHTML = '';
    const filtered = features.filter(f => !selectedCat || f.category === selectedCat);
    
    filtered.forEach(f => {
      const tile = document.createElement('div');
      tile.className = 'tile-btn';
      tile.textContent = f.name;
      tile.title = f.name;
      tile.addEventListener('click', () => {
        document.querySelectorAll('.tile-btn').forEach(t => t.classList.remove('active'));
        tile.classList.add('active');
        onFeatureJump(f);
      });
      featureTiles.appendChild(tile);
    });
  };

  categorySelect.onchange = (e) => renderTiles(e.target.value);

  // Initial render (show all if no category selected)
  renderTiles(categorySelect.value);
}

export function initThemeToggle() {
  const root = document.documentElement;
  const themeToggle = document.querySelector('[data-theme-toggle]');
  let theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  
  root.setAttribute('data-theme', theme);
  
  themeToggle.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
  });
}
