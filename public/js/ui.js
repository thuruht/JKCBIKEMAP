import { categoryMeta } from './config.js';
import { getCategoryMeta } from './utils.js';
import { flyToFeature } from './map.js';

const modal = document.getElementById('featureModal');
const helpModal = document.getElementById('helpModal');
const featureForm = document.getElementById('featureForm');
const categorySelect = document.getElementById('f_category');

export function updateInfoCard(f, infoCardElement, isAdmin = false) {
  const content = document.getElementById('infoCardContent');
  
  if (infoCardElement.style.display === 'none' || !infoCardElement.style.display) {
    infoCardElement.style.display = 'block';
    gsap.fromTo(infoCardElement, 
      { x: 50, opacity: 0 }, 
      { x: 0, opacity: 1, duration: 0.4, ease: "power2.out" }
    );
  }

  const statusColor = f.status === 'active' ? '#10b981ff' : f.status === 'caution' ? '#f59e0bff' : '#ef4444ff';
  
  // Category-based icon shorthand for accessibility
  const catIcon = f.category === 'Pedestrian or walking bridges' ? '🌉' : 
                  f.category === 'Trail spines' ? '🌿' : 
                  f.category === 'Field Reports' ? '⚠️' : 
                  f.category === 'Rider Amenities' ? '⛲' : 
                  f.category === 'Key parks' ? '🌳' : '📍';

  content.innerHTML = `
    <div style="margin-bottom: var(--space-4);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <small>${f.category}</small>
        ${(isAdmin && f.id) ? `<button class="jump-btn" id="editFeatureBtn" style="padding: 2px 8px; font-size: 10px; background: var(--color-surface-offset);">Edit Intelligence</button>` : ''}
      </div>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3);">
        <h3 style="margin: 0; line-height: 1.1; flex: 1;">${catIcon} ${f.name}</h3>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
          <div style="width: 14px; height: 14px; border-radius: 999px; background: ${statusColor}; border: 3px solid white; box-shadow: 0 0 0 1px ${statusColor}; flex: none;"></div>
          ${f.visibility === 'sensitive' ? '<span title="Sensitive: Use discretion" style="font-size: 14px; cursor: help;">🤫</span>' : ''}
        </div>
      </div>
    </div>

    <div style="display: flex; gap: 4px; margin-bottom: var(--space-4);">
      <span style="font-size: 9px; font-weight: 700; color: var(--color-text-faint); background: var(--color-surface-offset); padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">Confidence: ${f.source_confidence || 'medium'}</span>
      ${f.last_verified_at ? `<span style="font-size: 9px; font-weight: 700; color: var(--color-primary); background: var(--color-primary-soft); padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">Verified ${new Date(f.last_verified_at).toLocaleDateString()}</span>` : ''}
    </div>

    <div style="font-size: var(--text-base); line-height: 1.5; color: var(--color-text); margin-bottom: var(--space-5); font-weight: 500;">
      ${f.public_description || 'No detailed intel provided yet.'}
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); border-top: 1px solid var(--color-border); padding-top: var(--space-4); margin-bottom: var(--space-4);">
      <div>
        <div style="font-size: 10px; color: var(--color-text-faint); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Current Status</div>
        <div style="font-size: 14px; font-weight: 700; color: ${statusColor}; text-transform: capitalize;">${f.status}</div>
      </div>
      <div>
        <div style="font-size: 10px; color: var(--color-text-faint); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Officiality</div>
        <div style="font-size: 14px; font-weight: 700;">${f.officiality}</div>
      </div>
    </div>

    <div style="display: flex; gap: var(--space-3); flex-wrap: wrap; margin-bottom: var(--space-2);">
      <button class="jump-btn" id="checkInBtn" style="padding: 8px 16px; font-size: 12px; font-weight: 700; background: var(--color-primary); color: white; border: none; display: none;">Check-In Here</button>
      ${f.poster_email ? `<button class="jump-btn" id="deleteFeatureBtn" style="padding: 8px 12px; font-size: 11px; background: #fee2e2ff; color: #991b1bff; border: 1px solid #fecacaff; font-weight: 600;">Delete My Report</button>` : ''}
    </div>

    ${f.surface_note ? `<p class="note"><strong>Rider Surface Note:</strong> ${f.surface_note}</p>` : ''}
    ${f.risk_note ? `<p class="note" style="border-left-color: #ef4444ff;"><strong>⚠️ Rider Risk Note:</strong> ${f.risk_note}</p>` : ''}
    ${f.weather_sensitivity && f.weather_sensitivity !== 'none' ? `<p class="note" style="border-left-color: #3b82f6ff;"><strong>🌧️ Weather Note:</strong> ${f.weather_sensitivity}</p>` : ''}
    
    ${f.admin_note ? `<div style="background: var(--color-primary-soft); padding: var(--space-3); border-radius: var(--radius-md); margin-top: var(--space-4); border: 1px solid var(--color-primary);">
      <div style="font-size: 10px; color: var(--color-primary); text-transform: uppercase; font-weight: 800; margin-bottom: 4px; letter-spacing: 0.05em;">Admin Internal Note</div>
      <div style="font-size: 13px; line-height: 1.4; font-weight: 500;">${f.admin_note}</div>
    </div>` : ''}

    <div id="featureDetailsAsync" style="margin-top: var(--space-4); border-top: 1px solid var(--color-border); padding-top: var(--space-4);">
      <div style="font-size: 10px; opacity: 0.5;">Loading community intel...</div>
    </div>
  `;

  const checkInBtn = document.getElementById('checkInBtn');
  const hasSession = document.cookie.includes('session=');
  
  if (f.id && !f.id.startsWith('marc-')) {
    fetch(`/api/features/${f.id}/details`)
      .then(r => r.ok ? r.json() : { comments: [], reports: [], sources: [] })
      .then(data => {
        const detailsDiv = document.getElementById('featureDetailsAsync');
        if (!detailsDiv) return;

        let html = '';
        
        if (data.sources && data.sources.length > 0) {
           html += `<div style="margin-bottom: 10px;"><strong style="font-size: 12px; color: var(--color-primary);">Verified Sources</strong></div>`;
           html += data.sources.map(s => `<div class="note" style="margin-bottom: 8px;">🔗 <a href="${s.source_url}" target="_blank" style="color: var(--color-primary);">${s.source_note || 'External Link'}</a> <br><small>Confidence: ${s.confidence || 'unknown'}</small></div>`).join('');
        }

        if (data.reports && data.reports.length > 0) {
           html += `<div style="margin-bottom: 10px;"><strong style="font-size: 12px; color: var(--color-primary);">Field Reports</strong></div>`;
           html += data.reports.map(r => `<div class="note" style="margin-bottom: 8px;"><strong>${r.report_type}:</strong> ${r.description} <br><small>${new Date(r.created_at).toLocaleDateString()}</small></div>`).join('');
        }
        
        html += `<div style="margin-bottom: 10px; margin-top: 15px;"><strong style="font-size: 12px; color: var(--color-primary);">Community Discussion</strong></div>`;
        if (data.comments && data.comments.length > 0) {
           html += data.comments.map(c => `<div class="note" style="margin-bottom: 8px;"><strong>${c.author_name}</strong>: ${c.body} <br><small>${new Date(c.created_at).toLocaleDateString()}</small></div>`).join('');
        } else {
           html += `<div style="font-size: 11px; opacity: 0.7; margin-bottom: 10px;">No comments yet.</div>`;
        }
        
        if (hasSession) {
          html += `
            <div style="margin-top:10px; display: flex; gap: 8px;">
              <input type="text" id="newCommentInput" placeholder="Add a comment..." style="flex: 1; padding: 6px; font-size: 12px; background: var(--color-surface-offset); border: 1px solid var(--color-border); color: var(--color-text);">
              <button id="submitCommentBtn" class="jump-btn" style="padding: 6px 12px;">Post</button>
            </div>
          `;
        } else {
          html += `<div style="font-size: 11px; opacity: 0.7; font-style: italic;">Log in to join the discussion.</div>`;
        }

        detailsDiv.innerHTML = html;

        if (hasSession) {
          const subBtn = document.getElementById('submitCommentBtn');
          if (subBtn) {
            subBtn.addEventListener('click', async () => {
               const val = document.getElementById('newCommentInput').value;
               if (!val) return;
               subBtn.disabled = true;
               subBtn.textContent = '...';
               await fetch(`/api/features/${f.id}/comments`, {
                 method: 'POST', 
                 headers: {'Content-Type':'application/json'},
                 body: JSON.stringify({body: val})
               });
               updateInfoCard(f, infoCardElement, isAdmin);
            });
          }
        }
      })
      .catch(e => {
        const detailsDiv = document.getElementById('featureDetailsAsync');
        if (detailsDiv) detailsDiv.innerHTML = '<div style="font-size:10px; color:red;">Failed to load intel.</div>';
      });
  } else if (f.id && f.id.startsWith('marc-')) {
    const detailsDiv = document.getElementById('featureDetailsAsync');
    if (detailsDiv) detailsDiv.style.display = 'none';
  }

  if (hasSession && checkInBtn) {
    checkInBtn.style.display = 'block';
    checkInBtn.onclick = async () => {
      try {
        checkInBtn.disabled = true;
        checkInBtn.textContent = 'Verifying...';
        const resp = await fetch('/api/checkpoints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feature_id: f.id, type: 'passage' })
        });
        if (!resp.ok) throw new Error('Check-in failed');
        const res = await resp.json();
        alert(`Verified! +2 XP earned. ${res.badge_unlocked ? `Unlocked Badge: ${res.badge_unlocked}!` : ''}`);
        location.reload(); // Refresh to update levels/badges
      } catch (err) {
        alert(err.message);
      } finally {
        checkInBtn.disabled = false;
        checkInBtn.textContent = 'Check-In Here';
      }
    };
  }

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
      gsap.fromTo(panel, 
        { opacity: 0, y: 10 }, 
        { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }
      );
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
    document.getElementById('f_risk_note').value = f.risk_note || '';
    document.getElementById('f_weather').value = f.weather_sensitivity || 'none';
    document.getElementById('f_confidence').value = f.source_confidence || 'medium';
    document.getElementById('f_longevity').value = f.longevity || 'temporary';
    document.getElementById('f_poster_email').value = f.poster_email || '';
    document.getElementById('f_geometry').value = JSON.stringify(f.geometry);
    
    // Load sources
    const sourceList = document.getElementById('sourceLinksList');
    sourceList.innerHTML = '';
    fetch(`/api/features/${f.id}/details`)
      .then(r => r.json())
      .then(data => {
        data.sources.forEach(s => addSourceLinkRow(s.source_url, s.source_note));
      });
  } else {
    document.getElementById('modalTitle').textContent = `Add ${type === 'point' ? 'Point' : 'Line'}`;
    document.getElementById('f_id').value = '';
    document.getElementById('f_type').value = type;
    featureForm.reset();
    document.getElementById('f_type').value = type;
    document.getElementById('f_longevity').value = 'temporary';
    document.getElementById('f_poster_email').value = '';
    document.getElementById('f_weather').value = 'none';
    document.getElementById('f_confidence').value = 'medium';
    document.getElementById('f_geometry').value = type === 'point' 
      ? '{"type":"Point","coordinates":[0,0]}' 
      : '{"type":"LineString","coordinates":[[0,0],[0,0]]}';
    document.getElementById('sourceLinksList').innerHTML = '';
  }

  // Handle source link adding
  const addSourceBtn = document.getElementById('addSourceLinkBtn');
  addSourceBtn.onclick = () => addSourceLinkRow();
}

function addSourceLinkRow(url = '', note = '') {
  const container = document.getElementById('sourceLinksList');
  const div = document.createElement('div');
  div.className = 'source-link-row';
  div.style.display = 'flex';
  div.style.gap = '4px';
  div.style.marginBottom = '4px';
  div.innerHTML = `
    <input type="text" class="source-url jump-btn" style="flex: 2; font-size: 10px;" placeholder="URL" value="${url}">
    <input type="text" class="source-note jump-btn" style="flex: 1; font-size: 10px;" placeholder="Label" value="${note}">
    <button type="button" class="jump-btn" style="width: auto; padding: 2px 6px; color: red;" onclick="this.parentElement.remove()">×</button>
  `;
  container.appendChild(div);
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

    // GSAP stagger animation for tiles
    gsap.fromTo(featureTiles.children, 
      { scale: 0.9, opacity: 0 }, 
      { scale: 1, opacity: 1, duration: 0.3, stagger: 0.02, ease: "back.out(1.4)" }
    );
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

  // Global Escape key to close modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeHelpModal();
    }
  });
}
