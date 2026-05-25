import { fetchFeatures, createFeature, updateFeature, fetchMe, assignUserRole, fetchPublicProfiles, fetchCommunityStats } from './api.js';
import { initLeafletMap, renderMap, flyToFeature, enableMapPicker, toggleLayer, fetchAmenities, map, switchBasemap, toggleOverlay, startLineDrawing } from './map.js';
import { updateInfoCard, renderLegend, initThemeToggle, openModal, closeModal, openHelpModal, closeHelpModal, switchTab } from './ui.js';
import { downloadGeoJSON, getCategoryMeta } from './utils.js';

// DOM Elements
const infoCard = document.getElementById('infoCard');
const legendStack = document.getElementById('legendStack');
const searchInput = document.getElementById('searchInput');
const helpBtn = document.getElementById('helpBtn');
const quickReportBtn = document.getElementById('quickReportBtn');
const adminActions = document.getElementById('adminActions');
const exportGeoJsonBtn = document.getElementById('exportGeoJsonBtn');
const importMarcBtn = document.getElementById('importMarcBtn');
const addPointBtn = document.getElementById('addPointBtn');
const addLineBtn = document.getElementById('addLineBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const closeHelpBtn = document.getElementById('closeHelpBtn');
const featureForm = document.getElementById('featureForm');
const pickOnMapBtn = document.getElementById('pickOnMapBtn');

// Admin Panel Elements
const adminAuthRequired = document.getElementById('admin-auth-required');
const roleManagementSection = document.getElementById('roleManagementSection');
const targetUserEmail = document.getElementById('targetUserEmail');
const targetUserRole = document.getElementById('targetUserRole');
const assignRoleBtn = document.getElementById('assignRoleBtn');
const featureActions = document.getElementById('featureActions');

// Tabs
const tabExplore = document.getElementById('tab-explore');
const tabSearch = document.getElementById('tab-search');
const tabCommunity = document.getElementById('tab-community');
const tabMessages = document.getElementById('tab-messages');
const tabAdmin = document.getElementById('tab-admin');

// User Auth Elements
const sendMagicLinkBtn = document.getElementById('sendMagicLinkBtn');
const loginEmailInput = document.getElementById('loginEmailInput');
const userLoggedOutView = document.getElementById('user-logged-out');
const userLoggedInView = document.getElementById('user-logged-in');
const userEmailDisplay = document.getElementById('userEmailDisplay');
const userLogoutBtn = document.getElementById('userLogoutBtn');

let allFeatures = [];
let currentUser = null;
let userPermissions = [];

function hasPermission(p) {
  return userPermissions.includes(p);
}

function updateAdminUI() {
  const isAdmin = hasPermission('user.role.assign');
  const isStaff = hasPermission('feature.any.hide') || hasPermission('feature.any.update_public_fields');

  if (currentUser) {
    if (adminAuthRequired) adminAuthRequired.style.display = 'none';
    if (adminActions) adminActions.style.display = isStaff ? 'block' : 'none';
    
    // Feature Actions (Moderators + Admins)
    if (featureActions) featureActions.style.display = (isStaff || isAdmin) ? 'block' : 'none';
    
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

async function refreshData() {
  try {
    allFeatures = await fetchFeatures();
    const isStaff = hasPermission('feature.any.hide') || hasPermission('feature.any.update_public_fields') || hasPermission('user.role.assign');
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
  const basemapSelect = document.getElementById('basemapSelect');
  const saveDefaultBasemapBtn = document.getElementById('saveDefaultBasemapBtn');

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

  // Handle vanity URLs (/rider/username)
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
      const isStaff = hasPermission('feature.any.hide') || hasPermission('feature.any.update_public_fields') || hasPermission('user.role.assign');

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
          
          // --- New: Search for Users ---
          try {
            const profiles = await fetchPublicProfiles();
            const matchedUsers = profiles.filter(p => p.username && p.username.toLowerCase().includes(q));
            if (matchedUsers.length > 0) {
              const uDivider = document.createElement('div');
              uDivider.style.cssText = 'font-size:9px; text-transform:uppercase; font-weight:700; margin: 0 0 4px; opacity:0.5;';
              uDivider.textContent = 'Community Members';
              searchResultsList.appendChild(uDivider);

              matchedUsers.forEach(u => {
                const tile = document.createElement('div');
                tile.className = 'tile-btn';
                tile.style.display = 'flex';
                tile.style.alignItems = 'center';
                tile.style.gap = '8px';
                tile.style.borderLeft = '4px solid var(--color-primary)';
                tile.innerHTML = `
                  <img src="${u.avatar_url || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%23ccc%22/></svg>'}" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                  <div><strong>${u.username}</strong></div>
                `;
                tile.onclick = () => import('./ui.js').then(ui => ui.openPublicProfileModal(u.username));
                searchResultsList.appendChild(tile);
              });
              
              const spacer = document.createElement('div');
              spacer.style.height = '12px';
              searchResultsList.appendChild(spacer);
            }
          } catch (e) {
            console.warn("User search failed:", e);
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
            const nomResp = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&viewbox=-95.1,39.3,-94.1,38.7&bounded=1`);
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
        const avatarDisplay = document.getElementById('userAvatarDisplay');
        if (usernameDisplay) {
          usernameDisplay.textContent = data.user.username || data.user.email.split('@')[0];
        }
        if (avatarDisplay && data.user.avatar_url) {
          avatarDisplay.src = data.user.avatar_url;
          avatarDisplay.style.display = 'block';
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
            data.badges.forEach(b => {
              const badge = document.createElement('div');
              badge.style.cssText = 'padding: 2px 6px; border-radius: 4px; background: var(--color-primary-soft); color: var(--color-primary); font-size: 8px; font-weight: 700; text-transform: uppercase; border: 1px solid var(--color-primary);';
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
  };

  if (sendMagicLinkBtn) {
    sendMagicLinkBtn.addEventListener('click', async () => {
      const email = loginEmailInput.value;
      if (!email) return alert('Email required');
      try {
        sendMagicLinkBtn.disabled = true;
        sendMagicLinkBtn.textContent = 'Sending...';
        await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
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
          
          let count = 0;
          importGeoJsonBtn.disabled = true;
          importGeoJsonBtn.textContent = 'Importing...';
          
          for (const feat of geojson.features) {
            const geom = feat.geometry;
            const props = feat.properties || {};
            if (!geom) continue;
            
            const data = {
              name: props.name || 'Imported Feature',
              feature_type: geom.type === 'Point' ? 'point' : 'line',
              category: props.category || 'Trail spines',
              status: props.status || 'active',
              officiality: props.officiality || 'official',
              visibility: props.visibility || 'public',
              public_description: props.public_description || '',
              geometry: geom
            };
            
            try {
              await createFeature(data);
              count++;
            } catch (err) {
              console.warn("Failed import:", data.name, err);
            }
          }
          alert(`Imported ${count} features.`);
          await refreshData();
        } catch (err) {
          alert("Error: " + err.message);
        } finally {
          importGeoJsonBtn.disabled = false;
          importGeoJsonBtn.textContent = 'Import GeoJSON';
          geoJsonFileInput.value = '';
        }
      };
      reader.readAsText(file);
    });
  }

  if (importMarcBtn) {
    importMarcBtn.addEventListener('click', async () => {
      if (!confirm('Fetch and import latest MARC data?')) return;
      try {
        importMarcBtn.disabled = true;
        importMarcBtn.textContent = 'Importing...';
        const resp = await fetch('/admin/import-marc');
        const result = await resp.text();
        alert(result);
        await refreshData();
      } catch (err) {
        alert('Import failed: ' + err.message);
      } finally {
        importMarcBtn.disabled = false;
        importMarcBtn.textContent = 'Run MARC Import';
      }
    });
  }

  if (tabExplore) tabExplore.addEventListener('click', () => switchTab('explore'));
  if (tabSearch) tabSearch.addEventListener('click', () => switchTab('search'));
  if (tabMessages) {
    tabMessages.addEventListener('click', () => {
      switchTab('messages');
      const list = document.getElementById('messagesList');
      if (!list) return;

      const recent = JSON.parse(localStorage.getItem('recent_chats') || '[]');
      if (recent.length === 0) {
        list.innerHTML = '<div style="text-align:center; opacity:0.5; padding:20px;">No recent conversations. Find a rider in the Community tab to start a chat!</div>';
      } else {
        list.innerHTML = '';
        recent.forEach(u => {
          const tile = document.createElement('div');
          tile.className = 'tile-btn';
          tile.style.display = 'flex';
          tile.style.alignItems = 'center';
          tile.style.gap = '12px';
          tile.innerHTML = `
            <img src="${u.avatar_url || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%23ccc%22/></svg>'}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
            <div style="flex:1;">
              <div style="font-weight:700;">${u.username}</div>
              <div style="font-size:9px; opacity:0.6;">Encrypted Tunnel Active 🔒</div>
            </div>
          `;
          tile.onclick = async () => {
            const chatModule = await import('./chat.js');
            chatModule.openChat(currentUser, u);
          };
          list.appendChild(tile);
        });
      }
    });
  }
  if (tabCommunity) {
    tabCommunity.addEventListener('click', async () => {
      switchTab('community');
      const list = document.getElementById('communityList');
      const activityStream = document.getElementById('activityStream');
      const statMembers = document.getElementById('statMembers');
      const statFeatures = document.getElementById('statFeatures');
      const statReports = document.getElementById('statReports');
      
      try {
        // Fetch stats and activity
        const communityData = await fetchCommunityStats();
        if (statMembers) statMembers.textContent = communityData.stats.active_members;
        if (statFeatures) statFeatures.textContent = communityData.stats.total_features;
        if (statReports) statReports.textContent = communityData.stats.active_reports;

        if (activityStream) {
          activityStream.innerHTML = '';
          if (communityData.activity.length === 0) {
            activityStream.innerHTML = '<div style="font-size:10px; opacity:0.5; text-align:center;">No recent activity.</div>';
          } else {
            communityData.activity.forEach(act => {
              const item = document.createElement('div');
              item.className = 'activity-item';
              const time = new Date(act.created_at).toLocaleDateString();
              const action = act.type === 'feature' ? 'added a feature' : 'commented';
              item.innerHTML = `
                <strong><a href="#" onclick="event.preventDefault(); window.openPublicProfileModal('${act.username}')" class="text-primary no-underline">${act.username || 'Anonymous'}</a></strong> 
                ${action}: <span class="text-muted">"${act.title}"</span> 
                <br><small class="text-xs text-muted">${time}</small>
              `;
              activityStream.appendChild(item);
            });
          }
        }

        // Fetch leaderboard
        const profiles = await fetchPublicProfiles();
        if (list) {
          list.innerHTML = '';
          if (profiles.length === 0) {
            list.innerHTML = '<div style="text-align:center; opacity:0.5; padding:10px;">No public profiles.</div>';
          } else {
            profiles.forEach(p => {
              const tile = document.createElement('div');
              tile.className = 'tile-btn user-tile';
              tile.innerHTML = `
                <img src="${p.avatar_url || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%23ccc%22/></svg>'}" class="avatar-sm">
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
        console.error("Community fetch failed:", err);
      }
    });
  }
  if (tabAdmin) tabAdmin.addEventListener('click', () => switchTab('admin'));

  if (quickReportBtn) {
    quickReportBtn.addEventListener('click', () => {
      alert('Click on the map to report an issue.');
      enableMapPicker((coords) => {
        openModal({
          name: 'New Report',
          category: 'Field Reports',
          status: 'caution',
          public_geometry: { type: 'Point', coordinates: coords },
          geometry: { type: 'Point', coordinates: coords }
        });
      });
    });
  }

  if (helpBtn) helpBtn.addEventListener('click', openHelpModal);
  if (closeHelpBtn) closeHelpBtn.addEventListener('click', closeHelpModal);

  if (addPointBtn) addPointBtn.addEventListener('click', () => openModal(null, 'point'));
  if (addLineBtn) addLineBtn.addEventListener('click', () => openModal(null, 'line'));
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

  const closeChatBtn = document.getElementById('closeChatBtn');
  if (closeChatBtn) {
    closeChatBtn.addEventListener('click', () => {
      import('./chat.js').then(chat => chat.closeChat());
    });
  }

  const closeInfoCardBtn = document.getElementById('closeInfoCard');
  if (closeInfoCardBtn && infoCard) {
    closeInfoCardBtn.addEventListener('click', () => {
      infoCard.style.display = 'none';
    });
  }

  // Layer Toggles
  const knowledgeToggle = document.getElementById('layer-knowledge');
  const officialToggle = document.getElementById('layer-official');
  const reportsToggle = document.getElementById('layer-reports');
  const amenitiesToggle = document.getElementById('layer-amenities');

  if (knowledgeToggle) knowledgeToggle.addEventListener('change', (e) => toggleLayer('knowledge', e.target.checked));
  if (officialToggle) officialToggle.addEventListener('change', (e) => toggleLayer('official', e.target.checked));
  if (reportsToggle) reportsToggle.addEventListener('change', (e) => toggleLayer('reports', e.target.checked));

  // Overlay Toggles
  ['railway', 'cycling_routes', 'hiking_trails'].forEach(id => {
    const el = document.getElementById(`overlay-${id}`);
    if (el) el.addEventListener('change', (e) => toggleOverlay(id, e.target.checked));
  });

  if (basemapSelect) {
    basemapSelect.addEventListener('change', (e) => {
      switchBasemap(e.target.value);
    });
  }

  if (saveDefaultBasemapBtn) {
    saveDefaultBasemapBtn.addEventListener('click', async () => {
      const basemapId = basemapSelect ? basemapSelect.value : 'pioneer';
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      try {
        saveDefaultBasemapBtn.disabled = true;
        saveDefaultBasemapBtn.textContent = 'SAVING...';
        await fetch('/api/me/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ basemap: basemapId, theme: currentTheme })
        });
        saveDefaultBasemapBtn.textContent = 'SAVED!';
        setTimeout(() => {
          saveDefaultBasemapBtn.textContent = 'SET DEFAULT';
          saveDefaultBasemapBtn.disabled = false;
        }, 2000);
      } catch (err) {
        saveDefaultBasemapBtn.textContent = 'ERROR';
        setTimeout(() => {
          saveDefaultBasemapBtn.textContent = 'SET DEFAULT';
          saveDefaultBasemapBtn.disabled = false;
        }, 2000);
      }
    });
  }

  if (amenitiesToggle) {
    amenitiesToggle.addEventListener('change', (e) => {
      toggleLayer('amenities', e.target.checked);
      if (e.target.checked) fetchAmenities();
    });
  }

  if (map) {
    map.on('moveend', () => {
      if (amenitiesToggle && amenitiesToggle.checked) fetchAmenities();
    });
  }

  if (pickOnMapBtn) {
    const drawingControls = document.getElementById('drawing-controls');
    const finishDrawingBtn = document.getElementById('finishDrawingBtn');
    let stopDrawingFn = null;

    pickOnMapBtn.addEventListener('click', () => {
      const type = document.getElementById('f_type').value;
      const geomField = document.getElementById('f_geometry');
      if (type === 'point') {
        const originalText = pickOnMapBtn.textContent;
        pickOnMapBtn.textContent = 'Click on Map...';
        enableMapPicker((coords) => {
          geomField.value = JSON.stringify({ type: 'Point', coordinates: coords });
          pickOnMapBtn.textContent = originalText;
        });
      } else {
        closeModal();
        if (infoCard) infoCard.style.display = 'none';
        document.querySelector('.sidebar').style.display = 'none';
        
        if (drawingControls) drawingControls.style.display = 'flex';
        stopDrawingFn = startLineDrawing(
          (points) => {},
          (finalPoints) => {
            document.querySelector('.sidebar').style.display = 'flex';
            openModal(null, 'line', true);
            document.getElementById('f_geometry').value = JSON.stringify({ type: 'LineString', coordinates: finalPoints });
            if (drawingControls) drawingControls.style.display = 'none';
          }
        );
      }
    });

    if (finishDrawingBtn) {
      finishDrawingBtn.addEventListener('click', () => {
        if (stopDrawingFn) {
          stopDrawingFn();
          stopDrawingFn = null;
        }
      });
    }
  }

  if (featureForm) {
    featureForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('f_id').value;
      try {
        const geomValue = document.getElementById('f_geometry').value;
        if (!geomValue) throw new Error('Pick a location first.');

        const data = {
          name: document.getElementById('f_name').value,
          feature_type: document.getElementById('f_type').value,
          category: document.getElementById('f_category').value,
          status: document.getElementById('f_status').value,
          officiality: document.getElementById('f_officiality').value,
          visibility: document.getElementById('f_visibility').value,
          public_description: document.getElementById('f_description').value,
          surface_note: document.getElementById('f_surface_note').value,
          risk_note: document.getElementById('f_risk_note').value,
          weather_sensitivity: document.getElementById('f_weather').value,
          source_confidence: document.getElementById('f_confidence').value,
          longevity: document.getElementById('f_longevity').value,
          poster_email: document.getElementById('f_poster_email').value,
          geometry: JSON.parse(geomValue),
          sources: Array.from(document.querySelectorAll('.source-link-row')).map(row => ({
            url: row.querySelector('.source-url').value,
            note: row.querySelector('.source-note').value
          })).filter(s => s.url)
        };

        if (id) {
          await updateFeature(id, data);
        } else {
          const result = await createFeature(data);
          if (result.success && data.poster_email && !currentUser) {
            alert(`Success! Delete token: ${result.delete_token}`);
          }
        }
        closeModal();
        await refreshData();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }

  const editProfileBtn = document.getElementById('editProfileBtn');
  if (editProfileBtn) {
    editProfileBtn.addEventListener('click', () => {
      import('./ui.js').then(ui => ui.openProfileEditModal(currentUser));
    });
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
      a.download = `jojomap-chat-key-${currentUser.username || 'user'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
  }

  const importKeyFile = document.getElementById('importKeyFile');
  if (importKeyFile) {
    importKeyFile.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const keyString = event.target.result;
          const cryptoModule = await import('./crypto.js');
          cryptoModule.storePrivateKey(keyString);
          alert('Key imported successfully! Your DMs are now accessible on this device.');
          location.reload();
        } catch (err) {
          alert('Failed to import key: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
  }

  const profileEditForm = document.getElementById('profileEditForm');
  if (profileEditForm) {
    profileEditForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('saveProfileBtn');
      try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        
        const username = document.getElementById('f_profile_username').value;
        const bio = document.getElementById('f_profile_bio').value;
        const social_links = Array.from(document.querySelectorAll('.profile-social-row')).map(row => 
          row.querySelector('.social-url').value
        ).filter(url => url);

        import('./api.js').then(async (api) => {
          await api.updateProfile({ username, bio, social_links });
          
          const avatarInput = document.getElementById('f_avatar_upload');
          if (avatarInput.files && avatarInput.files[0]) {
            await api.uploadAvatar(avatarInput.files[0]);
          }

          document.getElementById('profileEditModal').style.display = 'none';
          alert('Profile updated successfully!');
          location.reload();
        }).catch(err => {
          alert('Error: ' + err.message);
        }).finally(() => {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Profile';
        });
      } catch (err) {
        alert('Error: ' + err.message);
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Profile';
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
