// CONFIGURACIÓN OFICIAL DE DISCORD OAUTH2 (VERCEL PRODUCTION)
const CLIENT_ID = '1517661392369483907'; 
const REDIRECT_URI = 'https://voltaje-soterd.vercel.app/';

// CREADORES AUTORIZADOS PARA EL PANEL ADMIN
const CREATORS = [
    "x_donald",
    "jasdielduenodelamafiachina_97134",
    "starling102429",
    "yoaldo"
];

// Estado global de la aplicación
let currentUser = null;
let cart = [];
let resources = JSON.parse(localStorage.getItem('voltaje_resources')) || [
    {
        id: 1,
        name: "Sistema de Garaje CEF",
        category: "script",
        price: 15.00,
        image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500",
        link: "https://mega.nz/file/ejemplo1",
        desc: "Panel CEF totalmente responsivo con vista 3D de vehículos y guardado MySQL."
    },
    {
        id: 2,
        name: "Mapeo Base VIP Pershing",
        category: "mapeo",
        price: 10.00,
        image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=500",
        link: "https://mega.nz/file/ejemplo2",
        desc: "Mapeo exterior e interior de alta definición optimizado para 0 caídas de FPS."
    }
];
let registeredUsers = JSON.parse(localStorage.getItem('voltaje_users')) || [];

// 1. INICIAR SESIÓN CON DISCORD
function loginWithDiscord() {
    const cleanClientId = CLIENT_ID.trim();
    const cleanRedirectUri = encodeURIComponent(REDIRECT_URI.trim());

    // Construcción exacta del enlace OAuth2
    const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${cleanClientId}&redirect_uri=${cleanRedirectUri}&response_type=token&scope=identify`;

    window.location.href = discordAuthUrl;
}

// 2. LEER ACCESSTOKEN DE LA URL AL VOLVER DE DISCORD
window.addEventListener('DOMContentLoaded', () => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = fragment.get('access_token');

    if (accessToken) {
        // Limpiar fragmento token de la URL por privacidad
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Petición a la API de Discord para traer datos reales del usuario
        fetch('https://discord.com/api/users/@me', {
            headers: { authorization: `Bearer ${accessToken}` }
        })
        .then(res => res.json())
        .then(userData => {
            if (userData.username) {
                setupUserSession(userData);
            }
        })
        .catch(err => console.error("Error al autenticar con Discord:", err));
    }
});

// 3. CONFIGURAR LA SESIÓN Y ROLES
function setupUserSession(discordUser) {
    const avatarUrl = discordUser.avatar 
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/0.png`;

    const isCreator = CREATORS.includes(discordUser.username.toLowerCase());

    currentUser = {
        id: discordUser.id,
        username: discordUser.username,
        avatar: avatarUrl,
        isCreator: isCreator
    };

    // Guardar registro
    if (!registeredUsers.some(u => u.id === currentUser.id)) {
        registeredUsers.push({
            id: currentUser.id,
            username: currentUser.username,
            avatar: currentUser.avatar,
            date: new Date().toLocaleDateString()
        });
        localStorage.setItem('voltaje_users', JSON.stringify(registeredUsers));
    }

    // Actualizar interfaz
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    document.getElementById('user-name').innerText = currentUser.username;
    document.getElementById('user-avatar').src = currentUser.avatar;
    document.getElementById('user-role').innerText = isCreator ? "Creador / Admin" : "Cliente VIP";

    if (isCreator) {
        document.getElementById('admin-nav').classList.remove('hidden');
    }

    renderResources('all');
    renderUsers();
}

function logout() {
    window.location.href = REDIRECT_URI;
}

// NAVEGACIÓN ENTRE SECCIONES
function showSection(sectionId, btn) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(sectionId).classList.add('active');
    if(btn) btn.classList.add('active');
}

// RENDER DE PRODUCTOS
function renderResources(filter, btn) {
    if(btn) {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    const grid = document.getElementById('resources-grid');
    grid.innerHTML = '';

    const list = filter === 'all' ? resources : resources.filter(r => r.category === filter);

    list.forEach(res => {
        const card = document.createElement('div');
        card.className = 'res-card glass';
        card.innerHTML = `
            <img src="${res.image}" alt="${res.name}">
            <div class="res-content">
                <h3>${res.name}</h3>
                <p>${res.desc}</p>
                <div class="res-price">$${res.price.toFixed(2)} USD</div>
                <button onclick="addToCart(${res.id})" class="btn-glow">AÑADIR AL CARRITO</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function filterResources(category, btn) {
    renderResources(category, btn);
}

// CARRITO DE COMPRAS
function addToCart(id) {
    const item = resources.find(r => r.id === id);
    cart.push(item);
    updateCart();
    alert(`"${item.name}" fue agregado al carrito.`);
}

function updateCart() {
    document.getElementById('cart-count').innerText = cart.length;
    const container = document.getElementById('cart-items');
    container.innerHTML = '';
    let total = 0;

    if(cart.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted)">El carrito está totalmente vacío.</p>';
    }

    cart.forEach((item, index) => {
        total += item.price;
        const row = document.createElement('div');
        row.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; background:rgba(0,0,0,0.3); padding:10px 15px; border-radius:8px;";
        row.innerHTML = `
            <div>
                <strong>${item.name}</strong>
                <div style="color:#10b981; font-size:0.9rem;">$${item.price.toFixed(2)} USD</div>
            </div>
            <button onclick="removeFromCart(${index})" style="background:var(--neon-secondary); color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
        `;
        container.appendChild(row);
    });

    document.getElementById('cart-total').innerText = `$${total.toFixed(2)} USD`;
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCart();
}

function checkout() {
    if (cart.length === 0) return alert("Tu carrito está vacío.");
    let links = cart.map(i => `• ${i.name}: ${i.link}`).join('\n');
    alert(`¡Gracias por comprar en Voltaje Stores!\n\nAquí están tus enlaces de descarga directa:\n\n${links}`);
    cart = [];
    updateCart();
}

// PANEL DE CREADORES (PUBLICAR RECURSOS)
document.getElementById('add-resource-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const newRes = {
        id: Date.now(),
        name: document.getElementById('res-name').value,
        category: document.getElementById('res-category').value,
        price: parseFloat(document.getElementById('res-price').value),
        image: document.getElementById('res-image').value,
        link: document.getElementById('res-link').value,
        desc: document.getElementById('res-desc').value
    };

    resources.push(newRes);
    localStorage.setItem('voltaje_resources', JSON.stringify(resources));
    alert("¡Recurso publicado exitosamente en la tienda!");
    
    document.getElementById('add-resource-form').reset();
    renderResources('all');
});

function renderUsers() {
    const list = document.getElementById('user-list');
    list.innerHTML = '';
    registeredUsers.forEach(u => {
        const li = document.createElement('li');
        li.innerHTML = `
            <img src="${u.avatar}" alt="Avatar">
            <div>
                <strong>${u.username}</strong>
                <br><small style="color:var(--text-muted)">Registrado: ${u.date}</small>
            </div>
        `;
        list.appendChild(li);
    });
}