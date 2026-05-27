import { fetchFeatures, createFeature, updateFeature, fetchMe, assignUserRole, fetchPublicProfiles, fetchCommunityStats } from './api.js';
import { initLeafletMap, renderMap, flyToFeature, enableMapPicker, toggleLayer, fetchAmenities, map, switchBasemap, toggleOverlay, startLineDrawing } from './map.js';
import { updateInfoCard, renderLegend, initThemeToggle, openModal, closeModal, openHelpModal, closeHelpModal, switchTab } from './ui.js';
import { downloadGeoJSON, getCategoryMeta } from './utils.js';

// DOM Elements (Global references assigned in init)
let infoCard, legendStack, searchInput, helpBtn, quickReportBtn, adminActions, exportGeoJsonBtn, importMarcBtn, addPointBtn, addLineBtn, featureForm, basemapSelect, saveDefaultBasemapBtn;
let adminAuthRequired, moderationQueueSection, moderationQueueList, roleManagementSection, targetUserEmail, targetUserRole, assignRoleBtn, featureActions;
let tabExplore, tabSearch, tabCommunity, tabMessages, tabAdmin;
let sendMagicLinkBtn, loginEmailInput, userLoggedOutView, userLoggedInView, userEmailDisplay, userLogoutBtn;

let allFeatures = [];
let currentUser = null;
let userPermissions = [];
let searchAbortController = null;

function hasPermission(p) {
  return userPermissions.includes(p);
}

function checkIsStaff() {
  return hasPermission('feature.any.hide') || 
         hasPermission('feature.any.update_public_fields') || 
         hasPermission('user.role.assign');
}

function updateAdminUI() {
  const isAdmin = hasPermission('user.role.assign');
  const isStaff = checkIsStaff();

  if (currentUser) {
    if (adminAuthRequired) adminAuthRequired.style.display = 'none';
    if (adminActions) adminActions.style.display = isStaff ? 'block' : 'none';

    // Feature Actions (Moderators + Admins)
    if (featureActions) featureActions.style.display = (isStaff || isAdmin) ? 'block' : 'none';

    // Moderation Queue (Moderators + Admins)
    if (moderationQueueSection) {
      moderationQueueSection.style.display = hasPermission('report.read') ? 'block' : 'none';
      if (hasPermission('report.read')) refreshModerationQueue();
    }

    // Admin only tools
    if (importMarcBtn) importMarcBtn.style.display = hasPermission('feature.import_official') ? 'block' : 'none';
    if (roleManagementSection) roleManagementSection.style.display = isAdmin ? 'block' : 'none';
  } else {
    if (adminAuthRequired) adminAuthRequired.style.display = 'block';
    if (adminActions) adminActions.style.display = 'none';
  }

  if (allFeatures.length) {
    renderMap(allFeatures, allFeatures.length, (f) => updateInfoCard(f, infoCard, userPermissions), handleMarkerDrag, isStaff || isAdmin);
    renderLegend(allFeatures, legendStack, (f) => flyToFeature(f, (feature) => updateInfoCard(feature, infoCard, userPermissions)));
  }
}

async function refreshModerationQueue() {
  if (!moderationQueueList) return;
  try {
    const { fetchReports, resolveReport } = await import('./api.js');
    const reports = await fetchReports();
    
    if (reports.length === 0) {
      moderationQueueList.innerHTML = '<p style="font-size: 11px; opacity: 0.6;">No active reports. Map is clear!</p>';
      return;
    }

    moderationQueueList.innerHTML = reports.map(r => `
      <div class="note" style="display: flex; flex-direction: column; gap: 4px; border-left: 3px solid var(--color-primary);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <strong>${r.report_type}</strong>
          <small>${new Date(r.created_at).toLocaleDateString()}</small>
        </div>
        <div style="font-size: 11px;">Feature: <strong>${r.feature_name}</strong></div>
        <div style="font-size: 11px; opacity: 0.8;">${r.description || 'No description provided.'}</div>
        <div style="display: flex; gap: 4px; margin-top: 4px;">
          <button class="jump-btn resolve-btn" data-id="${r.id}" style="padding: 2px 8px; font-size: 10px; background: var(--color-primary); color: white;">Resolve</button>
          <button class="jump-btn view-btn" data-feature-id="${r.feature_id}" style="padding: 2px 8px; font-size: 10px;">View</button>
        </div>
      </div>
    `).join('');

    moderationQueueList.querySelectorAll('.resolve-btn').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Mark this report as resolved?')) return;
        btn.disabled = true;
        await resolveReport(btn.dataset.id);
        refreshModerationQueue();
      };
    });

    moderationQueueList.querySelectorAll('.view-btn').forEach(btn => {
      btn.onclick = () => {
        const feat = allFeatures.find(f => f.id === btn.dataset.featureId);
        if (feat) {
          flyToFeature(feat, (f) => updateInfoCard(f, infoCard, userPermissions));
          // Switch to Explore tab
          switchTab('explore');
        }
      };
    });
  } catch (err) {
    moderationQueueList.innerHTML = `<p style="font-size: 11px; color: red;">Error: ${err.message}</p>`;
  }
}

async function refreshData() {
  try {
    allFeatures = await fetchFeatures();
    const isStaff = checkIsStaff();
    renderMap(allFeatures, allFeatures.length, (f) => updateInfoCard(f, infoCard, userPermissions), handleMarkerDrag, isStaff);
    renderLegend(allFeatures, legendStack, (f) => flyToFeature(f, (feature) => updateInfoCard(feature, infoCard, userPermissions)));
  } catch (err) {
    console.error('Failed to fetch features:', err);
  }
}
async function handleMarkerDrag(feature, newCoords) {
  if (!hasPermission('feature.any.update_geometry')) return;
  try {
    const updated = { ...feature, geometry: { type: 'Point', coordinates: newCoords } };
    await updateFeature(feature.id, updated);
  } catch (err) {
    alert('Failed to update marker position: ' + err.message);
  }
}

async function checkUserAuth() {
  try {
    const data = await fetchMe();
    if (data.authenticated) {
      currentUser = data.user;
      window.currentUser = currentUser;
      userPermissions = data.user.permissions || [];
      
      if (userLoggedOutView) userLoggedOutView.style.display = 'none';
      if (userLoggedInView) userLoggedInView.style.display = 'block';
      if (userEmailDisplay) userEmailDisplay.textContent = data.user.email;
      
      const usernameDisplay = document.getElementById('userUsernameDisplay');
      const avatarContainer = document.getElementById('userAvatarDisplay')?.parentElement;
      if (usernameDisplay) {
        usernameDisplay.textContent = data.user.username || data.user.email.split('@')[0];
      }
      if (avatarContainer) {
        const oldAvatar = document.getElementById('userAvatarDisplay');
        if (oldAvatar) oldAvatar.remove(); // Remove static img
        const { getAvatarHtml } = await import('./utils.js');
        const avatarHtml = getAvatarHtml(data.user, 'avatar-sm');
        avatarContainer.insertAdjacentHTML('afterbegin', avatarHtml);
      }
      
      // Apply gamification data
      const levelEl = document.getElementById('contributor-level');
      const xpEl = document.getElementById('contributor-xp');
      const barEl = document.getElementById('xp-progress-bar');
      const badgeGrid = document.getElementById('user-badges-grid');

      if (data.user.reputation_score !== undefined) {
        const score = data.user.reputation_score;
        const level = Math.floor(score / 50) + 1;
        const xpInLevel = score % 50;
        const progress = (xpInLevel / 50) * 100;
        const levelNames = ['SCOUT', 'PATHFINDER', 'EXPLORER', 'CHART-MASTER', 'KNOWLEDGE-NODE', 'TRAIL-WIZARD', 'TERRAIN-GURU', 'MAP-VANGUARD', 'DATA-ELITE', 'LOCAL LEGEND'];
        const levelName = levelNames[Math.min(level - 1, 9)];

        if (levelEl) levelEl.textContent = `LEVEL ${level} ${levelName}`;
        if (xpEl) xpEl.textContent = `${score} XP`;
        if (barEl) barEl.style.width = `${progress}%`;

        if (badgeGrid && data.badges) {
          badgeGrid.innerHTML = '';
          const { getBadgeClass } = await import('./utils.js');
          data.badges.forEach(b => {
            const badge = document.createElement('div');
            badge.className = `badge-item ${getBadgeClass(b.name)}`;
            badge.style.cssText = 'padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: 700; text-transform: uppercase;';
            badge.textContent = b.name;
            badge.title = b.description;
            badgeGrid.appendChild(badge);
          });
        }
      }

      if (data.preferences) {
        if (data.preferences.basemap) {
          switchBasemap(data.preferences.basemap);
          if (basemapSelect) basemapSelect.value = data.preferences.basemap;
        }
        if (data.preferences.theme) {
          document.documentElement.setAttribute('data-theme', data.preferences.theme);
          localStorage.setItem('theme', data.preferences.theme);
        }
      }
      if (saveDefaultBasemapBtn) saveDefaultBasemapBtn.style.display = 'block';
      updateAdminUI();
    }
  } catch (err) {
    console.warn('Auth check failed:', err);
  }
}

function initCryptAnimations() {
  const scanline = document.querySelector('.crypt-scan');
  const grid = document.querySelector('.crypt-grid');
  
  if (scanline) {
    gsap.fromTo(scanline, 
      { y: "-100%" }, 
      { y: "100vh", duration: 8, ease: "none", repeat: -1 }
    );
  }
  
  if (grid) {
    gsap.to(grid, {
      opacity: 0.1,
      duration: 4,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });
  }
}

async function init() {
  // Initialize DOM References
  infoCard = document.getElementById('infoCard');
  legendStack = document.getElementById('legendStack');
  searchInput = document.getElementById('searchInput');
  helpBtn = document.getElementById('helpBtn');
  quickReportBtn = document.getElementById('quickReportBtn');
  adminActions = document.getElementById('adminActions');
  exportGeoJsonBtn = document.getElementById('exportGeoJsonBtn');
  importMarcBtn = document.getElementById('importMarcBtn');
  addPointBtn = document.getElementById('addPointBtn');
  addLineBtn = document.getElementById('addLineBtn');
  featureForm = document.getElementById('featureForm');
  basemapSelect = document.getElementById('basemapSelect');
  saveDefaultBasemapBtn = document.getElementById('saveDefaultBasemapBtn');

  adminAuthRequired = document.getElementById('admin-auth-required');
  moderationQueueSection = document.getElementById('moderationQueueSection');
  moderationQueueList = document.getElementById('moderationQueueList');
  roleManagementSection = document.getElementById('roleManagementSection');
  targetUserEmail = document.getElementById('targetUserEmail');
  targetUserRole = document.getElementById('targetUserRole');
  assignRoleBtn = document.getElementById('assignRoleBtn');
  featureActions = document.getElementById('featureActions');

  tabExplore = document.getElementById('tab-explore');
  tabSearch = document.getElementById('tab-search');
  tabCommunity = document.getElementById('tab-community');
  tabMessages = document.getElementById('tab-messages');
  tabAdmin = document.getElementById('tab-admin');

  sendMagicLinkBtn = document.getElementById('sendMagicLinkBtn');
  loginEmailInput = document.getElementById('loginEmailInput');
  userLoggedOutView = document.getElementById('user-logged-out');
  userLoggedInView = document.getElementById('user-logged-in');
  userEmailDisplay = document.getElementById('userEmailDisplay');
  userLogoutBtn = document.getElementById('userLogoutBtn');

  // Toggle Layers Section
  const toggleLayersBtn = document.getElementById('toggleLayersBtn');
  const layersContent = document.getElementById('layersContent');
  const layersChevron = document.getElementById('layersChevron');
  if (toggleLayersBtn && layersContent) {
    toggleLayersBtn.onclick = () => {
      const isHidden = layersContent.classList.toggle('hidden');
      if (layersChevron) layersChevron.textContent = isHidden ? '▶' : '▼';
    };
  }

  // Toggle Navigate Section
  const toggleNavigateBtn = document.getElementById('toggleNavigateBtn');
  const navigateContent = document.getElementById('navigateContent');
  const navigateChevron = document.getElementById('navigateChevron');
  if (toggleNavigateBtn && navigateContent) {
    toggleNavigateBtn.onclick = () => {
      const isHidden = navigateContent.classList.toggle('hidden');
      if (navigateChevron) navigateChevron.textContent = isHidden ? '▶' : '▼';
    };
  }

  initThemeToggle();
  initLeafletMap('map', [39.03, -94.535], 12);
  
  if (map) {
    map.on('click', (e) => {
      if (e.originalEvent.target.id === 'map' || e.originalEvent.target.classList.contains('leaflet-container')) {
        if (infoCard) infoCard.style.display = 'none';
      }
    });
  }
  
  await checkUserAuth();
  await refreshData();
  initCryptAnimations();

  // Handle popstate for SPA routing
  window.addEventListener('popstate', (e) => {
    if (window.location.pathname.startsWith('/rider/')) {
      const parts = window.location.pathname.split('/');
      const username = parts[2];
      if (username) {
        import('./ui.js').then(ui => ui.openPublicProfileModal(username));
      }
    } else {
      const profileModal = document.getElementById('publicProfileModal');
      if (profileModal) profileModal.style.display = 'none';
    }
  });

  // Handle initial vanity URLs (/rider/username)
  if (window.location.pathname.startsWith('/rider/')) {
    const parts = window.location.pathname.split('/');
    const username = parts[2];
    if (username) {
      import('./ui.js').then(ui => ui.openPublicProfileModal(username));
    }
  }

  const searchResultsList = document.getElementById('searchResultsList');

  let searchTimeout;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const isStaff = checkIsStaff();

      if (!q) {
        if (searchResultsList) searchResultsList.innerHTML = '';
        renderMap(allFeatures, allFeatures.length, (f) => updateInfoCard(f, infoCard, userPermissions), handleMarkerDrag, isStaff);
        return;
      }

      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        // 1. Filter Local Knowledge
        const filtered = allFeatures.filter(f =>
          f.name.toLowerCase().includes(q) ||
          (f.public_description && f.public_description.toLowerCase().includes(q)) ||
          f.category.toLowerCase().includes(q)
        );

        if (searchResultsList) {
          searchResultsList.innerHTML = '';
          
          // Add Profile Results
          try {
            const profiles = await fetchPublicProfiles();
            const matchedUsers = profiles.filter(u => u.username.toLowerCase().includes(q));
            if (matchedUsers.length > 0) {
              const uDivider = document.createElement('div');
              uDivider.style.cssText = 'font-size:9px; text-transform:uppercase; font-weight:700; margin: 8px 0 4px; opacity:0.5;';
              uDivider.textContent = 'Riders';
              searchResultsList.appendChild(uDivider);

              const { getAvatarHtml } = await import('./utils.js');
              matchedUsers.forEach(u => {
                const tile = document.createElement('div');
                tile.className = 'tile-btn';
                tile.style.display = 'flex';
                tile.style.alignItems = 'center';
                tile.style.gap = '8px';
                tile.style.borderLeft = '4px solid var(--color-primary)';
                tile.innerHTML = `
                  ${getAvatarHtml(u, 'avatar-sm')}
                  <div><strong>${u.username}</strong></div>
                `;
                tile.onclick = () => import('./ui.js').then(ui => ui.openPublicProfileModal(u.username));
                searchResultsList.appendChild(tile);
              });
            }
          } catch (err) {
            console.warn('Profile search failed:', err);
          }

          if (filtered.length > 0) {
            const fDivider = document.createElement('div');
            fDivider.style.cssText = 'font-size:9px; text-transform:uppercase; font-weight:700; margin: 0 0 4px; opacity:0.5;';
            fDivider.textContent = 'Map Features';
            searchResultsList.appendChild(fDivider);

            filtered.forEach(f => {
              const tile = document.createElement('div');
              tile.className = 'tile-btn';
              tile.style.borderLeft = `4px solid ${getCategoryMeta(f.category).swatch}`;
              tile.innerHTML = `<div><strong>${f.name}</strong><br><small style="font-size:9px; opacity:0.7;">${f.category}</small></div>`;
              tile.onclick = () => flyToFeature(f, (feature) => updateInfoCard(feature, infoCard, userPermissions));
              searchResultsList.appendChild(tile);
            });
          }

          try {
            if (searchAbortController) searchAbortController.abort();
            searchAbortController = new AbortController();

            const nomResp = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&viewbox=-95.1,39.3,-94.1,38.7&bounded=1`, {
              signal: searchAbortController.signal
            });
            const nomData = await nomResp.json();
            
            if (nomData.length > 0) {
              const divider = document.createElement('div');
              divider.style.cssText = 'font-size:9px; text-transform:uppercase; font-weight:700; margin: 12px 0 4px; opacity:0.5;';
              divider.textContent = 'Global Locations';
              searchResultsList.appendChild(divider);

              nomData.forEach(place => {
                const tile = document.createElement('div');
                tile.className = 'tile-btn';
                tile.style.borderLeft = '4px solid #94a3b8ff';
                tile.innerHTML = `<div><strong>${place.display_name.split(',')[0]}</strong><br><small style="font-size:9px; opacity:0.7;">${place.display_name.split(',').slice(1, 3).join(',')}</small></div>`;
                tile.onclick = () => {
                  map.flyTo([place.lat, place.lon], 15);
                };
                searchResultsList.appendChild(tile);
              });
            }
          } catch (err) {
            if (err.name === 'AbortError') return;
            console.warn('Nominatim search failed:', err);
          }
        }

        renderMap(filtered, allFeatures.length, (f) => updateInfoCard(f, infoCard, userPermissions), handleMarkerDrag, isStaff);
      }, 400);
    });
  }

  const doLogout = async () => {
    try {
      await fetch('/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Server logout failed, clearing locally');
    }
    document.cookie = "session=; Max-Age=0; path=/; SameSite=Strict;";
    location.reload();
  };

  if (userLogoutBtn) userLogoutBtn.addEventListener('click', doLogout);

  if (assignRoleBtn) {
    assignRoleBtn.addEventListener('click', async () => {
      const email = targetUserEmail.value;
      const role = targetUserRole.value;
      if (!email) return alert('Enter a user email');
      try {
        assignRoleBtn.disabled = true;
        await assignUserRole(email, role);
        alert(`Role '${role}' assigned to ${email}`);
        targetUserEmail.value = '';
      } catch (err) {
        alert('Failed: ' + err.message);
      } finally {
        assignRoleBtn.disabled = false;
      }
    });
  }

  if (sendMagicLinkBtn) {
    sendMagicLinkBtn.addEventListener('click', async () => {
      const email = loginEmailInput.value;
      if (!email) return alert('Email required');
      try {
        sendMagicLinkBtn.disabled = true;
        sendMagicLinkBtn.textContent = 'Sending...';
        const res = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to send link');
        }
        alert('Verification link sent! Check your inbox.');
      } catch (err) {
        alert('Failed to send link: ' + err.message);
      } finally {
        sendMagicLinkBtn.disabled = false;
        sendMagicLinkBtn.textContent = 'Send Link';
      }
    });
  }

  if (exportGeoJsonBtn) {
    exportGeoJsonBtn.addEventListener('click', () => {
      downloadGeoJSON(allFeatures);
    });
  }

  const importGeoJsonBtn = document.getElementById('importGeoJsonBtn');
  const geoJsonFileInput = document.getElementById('geoJsonFileInput');

  if (importGeoJsonBtn && geoJsonFileInput) {
    importGeoJsonBtn.addEventListener('click', () => geoJsonFileInput.click());
    geoJsonFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const geojson = JSON.parse(event.target.result);
          if (!geojson.features || !Array.isArray(geojson.features)) throw new Error("Invalid GeoJSON.");
          importGeoJsonBtn.disabled = true;
          importGeoJsonBtn.textContent = 'Importing...';

          const featuresToImport = geojson.features.map(feat => {
            const geom = feat.geometry;
            const props = feat.properties || {};
            if (!geom) return null;
            return {
              name: props.name || 'Imported Feature',
              geometry: geom,
              feature_type: props.feature_type || (geom.type === 'Point' ? 'point' : 'line'),
              category: props.category || 'Local Knowledge',
              status: props.status || 'active',
              visibility: props.visibility || 'public',
              officiality: props.officiality || 'unofficial'
            };
          }).filter(Boolean);

          const { bulkImportFeatures } = await import('./api.js');
          const res = await bulkImportFeatures(featuresToImport);
          alert(`Successfully imported ${res.count} features.`);
          location.reload();
        } catch (err) {
          alert('Import failed: ' + err.message);
          importGeoJsonBtn.disabled = false;
          importGeoJsonBtn.textContent = 'Bulk Import GeoJSON';
        }
      };
      reader.readAsText(file);
    });
  }

  if (importMarcBtn) {
    importMarcBtn.addEventListener('click', async () => {
      if (!confirm('This will fetch and import the latest MARC regional trail data. Proceed?')) return;
      try {
        importMarcBtn.disabled = true;
        importMarcBtn.textContent = 'Importing...';
        const res = await fetch('/admin/import-marc', { method: 'POST' });
        if (!res.ok) throw new Error(await res.text());
        const msg = await res.text();
        alert(msg);
        location.reload();
      } catch (err) {
        alert('Failed: ' + err.message);
        importMarcBtn.disabled = false;
        importMarcBtn.textContent = 'Import MARC Trails';
      }
    });
  }

  if (addPointBtn) addPointBtn.onclick = () => openModal(null, 'point');
  if (addLineBtn) addLineBtn.onclick = () => startLineDrawing();

  if (tabExplore) tabExplore.onclick = () => switchTab('explore');
  if (tabSearch) tabSearch.onclick = () => switchTab('search');
  if (tabCommunity) {
    tabCommunity.onclick = async () => {
      switchTab('community');
      const statsEl = document.getElementById('community-stats');
      const list = document.getElementById('community-profiles-list');
      const activityList = document.getElementById('community-activity-list');
      
      try {
        const { activity, stats } = await fetchCommunityStats();
        if (statsEl) {
          statsEl.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align:center;">
              <div class="activity-item"><strong>${stats.total_features}</strong><br><small>Features</small></div>
              <div class="activity-item"><strong>${stats.active_reports}</strong><br><small>Alerts</small></div>
              <div class="activity-item"><strong>${stats.active_members}</strong><br><small>Riders</small></div>
            </div>
          `;
        }
        
        if (activityList) {
          activityList.innerHTML = activity.map(a => `
            <div class="activity-item" style="margin-bottom: 4px; font-size: 10px;">
              <strong>${a.username || 'Anonymous'}</strong> ${a.type === 'feature' ? 'mapped' : 'commented on'} <strong>${a.title}</strong>
              <div style="opacity: 0.5;">${new Date(a.created_at).toLocaleDateString()}</div>
            </div>
          `).join('');
        }

        // Fetch leaderboard
        const profiles = await fetchPublicProfiles();
        const { getAvatarHtml } = await import('./utils.js');
        if (list) {
          list.innerHTML = '';
          if (profiles.length === 0) {
            list.innerHTML = '<div style="text-align:center; opacity:0.5; padding:10px;">No public profiles.</div>';
          } else {
            profiles.forEach(p => {
              const tile = document.createElement('div');
              tile.className = 'tile-btn user-tile';
              tile.innerHTML = `
                ${getAvatarHtml(p, 'avatar-sm')}
                <div class="flex-1">
                  <div class="font-bold text-sm">${p.username}</div>
                  <div class="text-xs text-muted">${p.reputation_score} XP</div>
                </div>
              `;
              tile.onclick = () => import('./ui.js').then(ui => ui.openPublicProfileModal(p.username));
              list.appendChild(tile);
            });
          }
        }
      } catch (err) {
        console.warn('Failed to load community data:', err);
      }
    };
  }
  if (tabMessages) {
    tabMessages.onclick = () => {
      switchTab('messages');
      renderRecentChats();
    };
  }
  if (tabAdmin) tabAdmin.onclick = () => switchTab('admin');

  if (helpBtn) helpBtn.onclick = openHelpModal;

  const quickReportModal = document.getElementById('reportModal');
  if (quickReportBtn) {
    quickReportBtn.onclick = () => {
      if (!currentUser) return alert('Login required to submit field reports.');
      quickReportModal.style.display = 'flex';
    };
  }

  const reportForm = document.getElementById('reportForm');
  if (reportForm) {
    reportForm.onsubmit = async (e) => {
      e.preventDefault();
      const body = {
        feature_id: document.getElementById('r_feature_id').value || null,
        report_type: document.getElementById('r_type').value,
        description: document.getElementById('r_description').value
      };
      try {
        const { createReport } = await import('./api.js');
        await createReport(body);
        alert('Report submitted! Thank you.');
        quickReportModal.style.display = 'none';
        reportForm.reset();
      } catch (err) {
        alert('Failed: ' + err.message);
      }
    };
  }

  if (basemapSelect) {
    basemapSelect.addEventListener('change', (e) => {
      switchBasemap(e.target.value);
    });
  }

  if (saveDefaultBasemapBtn) {
    saveDefaultBasemapBtn.addEventListener('click', async () => {
      const basemapId = basemapSelect ? basemapSelect.value : 'pioneer';
      try {
        saveDefaultBasemapBtn.disabled = true;
        saveDefaultBasemapBtn.textContent = 'SAVING...';
        await fetch('/api/me/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ basemap: basemapId })
        });
        alert('Default basemap saved!');
      } catch (err) {
        alert('Failed to save preference.');
      } finally {
        saveDefaultBasemapBtn.disabled = false;
        saveDefaultBasemapBtn.textContent = 'SET DEFAULT';
      }
    });
  }

  // Layer Toggles
  const toggles = [
    { id: 'layer-knowledge', type: 'layer', name: 'knowledge' },
    { id: 'layer-official', type: 'layer', name: 'official' },
    { id: 'layer-reports', type: 'layer', name: 'reports' },
    { id: 'layer-amenities', type: 'layer', name: 'amenities' },
    { id: 'overlay-railway', type: 'overlay', name: 'railway' },
    { id: 'overlay-cycling_routes', type: 'overlay', name: 'cycling_routes' },
    { id: 'overlay-hiking_trails', type: 'overlay', name: 'hiking_trails' }
  ];

  toggles.forEach(t => {
    const el = document.getElementById(t.id);
    if (el) {
      el.onchange = (e) => {
        if (t.type === 'layer') toggleLayer(t.name, e.target.checked);
        else toggleOverlay(t.name, e.target.checked);
      };
    }
  });

  // Profile Edit
  const editProfileBtn = document.getElementById('editProfileBtn');
  if (editProfileBtn) {
    editProfileBtn.onclick = async () => {
      const { openProfileEditModal } = await import('./ui.js');
      openProfileEditModal(currentUser);
    };
  }

  const profileForm = document.getElementById('profileEditForm');
  if (profileForm) {
    profileForm.onsubmit = async (e) => {
      e.preventDefault();
      const saveBtn = profileForm.querySelector('button[type="submit"]');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const socialLinks = Array.from(document.querySelectorAll('.social-url')).map(input => input.value).filter(Boolean);
      
      const body = {
        username: document.getElementById('f_profile_username').value,
        bio: document.getElementById('f_profile_bio').value,
        social_links: socialLinks
      };

      try {
        const { updateProfile } = await import('./api.js');
        await updateProfile(body);
        
        // Handle avatar upload if any
        const avatarFile = document.getElementById('f_profile_avatar').files[0];
        if (avatarFile) {
          const formData = new FormData();
          formData.append('file', avatarFile);
          await fetch('/api/me/avatar', {
            method: 'POST',
            body: formData
          });
        }

        alert('Profile updated!');
        location.reload();
      } catch (err) {
        alert('Error: ' + err.message);
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Profile';
      }
    };
  }

  const enableDmsBtn = document.getElementById('enableDmsBtn');
  if (enableDmsBtn) {
    enableDmsBtn.addEventListener('click', async () => {
      try {
        enableDmsBtn.disabled = true;
        enableDmsBtn.textContent = 'Generating Keys...';

        const cryptoModule = await import('./crypto.js');
        const { publicJwk } = await cryptoModule.generateKeyPair();

        const apiModule = await import('./api.js');
        await apiModule.updateProfile({ public_key: JSON.stringify(publicJwk) });

        alert('Encrypted DMs enabled successfully!');
        enableDmsBtn.style.display = 'none';

        // Refresh local user state
        await checkUserAuth();
      } catch (err) {
        alert('Failed to enable DMs: ' + err.message);
        enableDmsBtn.disabled = false;
        enableDmsBtn.textContent = '🔒 Enable Encrypted DMs';
      }
    });
  }

  const downloadBackupBtn = document.getElementById('downloadBackupBtn');
  if (downloadBackupBtn) {
    downloadBackupBtn.onclick = async () => {
      const cryptoModule = await import('./crypto.js');
      const key = await cryptoModule.exportPrivateKey();
      if (!key) return alert('No key found to backup.');

      const blob = new Blob([key], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jojomap-dm-key-${currentUser.username}.json`;
      a.click();
    };
  }

  const restoreKeyBtn = document.getElementById('restoreKeyBtn');
  const restoreKeyFile = document.getElementById('restoreKeyFile');
  if (restoreKeyBtn && restoreKeyFile) {
    restoreKeyBtn.onclick = () => restoreKeyFile.click();
    restoreKeyFile.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const cryptoModule = await import('./crypto.js');
          await cryptoModule.importPrivateKey(event.target.result);
          alert('DM Key restored successfully!');
          location.reload();
        } catch (err) {
          alert('Failed to restore key: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
  }
}

function renderRecentChats() {
  const container = document.getElementById('recentChatsList');
  if (!container) return;
  
  const recent = JSON.parse(localStorage.getItem('recent_chats') || '[]');
  if (recent.length === 0) {
    container.innerHTML = '<div style="text-align:center; opacity:0.5; padding:20px;">No recent DMs. Visit a rider\'s profile to start a chat.</div>';
    return;
  }

  const { getAvatarHtml } = import('./utils.js');

  container.innerHTML = '';
  recent.forEach(u => {
    const tile = document.createElement('div');
    tile.className = 'tile-btn user-tile';
    tile.innerHTML = `
      ${getAvatarHtml ? getAvatarHtml(u, 'avatar-sm') : `<img src="${u.avatar_url || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%23ccc%22/></svg>'}" class="avatar-sm">`}
      <div class="flex-1">
        <div class="font-bold text-sm">${u.username}</div>
      </div>
    `;
    tile.onclick = async () => {
      const chatModule = await import('./chat.js');
      chatModule.openChat(currentUser, u);
    };
    container.appendChild(tile);
  });
}

document.addEventListener('DOMContentLoaded', init);
