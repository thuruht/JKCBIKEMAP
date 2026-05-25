import { categoryMeta } from './config.js';
import { getCategoryMeta } from './utils.js';
import { flyToFeature } from './map.js';
import { hideContent } from './api.js';

const modal = document.getElementById('featureModal');
const helpModal = document.getElementById('helpModal');
const featureForm = document.getElementById('featureForm');
const categorySelect = document.getElementById('f_category');

function hasPermission(perms, p) {
  return perms && perms.includes(p);
}

export function updateInfoCard(f, infoCardElement, userPermissions = []) {
  const content = document.getElementById('infoCardContent');
  
  if (infoCardElement.style.display === 'none' || !infoCardElement.style.display) {
    infoCardElement.style.display = 'block';
    gsap.fromTo(infoCardElement, 
      { x: 50, opacity: 0 }, 
      { x: 0, opacity: 1, duration: 0.4, ease: "power2.out" }
    );
  }

  const statusColor = f.status === 'active' ? '#10b981ff' : f.status === 'caution' ? '#f59e0bff' : '#ef4444ff';
  const catIcon = f.category === 'Pedestrian or walking bridges' ? '🌉' : 
                  f.category === 'Trail spines' ? '🌿' : 
                  f.category === 'Field Reports' ? '⚠️' : 
                  f.category === 'Rider Amenities' ? '⛲' : 
                  f.category === 'Key parks' ? '🌳' : '📍';

  const canEditAny = hasPermission(userPermissions, "feature.any.update");
  const canEditPublic = hasPermission(userPermissions, "feature.any.update_public_fields");
  const canHide = hasPermission(userPermissions, "feature.any.hide");
  const canDelete = hasPermission(userPermissions, "feature.any.hard_delete");
  const isSensitive = f.visibility === 'sensitive';
  const canReadSensitive = hasPermission(userPermissions, "feature.sensitive.read");
  const canReadMod = hasPermission(userPermissions, "feature.sensitive.moderation_read");

  let description = f.public_description || 'No detailed knowledge provided yet.';
  if (isSensitive && !canReadSensitive && !canReadMod) {
    description = '<span style="font-style:italic; opacity:0.6;">Detailed knowledge restricted to established contributors.</span>';
  }

  content.innerHTML = `
    <button id="closeInfoCard" style="position: absolute; top: 12px; right: 12px; width: 24px; height: 24px; border-radius: 999px; background: var(--color-surface-offset); display: grid; place-items: center; font-size: 14px; color: var(--color-text-faint); border: 1px solid var(--color-border); cursor: pointer; z-index: 10;">×</button>
    <div style="margin-bottom: var(--space-4); padding-right: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <small>${f.category}</small>
        <div style="display: flex; gap: 4px;">
          ${(canEditAny || canEditPublic) ? `<button class="jump-btn" id="editFeatureBtn" style="padding: 2px 8px; font-size: 10px; background: var(--color-surface-offset);">Edit</button>` : ''}
          ${canHide ? `<button class="jump-btn" id="hideFeatureBtn" style="padding: 2px 8px; font-size: 10px; background: #fee2e2ff; color: #991b1bff;">Hide</button>` : ''}
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3);">
        <h3 style="margin: 0; line-height: 1.1; flex: 1;">${catIcon} ${f.name}</h3>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
          <div style="width: 14px; height: 14px; border-radius: 999px; background: ${statusColor}; border: 3px solid white; box-shadow: 0 0 0 1px ${statusColor}; flex: none;"></div>
          ${isSensitive ? '<span title="Sensitive: Use discretion" style="font-size: 14px; cursor: help;">🤫</span>' : ''}
        </div>
      </div>
    </div>

    <div style="display: flex; gap: 4px; margin-bottom: var(--space-4);">
      <span style="font-size: 9px; font-weight: 700; color: var(--color-text-faint); background: var(--color-surface-offset); padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">Confidence: ${f.source_confidence || 'medium'}</span>
      ${f.last_verified_at ? `<span style="font-size: 9px; font-weight: 700; color: var(--color-primary); background: var(--color-primary-soft); padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">Verified ${new Date(f.last_verified_at).toLocaleDateString()}</span>` : ''}
    </div>

    <div style="font-size: var(--text-base); line-height: 1.5; color: var(--color-text); margin-bottom: var(--space-5); font-weight: 500;">
      ${description}
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
      <button class="jump-btn" id="shareFeatureBtn" style="padding: 8px 16px; font-size: 12px; font-weight: 700; background: var(--color-surface-offset); border: 1px solid var(--color-border);">Share</button>
      ${f.poster_email ? `<button class="jump-btn" id="deleteFeatureBtn" style="padding: 8px 12px; font-size: 11px; background: #fee2e2ff; color: #991b1bff; border: 1px solid #fecacaff; font-weight: 600;">Delete My Report</button>` : ''}
    </div>

    ${f.surface_note && (!isSensitive || canReadSensitive || canReadMod) ? `<p class="note"><strong>Rider Surface Note:</strong> ${f.surface_note}</p>` : ''}
    ${f.risk_note ? `<p class="note" style="border-left-color: #ef4444ff;"><strong>⚠️ Rider Risk Note:</strong> ${f.risk_note}</p>` : ''}
    ${f.weather_sensitivity && f.weather_sensitivity !== 'none' ? `<p class="note" style="border-left-color: #3b82f6ff;"><strong>🌧️ Weather Note:</strong> ${f.weather_sensitivity}</p>` : ''}
    
    ${f.admin_note && canReadSensitive ? `<div style="background: var(--color-primary-soft); padding: var(--space-3); border-radius: var(--radius-md); margin-top: var(--space-4); border: 1px solid var(--color-primary);">
      <div style="font-size: 10px; color: var(--color-primary); text-transform: uppercase; font-weight: 800; margin-bottom: 4px; letter-spacing: 0.05em;">Staff Internal Note</div>
      <div style="font-size: 13px; line-height: 1.4; font-weight: 500;">${f.admin_note}</div>
    </div>` : ''}

    <div id="featureDetailsAsync" style="margin-top: var(--space-4); border-top: 1px solid var(--color-border); padding-top: var(--space-4);">
      <div style="font-size: 10px; opacity: 0.5;">Loading community knowledge...</div>
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
           html += data.comments.map(c => `<div class="note" style="margin-bottom: 8px;"><strong><a href="#" onclick="event.preventDefault(); window.openPublicProfileModal('${c.author_name}')" style="color: var(--color-primary); text-decoration: none;">${c.author_name}</a></strong>: ${c.body} <br><small>${new Date(c.created_at).toLocaleDateString()}</small></div>`).join('');
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
               updateInfoCard(f, infoCardElement, userPermissions);
            });
          }
        }
      })
      .catch(e => {
        const detailsDiv = document.getElementById('featureDetailsAsync');
        if (detailsDiv) detailsDiv.innerHTML = '<div style="font-size:10px; color:red;">Failed to load knowledge.</div>';
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
        location.reload(); 
      } catch (err) {
        alert(err.message);
      } finally {
        checkInBtn.disabled = false;
        checkInBtn.textContent = 'Check-In Here';
      }
    };
  }

  const editBtn = document.getElementById('editFeatureBtn');
  if (editBtn) {
    editBtn.onclick = () => openModal(f);
  }

  const hideBtn = document.getElementById('hideFeatureBtn');
  if (hideBtn) {
    hideBtn.onclick = async () => {
      if (!confirm('Hide this feature from the public map?')) return;
      try {
        await hideContent('feature', f.id);
        alert('Feature hidden.');
        location.reload();
      } catch (err) {
        alert('Failed: ' + err.message);
      }
    };
  }

  const shareFeatBtn = document.getElementById('shareFeatureBtn');
  if (shareFeatBtn) {
    shareFeatBtn.onclick = async () => {
      const url = `${window.location.origin}/#feature=${f.id}`;
      if (navigator.share) {
        try {
          await navigator.share({
            title: `${f.name} on JOJO's KC Bike Map`,
            url: url
          });
        } catch (err) {
          console.warn("Share failed:", err);
        }
      } else {
        navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
      }
    };
  }

  const delBtn = document.getElementById('deleteFeatureBtn');
  if (delBtn) {
    delBtn.onclick = async () => {
      const token = prompt('Enter your unique delete token for this report:');
      if (!token) return;
      if (!confirm('Are you sure you want to permanently delete this report?')) return;
      
      try {
        const resp = await fetch(`/api/features/${f.id}?token=${token}`, { method: 'DELETE' });
        if (!resp.ok) throw new Error('Invalid token or unauthorized');
        alert('Report deleted successfully.');
        location.reload();
      } catch (err) {
        alert(err.message);
      }
    };
  }

  const closeInfoCardBtn = document.getElementById('closeInfoCard');
  if (closeInfoCardBtn) {
    closeInfoCardBtn.addEventListener('click', () => {
      infoCardElement.style.display = 'none';
    });
  }
}

export function switchTab(tabId) {
  const tabs = ['explore', 'search', 'community', 'messages', 'admin'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    const panel = document.getElementById(`panel-${t}`);
    if (t === tabId) {
      if (btn) btn.classList.add('active');
      if (panel) {
        panel.style.display = 'block';
        gsap.fromTo(panel, 
          { opacity: 0, y: 10 }, 
          { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }
        );
      }
    } else {
      if (btn) btn.classList.remove('active');
      if (panel) panel.style.display = 'none';
    }
  });
}

export function openHelpModal() {
  helpModal.style.display = 'grid';
}
window.openHelpModal = openHelpModal;

export function closeHelpModal() {
  helpModal.style.display = 'none';
}

export function openModal(f = null, type = 'point', preventReset = false) {
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
    
    const sourceList = document.getElementById('sourceLinksList');
    sourceList.innerHTML = '';
    fetch(`/api/features/${f.id}/details`)
      .then(r => r.json())
      .then(data => {
        data.sources.forEach(s => addSourceLinkRow(s.source_url, s.source_note));
      });
  } else if (!preventReset) {
    document.getElementById('modalTitle').textContent = `Add ${type === 'point' ? 'Point' : 'Line'}`;
    document.getElementById('f_id').value = '';
    document.getElementById('f_type').value = type;
    featureForm.reset();
    document.getElementById('f_type').value = type;
    document.getElementById('f_longevity').value = 'temporary';
    document.getElementById('f_poster_email').value = '';
    document.getElementById('f_weather').value = 'none';
    document.getElementById('f_confidence').value = 'medium';
    document.getElementById('f_geometry').value = '';
    document.getElementById('sourceLinksList').innerHTML = '';
  }
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

    gsap.fromTo(featureTiles.children, 
      { scale: 0.9, opacity: 0 }, 
      { scale: 1, opacity: 1, duration: 0.3, stagger: 0.02, ease: "back.out(1.4)" }
    );
  };

  categorySelect.onchange = (e) => renderTiles(e.target.value);
  renderTiles(categorySelect.value);
}

export function initThemeToggle() {
  const root = document.documentElement;
  const themeToggle = document.querySelector('[data-theme-toggle]');
  let theme = localStorage.getItem('theme') || 'dark';
  root.setAttribute('data-theme', theme);
  
  themeToggle.addEventListener('click', async () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    const syncToggle = document.getElementById('syncThemeBasemap');
    if (syncToggle && syncToggle.checked) {
      const basemapSelect = document.getElementById('basemapSelect');
      if (basemapSelect) {
        const targetBasemap = theme === 'dark' ? 'night' : 'pioneer';
        const { switchBasemap } = await import('./map.js');
        switchBasemap(targetBasemap);
        basemapSelect.value = targetBasemap;
      }
    }
    const hasSession = document.cookie.includes('session=');
    if (hasSession) {
      try {
        const basemapSelect = document.getElementById('basemapSelect');
        const currentBasemap = basemapSelect ? basemapSelect.value : 'pioneer';
        await fetch('/api/me/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: theme, basemap: currentBasemap })
        });
      } catch (err) {
        console.error('Failed to sync theme preference:', err);
      }
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeHelpModal();
      if (document.getElementById('profileEditModal')) document.getElementById('profileEditModal').style.display = 'none';
      if (document.getElementById('publicProfileModal')) document.getElementById('publicProfileModal').style.display = 'none';
    }
  });
}

// --- Profile Modal Logic ---
import { fetchProfile } from './api.js';

export function openProfileEditModal(user) {
  const profileModal = document.getElementById('profileEditModal');
  if (!profileModal) return;

  document.getElementById('f_profile_username').value = user.username || '';
  document.getElementById('f_profile_bio').value = user.bio || '';
  if (user.avatar_url) {
    document.getElementById('editAvatarPreview').src = user.avatar_url;
  }
  
  const socialList = document.getElementById('profileSocialLinksList');
  socialList.innerHTML = '';
  if (user.social_links) {
    user.social_links.forEach(link => addProfileSocialLinkRow(link));
  }

  const addSocialBtn = document.getElementById('addProfileSocialLinkBtn');
  addSocialBtn.onclick = () => addProfileSocialLinkRow();

  const enableDmsBtn = document.getElementById('enableDmsBtn');
  const backupSection = document.getElementById('dmBackupSection');
  if (user.public_key) {
    enableDmsBtn.style.display = 'none';
    backupSection.style.display = 'flex';
  } else {
    enableDmsBtn.style.display = 'block';
    backupSection.style.display = 'none';
  }

  document.getElementById('closeProfileModalBtn').onclick = () => {
    profileModal.style.display = 'none';
  };

  profileModal.style.display = 'flex';
}

function addProfileSocialLinkRow(url = '') {
  const container = document.getElementById('profileSocialLinksList');
  const div = document.createElement('div');
  div.className = 'profile-social-row';
  div.style.display = 'flex';
  div.style.gap = '4px';
  div.style.marginBottom = '4px';
  div.innerHTML = `
    <input type="url" class="social-url jump-btn" style="flex: 1; font-size: 10px;" placeholder="https://..." value="${url}">
    <button type="button" class="jump-btn" style="width: auto; padding: 2px 6px; color: red;" onclick="this.parentElement.remove()">×</button>
  `;
  container.appendChild(div);
}

export async function openPublicProfileModal(username) {
  const publicModal = document.getElementById('publicProfileModal');
  const content = document.getElementById('publicProfileContent');
  if (!publicModal || !content) return;

  content.innerHTML = '<div style="text-align: center; opacity: 0.5;">Loading profile...</div>';
  publicModal.style.display = 'flex';
  
  document.getElementById('closePublicProfileBtn').onclick = () => {
    publicModal.style.display = 'none';
  };

  try {
    const data = await fetchProfile(username);
    const { profile, features, badges } = data;

    let html = `
      <div style="display: flex; gap: var(--space-4); align-items: flex-start; margin-bottom: var(--space-4);">
        <img src="${profile.avatar_url || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%23ccc%22/></svg>'}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;">
        <div style="flex: 1;">
          <h2 style="margin: 0;">${profile.username}</h2>
          <p style="font-size: 11px; opacity: 0.6; margin-bottom: 4px;">Reputation: ${profile.reputation_score || 0} XP</p>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            ${(profile.social_links || []).map(l => `<a href="${l}" target="_blank" style="font-size: 10px; color: var(--color-primary); background: var(--color-primary-soft); padding: 2px 6px; border-radius: 4px; text-decoration: none;">Link</a>`).join('')}
          </div>
        </div>
      </div>
      
      ${profile.bio ? `<p style="font-size: 13px; line-height: 1.5; margin-bottom: var(--space-4);">${profile.bio}</p>` : ''}
    `;
if (badges && badges.length > 0) {
  const badgeParam = window.location.hash.startsWith('#badge=') ? decodeURIComponent(window.location.hash.split('=')[1]) : null;
  
  html += `
    <div style="margin-bottom: var(--space-4);">
      <h3 style="font-size: 12px; text-transform: uppercase; margin-bottom: 8px;">Badges</h3>
      <div style="display: flex; gap: 8px; flex-wrap: wrap; padding: 4px;">
        ${badges.map(b => {
          const isHighlighted = b.name === badgeParam;
          return `
          <div style="display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; background: ${isHighlighted ? 'var(--color-primary)' : 'var(--color-primary-soft)'}; border: 1px solid var(--color-primary); transition: all 0.3s ease; ${isHighlighted ? 'transform: scale(1.05); box-shadow: 0 0 12px var(--color-primary);' : ''}">
            <div style="font-size: 10px; font-weight: 700; color: ${isHighlighted ? 'white' : 'var(--color-primary)'}; text-transform: uppercase;" title="${b.description}">${b.name}</div>
            <button onclick="event.preventDefault(); window.shareBadge('${b.name}', '${profile.username}')" style="font-size: 10px; opacity: 0.7; cursor: pointer; padding: 0 4px; background: none; border: none; color: ${isHighlighted ? 'white' : 'var(--color-primary)'};">🔗</button>
          </div>
        `}).join('')}
      </div>
    </div>
  `;
}

content.innerHTML = html;

window.shareBadge = async (badgeName, username) => {
  const url = `${window.location.origin}/rider/${username}#badge=${encodeURIComponent(badgeName)}`;
  const text = `${username} earned the ${badgeName} badge on JOJO's KC Bike Map! 🚲🏆`;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Badge Earned!', text, url });
    } catch (err) { console.warn(err); }
  } else {
    navigator.clipboard.writeText(`${text} ${url}`);
    alert('Badge link copied to clipboard!');
  }
};
    if (features && features.length > 0) {
      html += `
        <div>
          <h3 style="font-size: 12px; text-transform: uppercase; margin-bottom: 8px;">Recent Contributions</h3>
          <div style="display: flex; flex-direction: column; gap: 4px; max-height: 200px; overflow-y: auto;">
            ${features.map(f => `<div style="padding: 8px; background: var(--color-bg); border-radius: 4px; font-size: 11px;"><strong>${f.name}</strong> <span style="opacity: 0.6;">(${f.category})</span></div>`).join('')}
          </div>
        </div>
      `;
    }

    content.innerHTML = html;

    const messageBtn = document.getElementById('messageUserBtn');
    if (messageBtn) {
      if (window.currentUser && window.currentUser.id !== profile.id && profile.public_key) {
        messageBtn.style.display = 'block';
        messageBtn.onclick = async () => {
          publicModal.style.display = 'none';
          const chatModule = await import('./chat.js');
          chatModule.openChat(window.currentUser, profile);
        };
      } else {
        messageBtn.style.display = 'none';
      }
    }

    const shareBtn = document.getElementById('shareProfileBtn');
    if (shareBtn) {
      shareBtn.onclick = async () => {
        const url = `${window.location.origin}/rider/${profile.username}`;
        if (navigator.share) {
          try {
            await navigator.share({
              title: `${profile.username} on JOJO's KC Bike Map`,
              url: url
            });
          } catch (err) {
            console.warn("Share failed:", err);
          }
        } else {
          navigator.clipboard.writeText(url);
          alert('Link copied to clipboard!');
        }
      };
    }

  } catch (err) {
    content.innerHTML = `<div style="text-align: center; color: red;">${err.message}</div>`;
  }
}
window.openPublicProfileModal = openPublicProfileModal;
