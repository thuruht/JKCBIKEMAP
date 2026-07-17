import { fetchFeatures, createFeature, updateFeature, fetchMe, assignUserRole, fetchPublicProfiles, fetchCommunityStats } from './api.js';
import { initLeafletMap, renderMap, flyToFeature, enableMapPicker, toggleLayer, fetchAmenities, map, switchBasemap, toggleOverlay, setOverlayOpacity, drawRoute, clearRoute, getRouteShape, startLineDrawing } from './map.js';
import { updateInfoCard, renderLegend, initThemeToggle, openModal, closeModal, openHelpModal, closeHelpModal, switchTab } from './ui.js';
import { downloadGeoJSON, getCategoryMeta } from './utils.js';

// DOM Elements (Global references assigned in init)
let infoCard, legendStack, searchInput, helpBtn, quickReportBtn, adminActions, exportGeoJsonBtn, importMarcBtn, addPointBtn, addLineBtn, featureForm, basemapSelect, saveDefaultBasemapBtn;
let adminAuthRequired, moderationQueueSection, moderationQueueList, roleManagementSection, targetUserEmail, targetUserRole, assignRoleBtn, featureActions;
let tabExplore, tabSearch, tabPlan, tabCommunity, tabMessages, tabAdmin;
let sendMagicLinkBtn, loginEmailInput, userLoggedOutView, userLoggedInView, userEmailDisplay, userLogoutBtn;

// Plan route DOM refs
let planStartInput, planEndInput, planStartSuggestions, planEndSuggestions;
let planRouteBtn, planClearBtn, planExportBtn, planSummary, planDistance, planTime, planTurns, planSource;
let planWaypoints = { start: null, end: null }; // { lat, lon, label }
let activePlanPref = 'balanced';

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

  refreshMapWithFilters();
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

function getVisibleFeatures() {
  const knowledgeOn = document.getElementById('layer-knowledge')?.checked ?? true;
  const officialOn = document.getElementById('layer-official')?.checked ?? false;
  const plannedOn = document.getElementById('layer-planned')?.checked ?? true;
  const reportsOn = document.getElementById('layer-reports')?.checked ?? true;

  const filterOfficial = document.getElementById('filter-official')?.checked ?? true;
  const filterUnofficial = document.getElementById('filter-unofficial')?.checked ?? true;
  const filterPlanned = document.getElementById('filter-planned')?.checked ?? true;

  return allFeatures.filter(f => {
    // category / layer filters
    if (f.category === 'Official Regional Data') {
      if (!officialOn) return false;
    } else if (f.category === 'Field Reports') {
      if (!reportsOn) return false;
    } else if (f.category === 'Planned / in progress' || f.officiality === 'planned') {
      if (!plannedOn) return false;
    } else {
      if (!knowledgeOn) return false;
    }

    // officiality filters
    const off = f.officiality || 'official';
    if (off === 'official' && !filterOfficial) return false;
    if (off === 'unofficial' && !filterUnofficial) return false;
    if ((off === 'planned' || off === 'social') && !filterPlanned) return false;

    return true;
  });
}

function refreshMapWithFilters() {
  const isStaff = checkIsStaff();
  const visible = getVisibleFeatures();
  renderMap(visible, allFeatures.length, (f) => updateInfoCard(f, infoCard, userPermissions), handleMarkerDrag, isStaff);
  renderLegend(visible, legendStack, (f) => flyToFeature(f, (feature) => updateInfoCard(feature, infoCard, userPermissions)));
}

async function refreshData() {
  try {
    allFeatures = await fetchFeatures();
    refreshMapWithFilters();
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
  tabPlan = document.getElementById('tab-plan');
  tabCommunity = document.getElementById('tab-community');
  tabMessages = document.getElementById('tab-messages');
  tabAdmin = document.getElementById('tab-admin');

  sendMagicLinkBtn = document.getElementById('sendMagicLinkBtn');
  loginEmailInput = document.getElementById('loginEmailInput');
  userLoggedOutView = document.getElementById('user-logged-out');
  userLoggedInView = document.getElementById('user-logged-in');
  userEmailDisplay = document.getElementById('userEmailDisplay');
  userLogoutBtn = document.getElementById('userLogoutBtn');

  // Plan route refs
  planStartInput = document.getElementById('planStartInput');
  planEndInput = document.getElementById('planEndInput');
  planStartSuggestions = document.getElementById('planStartSuggestions');
  planEndSuggestions = document.getElementById('planEndSuggestions');
  planRouteBtn = document.getElementById('planRouteBtn');
  planClearBtn = document.getElementById('planClearBtn');
  planExportBtn = document.getElementById('planExportBtn');
  planSummary = document.getElementById('planSummary');
  planDistance = document.getElementById('planDistance');
  planTime = document.getElementById('planTime');
  planTurns = document.getElementById('planTurns');
  planSource = document.getElementById('planSource');

  // Toggle Layers Section
  // IMPORTANT: these drawers start with class="hidden"; ensure main.css always defines .hidden { display: none !important; }
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

  const currentTheme = document.documentElement.getAttribute('data-theme') || localStorage.getItem('theme');
  if (currentTheme === 'dark') {
    switchBasemap('dark');
    if (basemapSelect) basemapSelect.value = 'dark';
  }

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
        refreshMapWithFilters();
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
      if (!confirm('This will fetch and sync the latest official regional trail data. Proceed?')) return;
      try {
        importMarcBtn.disabled = true;
        importMarcBtn.textContent = 'Syncing...';
        const res = await fetch('/admin/sync-data', { method: 'POST' });
        if (!res.ok) throw new Error(await res.text());
        const msg = await res.text();
        alert(msg);
        location.reload();
      } catch (err) {
        alert('Failed: ' + err.message);
        importMarcBtn.disabled = false;
        importMarcBtn.textContent = 'Sync Official Data';
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
  if (tabPlan) {
    tabPlan.onclick = () => {
      switchTab('plan');
      // keep route summary visible if present
    };
  }

  initPlanRoute();
  initLayerFilters();

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
  const layerToggles = [
    { id: 'layer-knowledge', name: 'knowledge' },
    { id: 'layer-official', name: 'official' },
    { id: 'layer-planned', name: 'planned' },
    { id: 'layer-reports', name: 'reports' },
    { id: 'amenity-water', name: 'amenity_water' },
    { id: 'amenity-repair', name: 'amenity_repair' },
    { id: 'amenity-shop', name: 'amenity_shop' },
    { id: 'amenity-food', name: 'amenity_food' },
  ];

  layerToggles.forEach(t => {
    const el = document.getElementById(t.id);
    if (el) {
      el.onchange = () => {
        refreshMapWithFilters();
        // amenity sub-layers toggle directly
        if (t.name.startsWith('amenity_')) {
          toggleLayer(t.name, el.checked);
          fetchAmenities();
        } else if (t.name !== 'knowledge') {
          toggleLayer(t.name, el.checked);
        }
      };
    }
  });

  // Overlay toggles + opacity
  const overlays = ['railway', 'cycling_routes', 'hiking_trails', 'weather_radar'];
  overlays.forEach(name => {
    const toggle = document.getElementById(`overlay-${name}`);
    const slider = document.getElementById(`opacity-${name}`);
    if (toggle) {
      toggle.onchange = (e) => toggleOverlay(name, e.target.checked);
    }
    if (slider) {
      slider.oninput = (e) => setOverlayOpacity(name, parseFloat(e.target.value));
    }
  });

  // Officiality / type filters
  ['filter-official', 'filter-unofficial', 'filter-planned'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.onchange = refreshMapWithFilters;
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

// ─── Plan Route helpers ─────────────────────────────────────────────────────

function initPlanRoute() {
  if (!planStartInput || !planEndInput) return;

  let startTimer, endTimer;

  planStartInput.addEventListener('input', (e) => {
    clearTimeout(startTimer);
    const q = e.target.value.trim();
    if (q.length < 3) {
      if (planStartSuggestions) planStartSuggestions.style.display = 'none';
      return;
    }
    startTimer = setTimeout(() => fetchSuggestions(q, planStartSuggestions, 'start'), 250);
  });

  planEndInput.addEventListener('input', (e) => {
    clearTimeout(endTimer);
    const q = e.target.value.trim();
    if (q.length < 3) {
      if (planEndSuggestions) planEndSuggestions.style.display = 'none';
      return;
    }
    endTimer = setTimeout(() => fetchSuggestions(q, planEndSuggestions, 'end'), 250);
  });

  // Close suggestions on outside click
  document.addEventListener('click', (e) => {
    if (planStartSuggestions && !planStartInput.contains(e.target) && !planStartSuggestions.contains(e.target)) {
      planStartSuggestions.style.display = 'none';
    }
    if (planEndSuggestions && !planEndInput.contains(e.target) && !planEndSuggestions.contains(e.target)) {
      planEndSuggestions.style.display = 'none';
    }
  });

  // Preference buttons
  document.querySelectorAll('.plan-pref').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.plan-pref').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activePlanPref = btn.dataset.pref || 'balanced';
    });
  });

  if (planRouteBtn) planRouteBtn.addEventListener('click', doPlanRoute);
  if (planClearBtn) planClearBtn.addEventListener('click', clearPlanRoute);
  if (planExportBtn) planExportBtn.addEventListener('click', exportRouteGPX);
}

async function fetchSuggestions(q, container, which) {
  if (!container) return;
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error('Geocode failed');
    const data = await res.json();
    if (!data.length) {
      container.style.display = 'none';
      return;
    }
    container.innerHTML = '';
    data.slice(0, 5).forEach(result => {
      const div = document.createElement('div');
      div.textContent = result.label;
      div.addEventListener('click', () => selectWaypoint(which, result, container));
      container.appendChild(div);
    });
    container.style.display = 'block';
  } catch (err) {
    console.warn('Suggestion fetch failed:', err);
    container.style.display = 'none';
  }
}

function selectWaypoint(which, result, container) {
  planWaypoints[which] = { lat: result.lat, lon: result.lng, label: result.short || result.label };
  const input = which === 'start' ? planStartInput : planEndInput;
  if (input) input.value = planWaypoints[which].label;
  if (container) container.style.display = 'none';
}

function planCostingOptions() {
  const base = { bicycle: { use_hills: 0.5 } };
  switch (activePlanPref) {
    case 'quiet': base.bicycle.use_roads = 0.2; break;
    case 'fast': base.bicycle.use_roads = 0.8; break;
    default: base.bicycle.use_roads = 0.5; break;
  }
  return base;
}

async function doPlanRoute() {
  if (!planWaypoints.start || !planWaypoints.end) {
    alert('Please select a start and destination from the suggestions.');
    return;
  }
  if (planRouteBtn) {
    planRouteBtn.disabled = true;
    planRouteBtn.textContent = 'Routing...';
  }

  try {
    const body = {
      locations: [
        { lat: planWaypoints.start.lat, lon: planWaypoints.start.lon, label: planWaypoints.start.label },
        { lat: planWaypoints.end.lat, lon: planWaypoints.end.lon, label: planWaypoints.end.label },
      ],
      costing: 'bicycle',
      costing_options: planCostingOptions(),
    };

    const res = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error('Route request failed');
    const data = await res.json();

    const leg = data.trip?.legs?.[0];
    if (!leg || !leg.shape) throw new Error('No route returned');

    drawRoute(leg.shape);
    showPlanSummary(leg, res.headers.get('X-Route-Source') || 'unknown');
  } catch (err) {
    alert('Could not plan route: ' + err.message);
    console.error(err);
  } finally {
    if (planRouteBtn) {
      planRouteBtn.disabled = false;
      planRouteBtn.textContent = 'Find Route';
    }
  }
}

function formatDistance(km) {
  const miles = km * 0.621371;
  if (miles < 0.1) return `${(miles * 5280).toFixed(0)} ft`;
  return `${miles.toFixed(1)} mi`;
}

function formatTime(seconds) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function showPlanSummary(leg, source) {
  if (!planSummary) return;
  const summary = leg.summary || {};
  if (planDistance) planDistance.textContent = formatDistance(summary.length || 0);
  if (planTime) planTime.textContent = formatTime(summary.time || 0);
  if (planSource) planSource.textContent = `via ${source}`;

  if (planTurns && leg.maneuvers) {
    planTurns.innerHTML = '';
    leg.maneuvers.slice(1, -1).forEach((m, i) => {
      const div = document.createElement('div');
      div.className = 'tile-btn';
      div.style.fontSize = '12px';
      div.innerHTML = `<strong>${i + 1}.</strong> ${m.instruction || 'Continue'}`;
      planTurns.appendChild(div);
    });
  }

  planSummary.style.display = 'block';
}

function clearPlanRoute() {
  clearRoute();
  planWaypoints = { start: null, end: null };
  if (planStartInput) planStartInput.value = '';
  if (planEndInput) planEndInput.value = '';
  if (planSummary) planSummary.style.display = 'none';
  if (planTurns) planTurns.innerHTML = '';
}

function exportRouteGPX() {
  const shape = getRouteShape();
  if (!shape || shape.length < 2) return alert('No route to export.');

  const trkpts = shape.map(c => `    <trkpt lat="${c[1]}" lon="${c[0]}"></trkpt>`).join('\n');
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="JKC Bike Map">
  <trk>
    <name>Planned Route</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;

  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jojomap-route-${new Date().toISOString().slice(0, 10)}.gpx`;
  a.click();
  URL.revokeObjectURL(url);
}

function initLayerFilters() {
  // initial filter pass; actual visibility is driven by checkbox state
  refreshMapWithFilters();
}

document.addEventListener('DOMContentLoaded', init);
