// =====================================================================
// CONFIG
// =====================================================================
const API_URL = 'https://scaneats-backend.onrender.com';
const FRONTEND_URL = 'https://scan-eats-sandy.vercel.app';

const getToken = () => localStorage.getItem('scaneats_token');

// =====================================================================
// API FETCH
// =====================================================================
async function apiFetch(endpoint, method = 'GET', body = null) {
    try {
        const headers = { 'Content-Type': 'application/json' };
        const token = getToken();
        if (token && method !== 'OPTIONS') {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(`${API_URL}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null
        });
        if (res.status === 401) {
            localStorage.removeItem('scaneats_token');
            if (!document.getElementById('authForm')) {
                window.location.href = 'auth.html';
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
    toast.className = 'toast show ' + type;
    toast.style.background = type === 'error' ? '#ef4444' :
        type === 'warning' ? '#f59e0b' : '#1e293b';
    toast.style.color = type === 'warning' ? '#1e1e2a' : '#fff';
    setTimeout(() => toast.classList.remove('show'), 5000);
}

// =====================================================================
// GOOGLE OAUTH HANDLER
// =====================================================================

(function handleGoogleOAuth() {
    if (!window.location.pathname.includes('auth.html')) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const googleAuth = urlParams.get('google_auth');
    const error = urlParams.get('error');
    
    console.log('🔍 Google OAuth Params:', { token: !!token, googleAuth, error });
    
    if (error) {
        console.log('❌ Google Auth Error:', error);
        setTimeout(function() {
            const errorDiv = document.getElementById('errorMsg');
            if (errorDiv) {
                errorDiv.textContent = 'Google login failed. Please try again.';
                errorDiv.style.display = 'block';
            }
        }, 500);
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
    }
    
    if (token && googleAuth === 'success') {
        console.log('✅ Google Auth Success! Token received');
        localStorage.setItem('scaneats_token', token);
        showToast('✅ Google login successful!', 'success');
        setTimeout(function() {
            window.location.href = 'dashboard.html';
        }, 1000);
    }
})();

// =====================================================================
// ⭐ RAZORPAY PAYMENT FUNCTIONS (SECURE)
// =====================================================================

async function loadRazorpayScript() {
    return new Promise((resolve, reject) => {
        if (typeof Razorpay !== 'undefined') {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function startPayment(plan = '3_months') {
    const token = getToken();
    if (!token) {
        showToast('Please login again', 'error');
        window.location.href = 'auth.html';
        return;
    }
    
    try {
        showToast('Creating order...', 'warning');
        
        const orderData = await apiFetch('/api/create-order', 'POST', { plan: plan });
        
        if (orderData.error) {
            showToast(orderData.error, 'error');
            return;
        }
        
        if (orderData.already_subscribed) {
            showToast('You already have an active subscription!', 'warning');
            return;
        }
        
        await loadRazorpayScript();
        
        const options = {
            key: orderData.key_id,
            amount: orderData.amount,
            currency: orderData.currency,
            name: 'ScanEats',
            description: orderData.plan_name,
            image: 'https://codewithahmed2005.github.io/ScanEats/logo.png',
            order_id: orderData.order_id,
            handler: function(response) {
                verifyPayment(response);
            },
            prefill: {
                name: document.getElementById('restoName')?.textContent || '',
                email: localStorage.getItem('user_email') || ''
            },
            theme: {
                color: '#1e1e2a'
            },
            // ⭐ SECURITY: Cancel handler
            modal: {
                ondismiss: function() {
                    showToast('Payment cancelled. No charges were made.', 'warning');
                    
                    // ⭐ NEW: Cancel payment in backend
                    apiFetch('/api/cancel-payment', 'POST', {
                        order_id: orderData.order_id
                    });
                }
            }
        };
        
        const rzp = new Razorpay(options);
        rzp.open();
        
    } catch (error) {
        console.error('Payment Error:', error);
        showToast('Something went wrong. Please try again.', 'error');
    }
}

async function verifyPayment(response) {
    try {
        showToast('Verifying payment...', 'warning');
        
        const verifyData = await apiFetch('/api/verify-payment', 'POST', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature
        });
        
        if (verifyData.success) {
            showToast('🎉 Payment successful! Subscription activated.', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            showToast(verifyData.error || 'Payment verification failed. Please contact support.', 'error');
        }
    } catch (error) {
        console.error('Verification Error:', error);
        showToast('Verification failed. Please contact support.', 'error');
    }
}

// =====================================================================
// SUBSCRIPTION EXPIRY BANNER
// =====================================================================

async function checkSubscriptionStatus() {
    const token = getToken();
    if (!token) return;
    
    const data = await apiFetch('/api/subscription-status');
    if (data.error) {
        console.error('Subscription status error:', data.error);
        return;
    }
    
    const banner = document.getElementById('subscriptionBanner');
    const hasAccess = data.has_active_access;
    const isSubscribed = data.is_subscribed;
    const endDate = data.subscription_end_date;
    const daysLeft = data.days_remaining || 0;
    
    if (!banner) return;
    
    if (!hasAccess) {
        banner.style.display = 'block';
        banner.style.background = '#fee2e2';
        banner.style.borderColor = '#ef4444';
        banner.innerHTML = `
            <div class="banner-content">
                <span class="banner-icon">⛔</span>
                <span class="banner-text">
                    Your ${isSubscribed ? 'subscription' : 'trial'} expired on 
                    ${endDate ? new Date(endDate).toLocaleDateString() : 'recently'}. 
                    <strong>Renew now to make your public QR menu visible to customers again.</strong>
                </span>
                <button onclick="startPayment('3_months')" class="btn-primary banner-btn">
                    Renew Subscription
                </button>
            </div>
        `;
        disableDashboardActions();
    } else if (isSubscribed && daysLeft <= 7) {
        banner.style.display = 'block';
        banner.style.background = '#fef3c7';
        banner.style.borderColor = '#f59e0b';
        banner.innerHTML = `
            <div class="banner-content">
                <span class="banner-icon">⚠️</span>
                <span class="banner-text">
                    Your subscription ends in <strong>${daysLeft} days</strong>. 
                    Renew now to avoid interruption.
                </span>
                <button onclick="startPayment('3_months')" class="btn-primary banner-btn" style="background:#f59e0b;">
                    Renew Now
                </button>
            </div>
        `;
    } else {
        banner.style.display = 'none';
    }
}

function disableDashboardActions() {
    document.querySelectorAll('.btn-edit, .btn-delete, #generateQrBtn, .btn-submit').forEach(function(el) {
        el.disabled = true;
        el.style.opacity = '0.5';
        el.style.cursor = 'not-allowed';
    });
    document.querySelectorAll('form input, form select, form textarea').forEach(function(el) {
        el.disabled = true;
        el.style.opacity = '0.5';
    });
    document.querySelectorAll('.switch input').forEach(function(el) {
        el.disabled = true;
    });
}

// =====================================================================
// MOBILE MENU TOGGLE
// =====================================================================
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        const mobileToggle = document.getElementById('mobileMenuToggle');
        const navLinks = document.getElementById('navLinks');

        if (mobileToggle && navLinks) {
            mobileToggle.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                navLinks.classList.toggle('active');
                const icon = this.querySelector('i');
                if (navLinks.classList.contains('active')) {
                    icon.className = 'fas fa-times';
                } else {
                    icon.className = 'fas fa-bars';
                }
            });

            document.addEventListener('click', function(e) {
                if (navLinks.classList.contains('active') &&
                    !navLinks.contains(e.target) &&
                    !mobileToggle.contains(e.target)) {
                    navLinks.classList.remove('active');
                    const icon = mobileToggle.querySelector('i');
                    if (icon) icon.className = 'fas fa-bars';
                }
            });

            navLinks.querySelectorAll('a').forEach(function(link) {
                link.addEventListener('click', function() {
                    if (window.innerWidth <= 768) {
                        navLinks.classList.remove('active');
                        const icon = mobileToggle.querySelector('i');
                        if (icon) icon.className = 'fas fa-bars';
                    }
                });
            });
        }
    }, 100);
});

// =====================================================================
// TRIAL CHECK
// =====================================================================
let trialCheckInterval = null;
let alertShown6Days = false;
let alertShown3Days = false;

async function checkTrialStatus() {
    const token = getToken();
    if (!token) return;
    const data = await apiFetch('/api/trial-status');
    if (data.error) {
        console.error('Trial status error:', data.error);
        return;
    }
    
    const daysLeft = data.trial_days_left || 0;
    const isSubscribed = data.is_subscribed;
    const isTrialExpired = data.is_trial_expired;
    const hasActiveSubscription = data.has_active_subscription;
    
    const banner = document.getElementById('trialBanner');
    const daysElement = document.getElementById('trialDays');
    const progressBar = document.getElementById('trialProgressBar');
    const upgradeBtn = document.getElementById('upgradeBtn');
    
    if (!banner) return;
    
    if (hasActiveSubscription) {
        banner.style.display = 'block';
        banner.style.background = '#dbeafe';
        banner.style.borderColor = '#3b82f6';
        document.getElementById('trialStatusText').textContent = '✅ You are subscribed!';
        daysElement.textContent = '∞';
        document.getElementById('trialDaysLabel').textContent = '';
        progressBar.style.width = '100%';
        progressBar.style.background = '#3b82f6';
        upgradeBtn.style.display = 'none';
        return;
    }
    
    if (isTrialExpired || daysLeft <= 0) {
        banner.style.background = '#fee2e2';
        banner.style.borderColor = '#ef4444';
        document.getElementById('trialStatusText').textContent = '⛔ Your trial has expired!';
        daysElement.textContent = '0';
        document.getElementById('trialDaysLabel').textContent = 'days';
        progressBar.style.width = '0%';
        progressBar.style.background = '#ef4444';
        upgradeBtn.textContent = 'Subscribe Now';
        upgradeBtn.style.display = 'block';
        upgradeBtn.style.background = '#ef4444';
        upgradeBtn.onclick = function() { startPayment('3_months'); };
        showToast('⛔ Your trial has expired! Please subscribe to continue.', 'error');
        disableTrialFeatures();
        return;
    }
    
    // Active trial
    banner.style.display = 'block';
    document.getElementById('trialStatusText').textContent = 'Your free trial ends in:';
    daysElement.textContent = daysLeft;
    document.getElementById('trialDaysLabel').textContent = daysLeft === 1 ? 'day' : 'days';
    const progress = (daysLeft / 14) * 100;
    progressBar.style.width = progress + '%';
    progressBar.style.background = '#22c55e';
    
    if (daysLeft <= 6 && daysLeft > 3 && !alertShown6Days) {
        alertShown6Days = true;
        banner.style.background = '#fef3c7';
        banner.style.borderColor = '#f59e0b';
        progressBar.style.background = '#f59e0b';
        showToast('⚠️ Your free trial ends in ' + daysLeft + ' days! Upgrade now.', 'warning');
        upgradeBtn.style.display = 'block';
        upgradeBtn.textContent = 'Upgrade Now';
        upgradeBtn.style.background = '#f59e0b';
        upgradeBtn.onclick = function() { startPayment('3_months'); };
    } else if (daysLeft <= 3 && daysLeft > 0 && !alertShown3Days) {
        alertShown3Days = true;
        banner.style.background = '#fee2e2';
        banner.style.borderColor = '#ef4444';
        progressBar.style.background = '#ef4444';
        showToast('🚨 URGENT: Only ' + daysLeft + ' days left in your trial! Subscribe now.', 'error');
        upgradeBtn.style.display = 'block';
        upgradeBtn.textContent = 'Subscribe Now';
        upgradeBtn.style.background = '#ef4444';
        upgradeBtn.onclick = function() { startPayment('3_months'); };
    } else if (daysLeft <= 3 && daysLeft > 0) {
        banner.style.background = '#fee2e2';
        banner.style.borderColor = '#ef4444';
        progressBar.style.background = '#ef4444';
        upgradeBtn.style.display = 'block';
        upgradeBtn.textContent = 'Subscribe Now';
        upgradeBtn.style.background = '#ef4444';
        upgradeBtn.onclick = function() { startPayment('3_months'); };
    } else {
        banner.style.background = '#dbeafe';
        banner.style.borderColor = '#3b82f6';
        progressBar.style.background = '#22c55e';
        upgradeBtn.style.display = 'none';
    }
}

function disableTrialFeatures() {
    document.querySelectorAll('.btn-edit, .btn-delete, #generateQrBtn').forEach(function(el) {
        el.disabled = true;
        el.style.opacity = '0.5';
        el.style.cursor = 'not-allowed';
    });
    document.querySelectorAll('form input, form select, form textarea').forEach(function(el) {
        el.disabled = true;
        el.style.opacity = '0.5';
    });
    document.querySelectorAll('.switch input').forEach(function(el) {
        el.disabled = true;
    });
    var submitBtn = document.querySelector('form button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
        submitBtn.style.cursor = 'not-allowed';
    }
    showToast('⛔ Trial expired. Subscribe to continue using features.', 'error');
}

function upgradeNow() {
    const subSection = document.getElementById('subscriptionSection');
    if (subSection) {
        subSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        showToast('Please go to the subscription section to upgrade.', 'warning');
    }
}

// =====================================================================
// QR CODE FUNCTIONS
// =====================================================================

function printQR() {
    var qrImage = document.querySelector('#qrDisplay img');
    if (!qrImage) {
        showToast('Please generate QR first', 'error');
        return;
    }
    
    var win = window.open('', '_blank');
    win.document.write('<html><head><title>Print QR Code</title>');
    win.document.write('<style>');
    win.document.write('body{margin:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#fff;}');
    win.document.write('img{max-width:1000px;max-height:1000px;width:auto;height:auto;}');
    win.document.write('@media print{body{margin:0;} img{width:1000px;height:1000px;}}');
    win.document.write('</style>');
    win.document.write('</head><body>');
    win.document.write('<img src="' + qrImage.src + '" alt="QR Code">');
    win.document.write('</body></html>');
    win.document.close();
    win.focus();
    win.print();
}

// =====================================================================
// AUTH LOGIC
// =====================================================================
var authForm = document.getElementById('authForm');
if (authForm) {
    var isSignup = false;
    if (getToken()) {
        window.location.href = 'dashboard.html';
    }
    var toggleForm = document.getElementById('toggleForm');
    var toggleText = document.getElementById('toggleText');
    var formTitle = document.getElementById('formTitle');
    var signupFields = document.getElementById('signupFields');
    var submitBtn = authForm.querySelector('button[type="submit"]');
    var loadingOverlay = document.getElementById('loadingOverlay');
    var togglePassword = document.getElementById('togglePassword');
    var passwordInput = document.getElementById('password');
    if (togglePassword) {
        togglePassword.addEventListener('click', function() {
            var type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
        });
    }
    toggleForm.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        isSignup = !isSignup;
        if (isSignup) {
            signupFields.style.display = 'block';
            formTitle.textContent = 'Create New Account';
            submitBtn.textContent = 'Sign Up';
            toggleForm.textContent = 'Login here';
            toggleText.textContent = 'Already have an account?';
        } else {
            signupFields.style.display = 'none';
            formTitle.textContent = 'Welcome Back';
            submitBtn.textContent = 'Login';
            toggleForm.textContent = 'Sign up here';
            toggleText.textContent = "Don't have an account?";
        }
    });
    authForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        var email = document.getElementById('email').value;
        var password = document.getElementById('password').value;
        var errorDiv = document.getElementById('errorMsg');
        errorDiv.style.display = 'none';
        var payload = { email: email, password: password };
        var endpoint = '/api/login';
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
        var data = await apiFetch(endpoint, 'POST', payload);
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
// DASHBOARD LOGIC
// =====================================================================
var menuForm = document.getElementById('menuForm');
if (menuForm) {
    var currentRestaurant = null;
    var allItems = [];
    var isInitialized = false;
    var profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var payload = {
                restaurant_name: document.getElementById('settings_resto_name').value,
                upi_id: document.getElementById('settings_upi_id').value
            };
            var data = await apiFetch('/api/profile', 'PUT', payload);
            if (data.success) {
                showToast('Settings Saved!');
                document.getElementById('restoName').textContent = payload.restaurant_name;
            }
        });
    }

    async function initDashboard() {
        if (isInitialized) return;
        if (!getToken()) {
            window.location.href = 'auth.html';
            return;
        }
        try {
            var data = await apiFetch('/api/me', 'GET');
            if (data && data.id) {
                isInitialized = true;
                currentRestaurant = data;
                document.getElementById('restoName').textContent = data.restaurant_name;
                document.getElementById('viewMenuLink').href = 'menu.html?id=' + data.id;
                document.getElementById('settings_resto_name').value = data.restaurant_name || '';
                document.getElementById('settings_upi_id').value = data.upi_id || '';
                
                await checkSubscriptionStatus();
                await loadMenuItems();
                if (trialCheckInterval) clearInterval(trialCheckInterval);
                await checkTrialStatus();
                trialCheckInterval = setInterval(checkTrialStatus, 60000);
                
            } else if (data.error === 'Unauthorized') {
                localStorage.removeItem('scaneats_token');
                window.location.href = 'auth.html';
            } else {
                setTimeout(initDashboard, 3000);
            }
        } catch (error) {
            console.error('Dashboard init error:', error);
            setTimeout(initDashboard, 3000);
        }
    }

    document.getElementById('logoutBtn').addEventListener('click', function() {
        localStorage.removeItem('scaneats_token');
        if (trialCheckInterval) clearInterval(trialCheckInterval);
        window.location.href = 'auth.html';
    });

    async function loadMenuItems() {
        var list = document.getElementById('menuList');
        list.innerHTML = '<p class="loading-text">Loading items...</p>';
        if (!getToken()) {
            list.innerHTML = '<p class="loading-text" style="color:red;">Please login again</p>';
            window.location.href = 'auth.html';
            return;
        }
        var data = await apiFetch('/api/menu-items');
        if (data.error === 'ACCESS_DENIED' || data.error === '403') {
            list.innerHTML = '<p class="loading-text" style="color:red;">Subscription expired. Please renew to access your menu.</p>';
            return;
        }
        if (!data.error && Array.isArray(data)) {
            allItems = data;
            renderMenu();
        } else {
            list.innerHTML = '<p class="loading-text" style="color:red;">Failed to load items: ' + (data.error || 'Unknown error') + '</p>';
        }
    }

    function updateStats() {
        document.getElementById('totalItems').textContent = allItems.length;
        document.getElementById('vegItems').textContent = allItems.filter(function(i) { return i.is_veg; }).length;
        document.getElementById('nonVegItems').textContent = allItems.filter(function(i) { return !i.is_veg; }).length;
    }

    function renderMenu() {
        var list = document.getElementById('menuList');
        if (allItems.length === 0) {
            list.innerHTML = '<p class="loading-text">No items added yet.</p>';
            updateStats();
            return;
        }
        list.innerHTML = allItems.map(function(item) {
            return '<div class="menu-item-row" style="' + (!item.is_active ? 'opacity: 0.5;' : '') + '">' +
                '<div class="item-info">' +
                '<div class="item-name">' + item.name + ' ' + (item.is_veg ? '🟢' : '🔴') + '</div>' +
                '<div class="item-desc">' + (item.description || '') + '</div>' +
                '<div class="item-category">' + item.category + ' ' + (!item.is_active ? '(Inactive)' : '') + '</div>' +
                '</div>' +
                '<div class="item-price">₹' + item.price + '</div>' +
                '<div style="display:flex; align-items:center; gap:10px;">' +
                '<label class="switch">' +
                '<input type="checkbox" onchange="toggleActive(' + item.id + ')" ' + (item.is_active ? 'checked' : '') + '>' +
                '<span class="slider"></span>' +
                '</label>' +
                '<div class="item-actions">' +
                '<button class="btn-sm btn-edit" onclick="editItem(' + item.id + ')">Edit</button>' +
                '<button class="btn-sm btn-delete" onclick="deleteItem(' + item.id + ')">Del</button>' +
                '</div>' +
                '</div>' +
                '</div>';
        }).join('');
        updateStats();
    }

    window.toggleActive = async function(id) {
        if (!getToken()) {
            showToast('Please login again', 'error');
            window.location.href = 'auth.html';
            return;
        }
        var data = await apiFetch('/api/menu/toggle/' + id, 'PUT');
        if (data.error === 'ACCESS_DENIED' || data.error === '403') {
            showToast('Subscription expired. Please renew to continue.', 'error');
            return;
        }
        if (data.success) {
            showToast('Item status updated!');
            var item = allItems.find(function(i) { return i.id === id; });
            if (item) item.is_active = data.is_active;
            renderMenu();
        } else {
            showToast('Failed to update status', 'error');
        }
    };

    menuForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        if (!getToken()) {
            showToast('Please login again', 'error');
            window.location.href = 'auth.html';
            return;
        }
        var id = document.getElementById('itemId').value;
        var payload = {
            name: document.getElementById('name').value,
            description: document.getElementById('description').value,
            price: document.getElementById('price').value,
            category: document.getElementById('category').value,
            is_veg: document.getElementById('is_veg').value === 'true'
        };
        var method = id ? 'PUT' : 'POST';
        var endpoint = id ? '/api/menu-items/' + id : '/api/menu-items';
        var data = await apiFetch(endpoint, method, payload);
        if (data.error === 'ACCESS_DENIED' || data.error === '403') {
            showToast('Subscription expired. Please renew to continue.', 'error');
            return;
        }
        if (data.success) {
            showToast(id ? 'Item updated!' : 'Item added!');
            resetForm();
            await loadMenuItems();
        } else {
            showToast(data.error || 'Error saving item', 'error');
        }
    });

    window.editItem = function(id) {
        var item = allItems.find(function(i) { return i.id === id; });
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

    window.deleteItem = async function(id) {
        if (!confirm('Delete this item?')) return;
        if (!getToken()) {
            showToast('Please login again', 'error');
            window.location.href = 'auth.html';
            return;
        }
        var data = await apiFetch('/api/menu-items/' + id, 'DELETE');
        if (data.error === 'ACCESS_DENIED' || data.error === '403') {
            showToast('Subscription expired. Please renew to continue.', 'error');
            return;
        }
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

    document.getElementById('generateQrBtn').addEventListener('click', async function() {
        if (!getToken()) {
            showToast('Please login again', 'error');
            window.location.href = 'auth.html';
            return;
        }
        
        showToast('🔲 Generating high-resolution QR...', 'warning');
        
        var data = await apiFetch('/api/generate-qr', 'POST');
        if (data.error === 'ACCESS_DENIED' || data.error === '403') {
            showToast('Subscription expired. Please renew to continue.', 'error');
            return;
        }
        if (data.success) {
            document.getElementById('qrDisplay').innerHTML = 
                '<img src="' + data.qr_base64 + '" alt="QR Code" style="width:100%; height:100%; object-fit:contain;">';
            
            var link = document.getElementById('downloadQrLink');
            link.href = data.qr_base64;
            link.download = 'scaneats_menu_' + currentRestaurant.id + '.png';
            link.style.display = 'inline-block';
            
            document.getElementById('printQrBtn').style.display = 'inline-block';
            
            showToast('✅ High-res QR generated! (1000x1000px, 300 DPI)', 'success');
        } else {
            showToast(data.error || 'Failed to generate QR', 'error');
        }
    });

    if (!isInitialized) {
        initDashboard();
    }
}

// =====================================================================
// PUBLIC MENU LOGIC
// =====================================================================
var menuContent = document.getElementById('menuContent');
if (menuContent) {
    var params = new URLSearchParams(window.location.search);
    var restaurantId = params.get('id');
    var allMenuItems = [];
    var isVegOnly = false;
    var searchTerm = '';

    async function loadPublicMenu() {
        if (!restaurantId) {
            menuContent.innerHTML = '<h2>Invalid Menu Link</h2>';
            document.getElementById('loading').style.display = 'none';
            return;
        }
        
        try {
            var data = await apiFetch('/api/menu/' + restaurantId);
            
            if (data.error === 'SUBSCRIPTION_EXPIRED') {
                var menuControls = document.querySelector('.menu-controls');
                var menuHeader = document.querySelector('.menu-header');
                if (menuControls) menuControls.style.display = 'none';
                if (menuHeader) menuHeader.style.display = 'none';
                document.getElementById('loading').style.display = 'none';
                
                menuContent.innerHTML = `
                    <div class="subscription-expired-fallback">
                        <div class="fallback-icon">🔒</div>
                        <h2>Menu Currently Unavailable</h2>
                        <p>This restaurant's digital menu is currently inactive.</p>
                        <p class="fallback-subtext">Please request a physical menu from the restaurant staff.</p>
                    </div>
                `;
                return;
            }
            
            if (data.error) {
                menuContent.innerHTML = '<h2>' + (data.error || 'Menu not found') + '</h2>';
                document.getElementById('loading').style.display = 'none';
                return;
            }
            
            document.getElementById('restaurantName').textContent = data.restaurant_name;
            document.title = data.restaurant_name + ' - Menu';
            allMenuItems = data.items || [];
            
            var menuControls = document.querySelector('.menu-controls');
            if (menuControls) menuControls.style.display = 'flex';
            
            document.getElementById('searchInput').addEventListener('input', function(e) {
                searchTerm = e.target.value.toLowerCase();
                renderFilteredMenu();
            });
            document.getElementById('vegOnlyToggle').addEventListener('change', function(e) {
                isVegOnly = e.target.checked;
                renderFilteredMenu();
            });
            renderFilteredMenu();
            document.getElementById('loading').style.display = 'none';
            
        } catch (error) {
            console.error('Load menu error:', error);
            menuContent.innerHTML = '<h2>Something went wrong. Please try again.</h2>';
            document.getElementById('loading').style.display = 'none';
        }
    }

    function renderFilteredMenu() {
        if (allMenuItems.length === 0) {
            menuContent.innerHTML = '<p style="text-align:center; color:#64748b;">No menu items available.</p>';
            return;
        }
        var filteredItems = allMenuItems.filter(function(item) {
            var matchesSearch = item.name.toLowerCase().includes(searchTerm) ||
                (item.description && item.description.toLowerCase().includes(searchTerm));
            var matchesVeg = !isVegOnly || item.is_veg;
            return matchesSearch && matchesVeg;
        });
        if (filteredItems.length === 0) {
            menuContent.innerHTML = '<p style="text-align:center; color:#64748b; margin-top: 40px;">No items match your search.</p>';
            return;
        }
        var grouped = {};
        filteredItems.forEach(function(item) {
            if (!grouped[item.category]) grouped[item.category] = [];
            grouped[item.category].push(item);
        });
        menuContent.innerHTML = Object.entries(grouped).map(function(_ref) {
            var category = _ref[0];
            var items = _ref[1];
            return '<div class="menu-category">' +
                '<h2 class="category-title">' + category + '</h2>' +
                items.map(function(item) {
                    return '<div class="menu-item-card">' +
                        '<div style="display:flex; gap:10px;">' +
                        '<div class="veg-badge ' + (item.is_veg ? 'veg' : 'non-veg') + '"></div>' +
                        '<div>' +
                        '<div style="font-weight:600; font-size:16px;">' + item.name + '</div>' +
                        '<div style="font-size:13px; color:#64748b;">' + (item.description || '') + '</div>' +
                        '</div>' +
                        '</div>' +
                        '<div style="font-weight:700; color:#4f46e5;">₹' + item.price + '</div>' +
                        '</div>';
                }).join('') +
                '</div>';
        }).join('');
    }

    loadPublicMenu();
}

console.log('✅ ScanEats App loaded successfully!');
