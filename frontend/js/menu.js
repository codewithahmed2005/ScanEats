const API_URL = 'http://127.0.0.1:5000';
const urlParams = new URLSearchParams(window.location.search);
const RESTAURANT_ID = urlParams.get('id');

document.addEventListener('DOMContentLoaded', () => {
    if (!RESTAURANT_ID) {
        document.body.innerHTML = '<h1 style="text-align:center; margin-top:50px; color:red;">Invalid Menu Link</h1>';
        return;
    }
    fetchMenu();
});

async function fetchMenu() {
    try {
        const response = await fetch(`${API_URL}/api/menu/${RESTAURANT_ID}`, { credentials: 'include' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();

        document.title = `${data.restaurant_name} — Menu`;
        document.getElementById('restaurantName').textContent = data.restaurant_name;
        document.getElementById('footerText').textContent = `© 2025 ${data.restaurant_name}. All rights reserved.`;

        if (data.is_owner) {
            const backBtn = document.createElement('a');
            backBtn.href = './dashboard.html';
            backBtn.className = 'back-to-dashboard';
            backBtn.innerText = '← Back to Dashboard';
            document.body.prepend(backBtn);
        }

        if (data.items.length === 0) {
            document.getElementById('loadingState').style.display = 'none';
            document.getElementById('emptyState').style.display = 'block';
            return;
        }

        renderMenu(data.items);
        renderCategoryNav(data.items);

        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('menuContent').style.display = 'block';
        
    } catch (err) {
        console.error('Error fetching menu:', err);
        document.getElementById('loadingState').innerHTML = `<p style="color: #e74c3c;">⚠️ Failed to load menu.</p>`;
    }
}

function groupByCategory(items) {
    const grouped = {};
    items.forEach(item => {
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push(item);
    });
    return grouped;
}

function renderCategoryNav(items) {
    const grouped = groupByCategory(items);
    const categories = Object.keys(grouped);
    const nav = document.getElementById('categoryNav');

    nav.innerHTML = categories.map((cat, index) => {
        const slug = cat.toLowerCase().replace(/[^a-z0-9]/g, '-');
        return `<a href="#cat-${slug}" class="${index === 0 ? 'active' : ''}">${cat}</a>`;
    }).join('');

    nav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const target = document.getElementById(targetId);
            if (target) {
                const offset = 60;
                window.scrollTo({ top: target.offsetTop - offset, behavior: 'smooth' });
            }
            nav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
            link.classList.add('active');
        });
    });
}

function renderMenu(items) {
    const grouped = groupByCategory(items);
    const content = document.getElementById('menuContent');

    content.innerHTML = Object.entries(grouped).map(([category, categoryItems]) => {
        const slug = category.toLowerCase().replace(/[^a-z0-9]/g, '-');
        return `
            <section class="menu-category" id="cat-${slug}">
                <h2 class="category-title">${category} <span class="category-count">(${categoryItems.length} items)</span></h2>
                ${categoryItems.map(item => `
                    <div class="menu-item">
                        <div class="veg-badge ${item.is_veg ? 'veg' : 'non-veg'}"></div>
                        <div class="item-details">
                            <div class="item-name">${escapeHtml(item.name)}</div>
                            ${item.description ? `<div class="item-desc">${escapeHtml(item.description)}</div>` : ''}
                            <div class="item-price">${item.price.toFixed(2)}</div>
                        </div>
                    </div>
                `).join('')}
            </section>
        `;
    }).join('');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('.menu-category');
    const navLinks = document.querySelectorAll('.category-nav a');
    let current = '';
    sections.forEach(section => {
        if (window.scrollY >= section.offsetTop - 80) current = section.id;
    });
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) link.classList.add('active');
    });
});