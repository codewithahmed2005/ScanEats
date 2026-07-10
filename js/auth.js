const API_URL = 'https://codewithahmed-scaneats-backend.hf.space';

document.addEventListener('DOMContentLoaded', async () => {
    // Agar user already login hai toh dashboard par bhej do
    try {
        const res = await fetch(`${API_URL}/api/me`, { credentials: 'include' });
        if (res.ok) {
            window.location.href = './dashboard.html';
        }
    } catch (err) {
        console.error("Not logged in yet");
    }

    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const res = await fetch(`${API_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                
                if (data.success) {
                    window.location.href = './dashboard.html';
                } else {
                    const errDiv = document.getElementById('errorMsg');
                    errDiv.textContent = data.error;
                    errDiv.style.display = 'block';
                }
            } catch (err) {
                alert("Cannot connect to server. Make sure backend is running.");
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const restaurant_name = document.getElementById('restaurant_name').value;
            const owner_name = document.getElementById('owner_name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const res = await fetch(`${API_URL}/api/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ restaurant_name, owner_name, email, password })
                });
                const data = await res.json();
                
                if (data.success) {
                    window.location.href = './dashboard.html';
                } else {
                    const errDiv = document.getElementById('errorMsg');
                    errDiv.textContent = data.error;
                    errDiv.style.display = 'block';
                }
            } catch (err) {
                alert("Cannot connect to server. Make sure backend is running.");
            }
        });
    }
});
