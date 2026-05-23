import { fetchFeatures, createFeature, updateFeature } from './api.js';
import { initLeafletMap, renderMap, flyToFeature, enableMapPicker, toggleLayer, fetchAmenities, map, switchBasemap } from './map.js';
import { updateInfoCard, renderLegend, initThemeToggle, openModal, closeModal, openHelpModal, closeHelpModal, switchTab } from './ui.js';
import { downloadGeoJSON } from './utils.js';

// DOM Elements
const infoCard = document.getElementById('infoCard');
const legendStack = document.getElementById('legendStack');
const searchInput = document.getElementById('searchInput');
const submitLoginBtn = document.getElementById('submitLoginBtn');
const adminTokenInput = document.getElementById('adminTokenInput');
const loginView = document.getElementById('login-view');
const logoutBtn = document.getElementById('logoutBtn');
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

// Tabs
const tabExplore = document.getElementById('tab-explore');
const tabSearch = document.getElementById('tab-search');
const tabAdmin = document.getElementById('tab-admin');

// User Auth Elements
const sendMagicLinkBtn = document.getElementById('sendMagicLinkBtn');
const loginEmailInput = document.getElementById('loginEmailInput');
const userLoggedOutView = document.getElementById('user-logged-out');
const userLoggedInView = document.getElementById('user-logged-in');
const userEmailDisplay = document.getElementById('userEmailDisplay');
const userLogoutBtn = document.getElementById('userLogoutBtn');

let allFeatures = [];
let isAdmin = !!localStorage.getItem('ADMIN_TOKEN');

function updateAdminUI() {
  if (isAdmin) {
    if (loginView) loginView.style.display = 'none';
    if (adminActions) adminActions.style.display = 'block';
    if (logoutBtn) logoutBtn.style.display = 'block';
  } else {
    if (loginView) loginView.style.display = 'block';
    if (adminActions) adminActions.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
  }
  
  if (allFeatures.length) {
    renderMap(allFeatures, allFeatures.length, (f) => updateInfoCard(f, infoCard, isAdmin));
    renderLegend(allFeatures, legendStack, (f) => flyToFeature(f, (feature) => updateInfoCard(feature, infoCard, isAdmin)));
  }
}

async function refreshData() {
  try {
    allFeatures = await fetchFeatures();
    renderMap(allFeatures, allFeatures.length, (f) => updateInfoCard(f, infoCard, isAdmin), handleMarkerDrag);
    renderLegend(allFeatures, legendStack, (f) => flyToFeature(f, (feature) => updateInfoCard(feature, infoCard, isAdmin)));
  } catch (err) {
    console.error('Failed to fetch features:', err);
  }
}

async function handleMarkerDrag(feature, newCoords) {
  if (!isAdmin) return;
  const token = localStorage.getItem('ADMIN_TOKEN');
  try {
    const updated = { ...feature, geometry: { type: 'Point', coordinates: newCoords } };
    await updateFeature(feature.id, updated, token);
    console.log(`Updated position for ${feature.name}`);
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
  initThemeToggle();
  initLeafletMap('map', [39.03, -94.535], 12);
  updateAdminUI();
  await refreshData();
  initCryptAnimations();

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = allFeatures.filter(f =>
        f.name.toLowerCase().includes(q) ||
        (f.public_description && f.public_description.toLowerCase().includes(q)) ||
        f.category.toLowerCase().includes(q)
      );
      renderMap(filtered, allFeatures.length, (f) => updateInfoCard(f, infoCard, isAdmin), handleMarkerDrag);
      renderLegend(filtered, legendStack, (f) => flyToFeature(f, (feature) => updateInfoCard(feature, infoCard, isAdmin)));
    });
  }

  if (submitLoginBtn) {
    submitLoginBtn.addEventListener('click', () => {
      const token = adminTokenInput.value;
      if (token) {
        localStorage.setItem('ADMIN_TOKEN', token);
        isAdmin = true;
        adminTokenInput.value = '';
        updateAdminUI();
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('ADMIN_TOKEN');
      isAdmin = false;
      updateAdminUI();
    });
  }

  const checkUserAuth = async () => {
    try {
      const resp = await fetch('/api/me');
      if (resp.ok) {
        const data = await resp.json();
        if (data.authenticated) {
          if (userLoggedOutView) userLoggedOutView.style.display = 'none';
          if (userLoggedInView) userLoggedInView.style.display = 'block';
          if (userEmailDisplay) userEmailDisplay.textContent = data.user.email;
          isAdmin = isAdmin || data.user.role === 'admin';
          
          // Apply saved basemap preference
          if (data.preferences && data.preferences.basemap) {
            switchBasemap(data.preferences.basemap);
            if (basemapSelect) basemapSelect.value = data.preferences.basemap;
          }
          
          updateAdminUI();
        }
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
        const resp = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        await resp.json();
        alert('Verification link sent! Please check your inbox (and spam folder) for your secure magic link.');
      } catch (err) {
        alert('Failed to send link: ' + err.message);
      } finally {
        sendMagicLinkBtn.disabled = false;
        sendMagicLinkBtn.textContent = 'Send Link';
      }
    });
  }

  if (userLogoutBtn) {
    userLogoutBtn.addEventListener('click', () => {
      document.cookie = "session=; Max-Age=0; path=/;";
      location.reload();
    });
  }

  checkUserAuth();

  if (exportGeoJsonBtn) {
    exportGeoJsonBtn.addEventListener('click', () => {
      downloadGeoJSON(allFeatures);
    });
  }

  if (importMarcBtn) {
    importMarcBtn.addEventListener('click', async () => {
      if (!confirm('This will fetch and import the latest MARC data. Continue?')) return;
      const token = localStorage.getItem('ADMIN_TOKEN');
      try {
        importMarcBtn.disabled = true;
        importMarcBtn.textContent = 'Importing...';
        const resp = await fetch('/admin/import-marc', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
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
  if (tabAdmin) tabAdmin.addEventListener('click', () => switchTab('admin'));

  if (quickReportBtn) {
    quickReportBtn.addEventListener('click', () => {
      alert('Click on the map to report an issue (mud, flooding, construction).');
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

  // Layer Toggles
  const intelToggle = document.getElementById('layer-intel');
  const officialToggle = document.getElementById('layer-official');
  const reportsToggle = document.getElementById('layer-reports');
  const amenitiesToggle = document.getElementById('layer-amenities');

  if (intelToggle) intelToggle.addEventListener('change', (e) => toggleLayer('intel', e.target.checked));
  if (officialToggle) officialToggle.addEventListener('change', (e) => toggleLayer('official', e.target.checked));
  if (reportsToggle) reportsToggle.addEventListener('change', (e) => toggleLayer('reports', e.target.checked));

  const basemapSelect = document.getElementById('basemapSelect');
  if (basemapSelect) {
    basemapSelect.addEventListener('change', async (e) => {
      const basemapId = e.target.value;
      switchBasemap(basemapId);
      
      // Save to KV if logged in
      const hasSession = document.cookie.includes('session=');
      if (hasSession) {
        try {
          await fetch('/api/me/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ basemap: basemapId })
          });
        } catch (err) {
          console.error('Failed to save preferences:', err);
        }
      }
    });
  }

  if (amenitiesToggle) {
    amenitiesToggle.addEventListener('change', (e) => {
      toggleLayer('amenities', e.target.checked);
      if (e.target.checked) fetchAmenities();
    });
  }

  let moveTimeout;
  if (map) {
    map.on('moveend', () => {
      clearTimeout(moveTimeout);
      moveTimeout = setTimeout(() => {
        if (amenitiesToggle && amenitiesToggle.checked) fetchAmenities();
      }, 500); // 500ms debounce
    });
  }

  if (pickOnMapBtn) {
    pickOnMapBtn.addEventListener('click', () => {
      const type = document.getElementById('f_type').value;
      const geomField = document.getElementById('f_geometry');
      
      if (type === 'point') {
        enableMapPicker((coords) => {
          geomField.value = JSON.stringify({ type: 'Point', coordinates: coords });
        });
      } else {
        alert('Click on the map to add the FIRST point of the line. Manual editing recommended for complex lines.');
        enableMapPicker((coords) => {
          const current = JSON.parse(geomField.value || '{"type":"LineString","coordinates":[]}');
          current.coordinates.push(coords);
          geomField.value = JSON.stringify(current);
        });
      }
    });
  }

  if (featureForm) {
    featureForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = localStorage.getItem('ADMIN_TOKEN');
      const id = document.getElementById('f_id').value;
      const data = {
        name: document.getElementById('f_name').value,
        feature_type: document.getElementById('f_type').value,
        category: document.getElementById('f_category').value,
        status: document.getElementById('f_status').value,
        officiality: document.getElementById('f_officiality').value,
        visibility: document.getElementById('f_visibility').value,
        public_description: document.getElementById('f_description').value,
        surface_note: document.getElementById('f_surface_note').value,
        longevity: document.getElementById('f_longevity').value,
        poster_email: document.getElementById('f_poster_email').value,
        geometry: JSON.parse(document.getElementById('f_geometry').value)
      };

      try {
        let result;
        if (id) {
          result = await updateFeature(id, data, token);
        } else {
          result = await createFeature(data, token);
          if (result.success && data.poster_email) {
            alert(`Success! To delete this report later without an account, save this token: ${result.delete_token}\n(Normally we would email this to you)`);
          }
        }
        closeModal();
        await refreshData();
      } catch (err) {
        alert('Error saving feature: ' + err.message);
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
