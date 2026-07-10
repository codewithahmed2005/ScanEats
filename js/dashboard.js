const API_URL = 'https://codewithahmed-scaneats-backend.hf.space';
let allItems = [];
let currentFilter = 'all';
let currentRestaurant = null;

const menuItemForm = document.getElementById('menuItemForm');
const menuItemsList = document.getElementById('menuItemsList');
const filterCategory = document.getElementById('filterCategory');
const generateQrBtn = document.getElementById('generateQrBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const toast = document.getElementById('toast');
const logoutBtn = document.getElementById('logoutBtn');

async function initDashboard() {
    try {
        const res = await fetch(`${API_URL}/api/me`, { credentials: 'include' });
        
        if (!res.ok) {
            window.location.href = './index.html';
            return;
        }
        
        currentRestaurant = await res.json();
        
        document.getElementById('restoName').textContent = currentRestaurant.restaurant_name;
        document.getElementById('ownerName').textContent = 'Owner: ' + currentRestaurant.owner_name;
        document.getElementById('viewMenuLink').href = `./menu.html?id=${currentRestaurant.id}`;
        
        await loadMenuItems();
        
    } catch (err) {
        console.error('Error initializing dashboard:', err);
        document.body.innerHTML = '<h1 style="text-align:center; margin-top:50px;">Cannot connect to backend server. Make sure it is running on port 5000.</h1>';
    }
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await fetch(`${API_URL}/api/logout`, { method: 'POST', credentials: 'include' });
        } catch (err) {}
        window.location.href = './index.html';
    });
}

function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => { toast.className = 'toast'; }, 3000);
}

async function loadMenuItems() {
    try {
        const response = await fetch(`${API_URL}/api/menu-items`, { credentials: 'include' });
        allItems = await response.json();
        renderMenuItems();
        updateStats();
    } catch (err) {
        menuItemsList.innerHTML = '<div class="loading">Error loading items.</div>';
    }
}

function updateStats() {
    document.getElementById('totalItems').textContent = allItems.length;
    document.getElementById('vegItems').textContent = allItems.filter(i => i.is_veg).length;
    document.getElementById('nonVegItems').textContent = allItems.filter(i => !i.is_veg).length;
    document.getElementById('totalCategories').textContent = new Set(allItems.map(i => i.category)).size;
}

function renderMenuItems() {
    const filtered = currentFilter === 'all' ? allItems : allItems.filter(item => item.category === currentFilter);
    if (filtered.length === 0) {
        menuItemsList.innerHTML = `<div class="loading">No menu items found.</div>`;
        return;
    }
    menuItemsList.innerHTML = filtered.map(item => `
        <div class="menu-item-row ${item.is_veg ? '' : 'non-veg'}">
            <div class="veg-indicator ${item.is_veg ? 'veg' : 'non-veg'}"></div>
            <div class="item-info">
                <div class="item-name">${escapeHtml(item.name)}</div>
                <div class="item-category">${escapeHtml(item.category)}</div>
                ${item.description ? `<div class="item-desc">${escapeHtml(item.description)}</div>` : ''}
            </div>
            <div class="item-price">₹${item.price.toFixed(2)}</div>
            <div class="item-actions">
                <button class="btn-edit" onclick="editItem(${item.id})">Edit</button>
                <button class="btn-delete" onclick="deleteItem(${item.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

if (menuItemForm) {
    menuItemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const itemId = document.getElementById('itemId').value;
        const data = {
            name: document.getElementById('name').value,
            description: document.getElementById('description').value,
            price: document.getElementById('price').value,
            category: document.getElementById('category').value,
            is_veg: document.getElementById('is_veg').value === 'true'
        };

        try {
            const url = itemId ? `${API_URL}/api/menu-items/${itemId}` : `${API_URL}/api/menu-items`;
            const method = itemId ? 'PUT' : 'POST';
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (result.success) {
                showToast(itemId ? 'Item updated!' : 'Item added!');
                resetForm();
                await loadMenuItems();
            } else {
                showToast('Error saving item.', 'error');
            }
        } catch (err) {
            showToast('Network error.', 'error');
        }
    });
}

window.editItem = function(id) {
    const item = allItems.find(i => i.id === id);
    if (!item) return;
    document.getElementById('itemId').value = item.id;
    document.getElementById('name').value = item.name;
    document.getElementById('description').value = item.description || '';
    document.getElementById('price').value = item.price;
    document.getElementById('category').value = item.category;
    document.getElementById('is_veg').value = item.is_veg ? 'true' : 'false';
    document.getElementById('formTitle').textContent = '✏️ Edit Menu Item';
    document.getElementById('submitBtn').textContent = 'Update Item';
    cancelEditBtn.style.display = 'inline-block';
    menuItemForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.deleteItem = async function(id) {
    if (!confirm('Delete this menu item?')) return;
    try {
        const response = await fetch(`${API_URL}/api/menu-items/${id}`, { method: 'DELETE', credentials: 'include' });
        const result = await response.json();
        if (result.success) {
            showToast('Item deleted!');
            await loadMenuItems();
            if (document.getElementById('itemId').value == id) resetForm();
        }
    } catch (err) {
        showToast('Network error.', 'error');
    }
};

function resetForm() {
    menuItemForm.reset();
    document.getElementById('itemId').value = '';
    document.getElementById('formTitle').textContent = '➕ Add New Menu Item';
    document.getElementById('submitBtn').textContent = 'Add Item';
    cancelEditBtn.style.display = 'none';
}

if (cancelEditBtn) cancelEditBtn.addEventListener('click', resetForm);

if (filterCategory) {
    filterCategory.addEventListener('change', (e) => {
        currentFilter = e.target.value;
        renderMenuItems();
    });
}

if (generateQrBtn) {
    generateQrBtn.addEventListener('click', async () => {
        generateQrBtn.textContent = '⏳ Generating...';
        generateQrBtn.disabled = true;
        try {
            const response = await fetch(`${API_URL}/api/generate-qr`, { method: 'POST', credentials: 'include' });
            const result = await response.json();
            if (result.success) {
                document.getElementById('qrDisplay').innerHTML = `<img src="${result.qr_base64}" alt="QR Code">`;
                const downloadLink = document.getElementById('downloadQrLink');
                downloadLink.href = result.qr_base64;
                downloadLink.download = `qr_menu_${currentRestaurant.id}.png`;
                downloadLink.style.display = 'inline-block';
                document.getElementById('qrUrlDisplay').textContent = `Menu URL: ${result.menu_url}`;
                document.getElementById('qrUrlDisplay').style.display = 'block';
                showToast('QR Code generated!');
            } else {
                showToast('Failed to generate QR.', 'error');
            }
        } catch (err) {
            showToast('Network error.', 'error');
        } finally {
            generateQrBtn.textContent = '⚡ Generate QR Code';
            generateQrBtn.disabled = false;
        }
    });
}

initDashboard();
