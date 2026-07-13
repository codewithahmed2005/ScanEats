// =====================================================================
// CONFIG: Change this URL when deploying backend to Hugging Face
// =====================================================================
// Hugging Face URL yahan paste karein (Piche slash / mat lagana)
// Purana URL: "https://codewithahmed-scaneats-backend.hf.space"
// Isko badal kar ye lagao (Notice the ".hf.space" changes to "direct.hf.space"):

const BACKEND_URL = "https://codewithahmed-scaneats-backend-direct.hf.space";

const getToken = () => localStorage.getItem('scaneats_token');

// Improved API Fetch with Error Handling
async function apiFetch(endpoint, method = 'GET', body = null) {
    try {
        const headers = { 'Content-Type': 'application/json' };
        if (getToken()) headers['Authorization'] = `Bearer ${getToken()}`;
        
        const res = await fetch(`${API_URL}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null
        });

        // Agar server so raha hai ya HTML response de raha hai, toh JSON parse mat karo
        const contentType = res.headers.get("content-type");
        if (!res.ok || !contentType || !contentType.includes("application/json")) {
            // Check agar server sleeping/sleep state mein hai
            if (res.status === 503 || res.status === 502) {
                throw new Error("Backend server is sleeping. Please try again in 30 seconds.");
            }
            throw new Error("Server returned an invalid response.");
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Server Error');
        return data;
    } catch (error) {
        console.error('API Error:', error);
        if (!document.getElementById('authForm')) showToast(error.message, 'error');
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

    if (getToken()) window.location.href = 'dashboard.html';

    const toggleForm = document.getElementById('toggleForm');
    const formTitle = document.getElementById('formTitle');
    const signupFields = document.getElementById('signupFields');
    const submitBtn = authForm.querySelector('button[type="submit"]');
    const loadingOverlay = document.getElementById('loadingOverlay');

    // Password Hide/Show Logic
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

        setTimeout(async () => {
            const data = await apiFetch(endpoint, 'POST', payload);
            loadingOverlay.style.display = 'none';
            
            if (data.success) {
                localStorage.setItem('scaneats_token', data.token);
                window.location.href = 'dashboard.html';
            } else {
                errorDiv.textContent = data.error || 'Something went wrong';
                errorDiv.style.display = 'block';
            }
        }, 1500); // 1.5 seconds delay
    });
}

// =====================================================================
// 2. DASHBOARD LOGIC (dashboard.html)
// =====================================================================
const menuForm = document.getElementById('menuForm');
if (menuForm) {
    if (!getToken()) window.location.href = 'index.html';

    let currentRestaurant = null;
    let allItems = [];

    // NEW: Profile Settings Logic
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
        const data = await apiFetch('/api/me');
        if (data.id) {
            currentRestaurant = data;
            document.getElementById('restoName').textContent = data.restaurant_name;
            document.getElementById('viewMenuLink').href = `menu.html?id=${data.id}`;
            
            // Populate settings fields
            document.getElementById('settings_resto_name').value = data.restaurant_name || '';
            document.getElementById('settings_upi_id').value = data.upi_id || '';
            
            await loadMenuItems();
        } else {
            localStorage.removeItem('scaneats_token');
            window.location.href = 'index.html';
        }
    }

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('scaneats_token');
        window.location.href = 'index.html';
    });

    async function loadMenuItems() {
        const list = document.getElementById('menuList');
        list.innerHTML = '<p class="loading-text">Loading items...</p>';
        
        const data = await apiFetch('/api/menu-items');
        if (!data.error) {
            allItems = Array.isArray(data) ? data : [];
            renderMenu();
        } else {
            list.innerHTML = `<p class="loading-text" style="color:red;">Failed to load items.</p>`;
        }
    }

    // NEW: Update Stats dynamically
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
                    <!-- Toggle Switch -->
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
        
        updateStats(); // Call stats update every time menu renders
    }

    // NEW: Toggle Active Status Function
    window.toggleActive = async (id) => {
        const data = await apiFetch(`/api/menu/toggle/${id}`, 'PUT');
        if (data.success) {
            showToast('Item status updated!');
            const item = allItems.find(i => i.id === id);
            if (item) item.is_active = data.is_active;
            renderMenu();
        }
    }

    menuForm.addEventListener('submit', async (e) => {
        e.preventDefault();
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
        const data = await apiFetch(endpoint, method, payload);

        if (data.success) {
            showToast(id ? 'Item updated!' : 'Item added!');
            resetForm();
            await loadMenuItems();
        } else {
            showToast('Error saving item', 'error');
        }
    });

    window.editItem = (id) => {
        const item = allItems.find(i => i.id === id);
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
        const data = await apiFetch(`/api/menu-items/${id}`, 'DELETE');
        if (data.success) {
            showToast('Item deleted!');
            await loadMenuItems();
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
        const data = await apiFetch('/api/generate-qr', 'POST');
        if (data.success) {
            document.getElementById('qrDisplay').innerHTML = `<img src="${data.qr_base64}" alt="QR Code">`;
            const link = document.getElementById('downloadQrLink');
            link.href = data.qr_base64;
            link.download = `scaneats_menu_${currentRestaurant.id}.png`;
            link.style.display = 'inline-block';
            showToast('QR Generated!');
        } else {
            showToast('Failed to generate QR', 'error');
        }
    });

    initDashboard();
}

// =====================================================================
// 3. CUSTOMER MENU LOGIC (menu.html)
// =====================================================================
const menuContent = document.getElementById('menuContent');
if (menuContent) {
    const params = new URLSearchParams(window.location.search);
    const restaurantId = params.get('id');

    let allMenuItems = []; // Store all items globally for filtering
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
            menuContent.innerHTML = '<h2>Menu not found</h2>';
            document.getElementById('loading').style.display = 'none';
            return;
        }

        document.getElementById('restaurantName').textContent = data.restaurant_name;
        document.title = `${data.restaurant_name} - Menu`;
        allMenuItems = data.items; // Save globally

        // Attach event listeners for search and veg toggle
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

        // Filter items based on search and veg toggle
        let filteredItems = allMenuItems.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm) || (item.description && item.description.toLowerCase().includes(searchTerm));
            const matchesVeg = !isVegOnly || item.is_veg;
            return matchesSearch && matchesVeg;
        });

        if (filteredItems.length === 0) {
            menuContent.innerHTML = '<p style="text-align:center; color:#64748b; margin-top: 40px;">No items match your search.</p>';
            return;
        }

        // Group by category
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
                        <div style="display:flex;">
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
