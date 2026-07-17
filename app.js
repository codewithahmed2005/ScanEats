// =====================================================================
// CONFIG: Change this URL when deploying backend
// =====================================================================
const API_URL = 'https://scaneats-backend.onrender.com'; 

const getToken = () => localStorage.getItem('scaneats_token');

// Improved API Fetch with Error Handling
async function apiFetch(endpoint, method = 'GET', body = null) {
    try {
        const headers = { 'Content-Type': 'application/json' };
        const token = getToken();
        
        // Token sirf non-OPTIONS requests mein bhejo
        if (token && method !== 'OPTIONS') {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const res = await fetch(`${API_URL}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null
        });

        // Handle 401 Unauthorized
        if (res.status === 401) {
            localStorage.removeItem('scaneats_token');
            if (!document.getElementById('authForm')) {
                window.location.href = 'index.html';
            }
            return { error: 'Unauthorized' };
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Server Error');
        return data;
    } catch (error) {
        console.error('API Error:', error);
        return { error: error.message };
    }
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return alert(msg);
    toast.textContent = msg;
    toast.style.background = type === 'error' ? '#ef4444' : '#1e293b';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// =====================================================================
// 1. AUTH LOGIC (index.html)
// =====================================================================
const authForm = document.getElementById('authForm');
if (authForm) {
    let isSignup = false;

    if (getToken()) {
        window.location.href = 'dashboard.html';
    }

    const toggleForm = document.getElementById('toggleForm');
    const formTitle = document.getElementById('formTitle');
    const signupFields = document.getElementById('signupFields');
    const submitBtn = authForm.querySelector('button[type="submit"]');
    const loadingOverlay = document.getElementById('loadingOverlay');

    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
        });
    }

    toggleForm.addEventListener('click', (e) => {
        e.preventDefault();
        isSignup = !isSignup;
        if (isSignup) {
            signupFields.style.display = 'block';
            formTitle.textContent = 'Create New Account';
            submitBtn.textContent = 'Sign Up';
            toggleForm.textContent = 'Login here';
        } else {
            signupFields.style.display = 'none';
            formTitle.textContent = 'Login to your Account';
            submitBtn.textContent = 'Login';
            toggleForm.textContent = 'Sign up here';
        }
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('errorMsg');
        errorDiv.style.display = 'none';
        
        let payload = { email, password };
        let endpoint = '/api/login';

        if (isSignup) {
            payload.restaurant_name = document.getElementById('restaurant_name').value;
            payload.owner_name = document.getElementById('owner_name').value;
            endpoint = '/api/signup';
            if (!payload.restaurant_name || !payload.owner_name) {
                errorDiv.textContent = 'Please fill all fields';
                errorDiv.style.display = 'block';
                return;
            }
        }

        loadingOverlay.style.display = 'flex';

        const data = await apiFetch(endpoint, 'POST', payload);
        loadingOverlay.style.display = 'none';
        
        if (data.success) {
            localStorage.setItem('scaneats_token', data.token);
            window.location.href = 'dashboard.html';
        } else {
            errorDiv.textContent = data.error || 'Something went wrong';
            errorDiv.style.display = 'block';
        }
    });
}

// =====================================================================
// 2. DASHBOARD LOGIC (dashboard.html)
// =====================================================================
const menuForm = document.getElementById('menuForm');
if (menuForm) {
    let currentRestaurant = null;
    let allItems = [];
    let isInitialized = false;

    // Profile Settings Logic
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                restaurant_name: document.getElementById('settings_resto_name').value,
                upi_id: document.getElementById('settings_upi_id').value
            };
            const data = await apiFetch('/api/profile', 'PUT', payload);
            if (data.success) {
                showToast('Settings Saved!');
                document.getElementById('restoName').textContent = payload.restaurant_name;
            }
        });
    }

    async function initDashboard() {
        if (isInitialized) return;
        
        if (!getToken()) {
            window.location.href = 'index.html';
            return;
        }

        try {
            console.log('Fetching /api/me with token:', getToken());
            const data = await apiFetch('/api/me', 'GET');
            console.log('/api/me response:', data);
            
            if (data && data.id) {
                isInitialized = true;
                currentRestaurant = data;
                document.getElementById('restoName').textContent = data.restaurant_name;
                document.getElementById('viewMenuLink').href = `menu.html?id=${data.id}`;
                document.getElementById('settings_resto_name').value = data.restaurant_name || '';
                document.getElementById('settings_upi_id').value = data.upi_id || '';
                await loadMenuItems();
            } else if (data.error === 'Unauthorized') {
                localStorage.removeItem('scaneats_token');
                window.location.href = 'index.html';
            } else {
                setTimeout(initDashboard, 2000);
            }
        } catch (error) {
            console.error('Dashboard init error:', error);
            setTimeout(initDashboard, 2000);
        }
    }

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('scaneats_token');
        window.location.href = 'index.html';
    });

    async function loadMenuItems() {
        const list = document.getElementById('menuList');
        list.innerHTML = '<p class="loading-text">Loading items...</p>';
        
        if (!getToken()) {
            list.innerHTML = '<p class="loading-text" style="color:red;">Please login again</p>';
            window.location.href = 'index.html';
            return;
        }
        
        const data = await apiFetch('/api/menu-items');
        console.log('Menu items response:', data);
        
        if (!data.error && Array.isArray(data)) {
            allItems = data;
            renderMenu();
        } else {
            list.innerHTML = `<p class="loading-text" style="color:red;">Failed to load items: ${data.error || 'Unknown error'}</p>`;
        }
    }

    function updateStats() {
        document.getElementById('totalItems').textContent = allItems.length;
        document.getElementById('vegItems').textContent = allItems.filter(i => i.is_veg).length;
        document.getElementById('nonVegItems').textContent = allItems.filter(i => !i.is_veg).length;
    }

    function renderMenu() {
        const list = document.getElementById('menuList');
        if (allItems.length === 0) {
            list.innerHTML = '<p class="loading-text">No items added yet.</p>';
            updateStats();
            return;
        }
        list.innerHTML = allItems.map(item => `
            <div class="menu-item-row" style="${!item.is_active ? 'opacity: 0.5;' : ''}">
                <div class="item-info">
                    <div class="item-name">${item.name} ${item.is_veg ? '🟢' : '🔴'}</div>
                    <div class="item-desc">${item.description || ''}</div>
                    <div class="item-category">${item.category} ${!item.is_active ? '(Inactive)' : ''}</div>
                </div>
                <div class="item-price">₹${item.price}</div>
                
                <div style="display:flex; align-items:center; gap:10px;">
                    <label class="switch">
                        <input type="checkbox" onchange="toggleActive(${item.id})" ${item.is_active ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    
                    <div class="item-actions">
                        <button class="btn-sm btn-edit" onclick="editItem(${item.id})">Edit</button>
                        <button class="btn-sm btn-delete" onclick="deleteItem(${item.id})">Del</button>
                    </div>
                </div>
            </div>
        `).join('');
        
        updateStats();
    }

    window.toggleActive = async (id) => {
        if (!getToken()) {
            showToast('Please login again', 'error');
            window.location.href = 'index.html';
            return;
        }
        
        const data = await apiFetch(`/api/menu/toggle/${id}`, 'PUT');
        if (data.success) {
            showToast('Item status updated!');
            const item = allItems.find(i => i.id === id);
            if (item) item.is_active = data.is_active;
            renderMenu();
        } else {
            showToast('Failed to update status', 'error');
        }
    }

    menuForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!getToken()) {
            showToast('Please login again', 'error');
            window.location.href = 'index.html';
            return;
        }
        
        const id = document.getElementById('itemId').value;
        const payload = {
            name: document.getElementById('name').value,
            description: document.getElementById('description').value,
            price: document.getElementById('price').value,
            category: document.getElementById('category').value,
            is_veg: document.getElementById('is_veg').value === 'true'
        };

        const method = id ? 'PUT' : 'POST';
        const endpoint = id ? `/api/menu-items/${id}` : '/api/menu-items';
        
        console.log('Sending request:', { method, endpoint, payload });
        
        const data = await apiFetch(endpoint, method, payload);
        
        console.log('Response:', data);

        if (data.success) {
            showToast(id ? 'Item updated!' : 'Item added!');
            resetForm();
            await loadMenuItems();
        } else {
            showToast(data.error || 'Error saving item', 'error');
        }
    });

    window.editItem = (id) => {
        const item = allItems.find(i => i.id === id);
        if (!item) return;
        document.getElementById('itemId').value = item.id;
        document.getElementById('name').value = item.name;
        document.getElementById('description').value = item.description || '';
        document.getElementById('price').value = item.price;
        document.getElementById('category').value = item.category;
        document.getElementById('is_veg').value = item.is_veg.toString();
        document.getElementById('formTitle').textContent = '✏️ Edit Item';
        document.getElementById('submitBtn').textContent = 'Update Item';
        document.getElementById('cancelBtn').style.display = 'block';
        window.scrollTo(0, 0);
    };

    window.deleteItem = async (id) => {
        if (!confirm('Delete this item?')) return;
        
        if (!getToken()) {
            showToast('Please login again', 'error');
            window.location.href = 'index.html';
            return;
        }
        
        const data = await apiFetch(`/api/menu-items/${id}`, 'DELETE');
        if (data.success) {
            showToast('Item deleted!');
            await loadMenuItems();
        } else {
            showToast('Failed to delete item', 'error');
        }
    };

    function resetForm() {
        menuForm.reset();
        document.getElementById('itemId').value = '';
        document.getElementById('formTitle').textContent = '➕ Add Menu Item';
        document.getElementById('submitBtn').textContent = 'Add Item';
        document.getElementById('cancelBtn').style.display = 'none';
    }
    document.getElementById('cancelBtn').addEventListener('click', resetForm);

    document.getElementById('generateQrBtn').addEventListener('click', async () => {
        if (!getToken()) {
            showToast('Please login again', 'error');
            window.location.href = 'index.html';
            return;
        }
        
        const data = await apiFetch('/api/generate-qr', 'POST');
        if (data.success) {
            document.getElementById('qrDisplay').innerHTML = `<img src="${data.qr_base64}" alt="QR Code">`;
            const link = document.getElementById('downloadQrLink');
            link.href = data.qr_base64;
            link.download = `scaneats_menu_${currentRestaurant.id}.png`;
            link.style.display = 'inline-block';
            showToast('QR Generated!');
        } else {
            showToast(data.error || 'Failed to generate QR', 'error');
        }
    });

    // Initialize dashboard only once
    if (!isInitialized) {
        initDashboard();
    }
}

// =====================================================================
// 3. CUSTOMER MENU LOGIC (menu.html)
// =====================================================================
const menuContent = document.getElementById('menuContent');
if (menuContent) {
    const params = new URLSearchParams(window.location.search);
    const restaurantId = params.get('id');

    let allMenuItems = [];
    let isVegOnly = false;
    let searchTerm = '';

    async function loadPublicMenu() {
        if (!restaurantId) {
            menuContent.innerHTML = '<h2>Invalid Menu Link</h2>';
            document.getElementById('loading').style.display = 'none';
            return;
        }

        const data = await apiFetch(`/api/menu/${restaurantId}`);
        if (data.error) {
            menuContent.innerHTML = `<h2>${data.error || 'Menu not found'}</h2>`;
            document.getElementById('loading').style.display = 'none';
            return;
        }

        document.getElementById('restaurantName').textContent = data.restaurant_name;
        document.title = `${data.restaurant_name} - Menu`;
        allMenuItems = data.items || [];

        document.getElementById('searchInput').addEventListener('input', (e) => {
            searchTerm = e.target.value.toLowerCase();
            renderFilteredMenu();
        });
        document.getElementById('vegOnlyToggle').addEventListener('change', (e) => {
            isVegOnly = e.target.checked;
            renderFilteredMenu();
        });

        renderFilteredMenu();
        document.getElementById('loading').style.display = 'none';
    }

    function renderFilteredMenu() {
        if (allMenuItems.length === 0) {
            menuContent.innerHTML = '<p style="text-align:center; color:#64748b;">No menu items available.</p>';
            return;
        }

        let filteredItems = allMenuItems.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm) || 
                                 (item.description && item.description.toLowerCase().includes(searchTerm));
            const matchesVeg = !isVegOnly || item.is_veg;
            return matchesSearch && matchesVeg;
        });

        if (filteredItems.length === 0) {
            menuContent.innerHTML = '<p style="text-align:center; color:#64748b; margin-top: 40px;">No items match your search.</p>';
            return;
        }

        const grouped = {};
        filteredItems.forEach(item => {
            if (!grouped[item.category]) grouped[item.category] = [];
            grouped[item.category].push(item);
        });

        menuContent.innerHTML = Object.entries(grouped).map(([category, items]) => `
            <div class="menu-category">
                <h2 class="category-title">${category}</h2>
                ${items.map(item => `
                    <div class="menu-item-card">
                        <div style="display:flex; gap:10px;">
                            <div class="veg-badge ${item.is_veg ? 'veg' : 'non-veg'}"></div>
                            <div>
                                <div style="font-weight:600; font-size:16px;">${item.name}</div>
                                <div style="font-size:13px; color:#64748b;">${item.description || ''}</div>
                            </div>
                        </div>
                        <div style="font-weight:700; color:#4f46e5;">₹${item.price}</div>
                    </div>
                `).join('')}
            </div>
        `).join('');
    }

    loadPublicMenu();
}
