// CONFIGURACIÓN OFICIAL DE DISCORD OAUTH2 (VERCEL PRODUCTION)
const CLIENT_ID = '1517661392369483907'; 
const REDIRECT_URI = 'https://voltaje-soterd.vercel.app/';

// CREADORES AUTORIZADOS PARA EL PANEL ADMIN
const CREATORS = [
    "x_donald",
    "x_donald.",
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

let userPurchases = JSON.parse(localStorage.getItem('voltaje_purchases')) || {};
let registeredUsers = JSON.parse(localStorage.getItem('voltaje_users')) || [];

// 1. INICIAR SESIÓN CON DISCORD
function loginWithDiscord() {
    const cleanClientId = CLIENT_ID.trim();
    const cleanRedirectUri = encodeURIComponent(REDIRECT_URI.trim());

    const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${cleanClientId}&redirect_uri=${cleanRedirectUri}&response_type=token&scope=identify`;

    window.location.href = discordAuthUrl;
}

// 2. LEER ACCESSTOKEN DE LA URL AL VOLVER DE DISCORD
window.addEventListener('DOMContentLoaded', () => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = fragment.get('access_token');

    if (accessToken) {
        window.history.replaceState({}, document.title, window.location.pathname);
        
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
    const defaultAvatar = discordUser.avatar 
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/0.png`;

    const cleanUsername = discordUser.username.trim().toLowerCase();
    const isCreator = CREATORS.includes(cleanUsername);

    // Si es un creador, guardamos su avatar oficial para la sección de creadores
    if(cleanUsername.includes("x_donald")) setCreatorAvatar("creator-avatar-x_donald", defaultAvatar);
    if(cleanUsername.includes("jasdiel")) setCreatorAvatar("creator-avatar-jasdiel", defaultAvatar);
    if(cleanUsername.includes("starling")) setCreatorAvatar("creator-avatar-starling", defaultAvatar);
    if(cleanUsername.includes("yoaldo")) setCreatorAvatar("creator-avatar-yoaldo", defaultAvatar);

    // Cargar perfil guardado localmente si existe edición previa
    const savedCustomProfile = JSON.parse(localStorage.getItem(`voltaje_profile_${discordUser.id}`));

    currentUser = {
        id: discordUser.id,
        username: savedCustomProfile ? savedCustomProfile.username : discordUser.username,
        avatar: savedCustomProfile ? savedCustomProfile.avatar : defaultAvatar,
        isCreator: isCreator
    };

    if (!registeredUsers.some(u => u.id === currentUser.id)) {
        registeredUsers.push({
            id: currentUser.id,
            username: currentUser.username,
            avatar: currentUser.avatar,
            date: new Date().toLocaleDateString()
        });
        localStorage.setItem('voltaje_users', JSON.stringify(registeredUsers));
    }

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    updateProfileUI();

    if (isCreator) {
        document.getElementById('admin-nav').classList.remove('hidden');
    }

    renderResources('all');
    renderUsers();
    renderOwnedProducts();
}

function setCreatorAvatar(elementId, avatarUrl) {
    const el = document.getElementById(elementId);
    if(el) el.src = avatarUrl;
}

function updateProfileUI() {
    document.getElementById('user-name').innerText = currentUser.username;
    document.getElementById('user-avatar').src = currentUser.avatar;
    document.getElementById('user-role').innerText = currentUser.isCreator ? "Creador / Admin" : "Cliente VIP";
    document.getElementById('profile-input-username').value = currentUser.username;
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

// PESTAÑAS DENTRO DEL PERFIL
function switchProfileTab(tabName, btn) {
    document.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.remove('active'));

    document.getElementById(`tab-${tabName}`).classList.add('active');
    if(btn) btn.classList.add('active');
}

// EDITAR PERFIL (NOMBRE Y FOTO DESDE EL DISPOSITIVO)
document.getElementById('edit-profile-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const newUsername = document.getElementById('profile-input-username').value;
    const fileInput = document.getElementById('profile-input-avatar');

    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            saveProfileChanges(newUsername, e.target.result);
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        saveProfileChanges(newUsername, currentUser.avatar);
    }
});

function saveProfileChanges(username, avatar) {
    currentUser.username = username;
    currentUser.avatar = avatar;

    localStorage.setItem(`voltaje_profile_${currentUser.id}`, JSON.stringify({
        username: username,
        avatar: avatar
    }));

    updateProfileUI();
    alert("¡Perfil actualizado con éxito!");
}

// RENDER DE PRODUCTOS EN LA TIENDA
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

// CARRITO DE COMPRAS Y PROCESO DE PAGO
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
    if (!currentUser) return alert("Debes iniciar sesión con Discord.");

    if (!userPurchases[currentUser.id]) {
        userPurchases[currentUser.id] = [];
    }

    cart.forEach(item => {
        if(!userPurchases[currentUser.id].some(p => p.id === item.id)) {
            userPurchases[currentUser.id].push(item);
        }
    });

    localStorage.setItem('voltaje_purchases', JSON.stringify(userPurchases));

    alert("¡Compra procesada con éxito! Tus productos ya están disponibles en 'Mi Perfil'.");
    cart = [];
    updateCart();
    renderOwnedProducts();
    showSection('perfil');
    switchProfileTab('purchases');
}

// RENDER DE PRODUCTOS OBTENIDOS Y ENLACES
function renderOwnedProducts() {
    if (!currentUser) return;
    const purchases = userPurchases[currentUser.id] || [];

    const grid = document.getElementById('owned-products-grid');
    const downloadsList = document.getElementById('downloads-list');

    grid.innerHTML = '';
    downloadsList.innerHTML = '';

    if (purchases.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted)">Aún no has comprado ningún recurso.</p>';
        downloadsList.innerHTML = '<p style="color:var(--text-muted)">Aún no tienes enlaces de descarga.</p>';
        return;
    }

    purchases.forEach(res => {
        // Render tarjeta
        const card = document.createElement('div');
        card.className = 'res-card glass';
        card.innerHTML = `
            <img src="${res.image}" alt="${res.name}">
            <div class="res-content">
                <h3>${res.name}</h3>
                <p>${res.desc}</p>
                <a href="${res.link}" target="_blank" class="btn-glow" style="text-align:center; text-decoration:none; display:block;">DESCARGAR AHORA</a>
            </div>
        `;
        grid.appendChild(card);

        // Render lista de descargas
        const li = document.createElement('li');
        li.className = 'download-item glass';
        li.innerHTML = `
            <div>
                <strong>${res.name}</strong>
                <div style="color:var(--text-muted); font-size:0.85rem;">Categoría: ${res.category.toUpperCase()}</div>
            </div>
            <a href="${res.link}" target="_blank" class="btn-download-direct"><i class="fa-solid fa-cloud-arrow-down"></i> Descargar</a>
        `;
        downloadsList.appendChild(li);
    });
}

// PANEL ADMIN: PUBLICAR RECURSO SUBIENDO IMAGEN DEL DISPOSITIVO
document.getElementById('add-resource-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('res-name').value;
    const category = document.getElementById('res-category').value;
    const price = parseFloat(document.getElementById('res-price').value);
    const link = document.getElementById('res-link').value;
    const desc = document.getElementById('res-desc').value;
    const imageFile = document.getElementById('res-image-file').files[0];

    if (!imageFile) return alert("Por favor selecciona una imagen desde tu dispositivo.");

    const reader = new FileReader();
    reader.onload = function(event) {
        const newRes = {
            id: Date.now(),
            name: name,
            category: category,
            price: price,
            image: event.target.result, // Se convierte en base64 para guardarse y mostrarse
            link: link,
            desc: desc
        };

        resources.push(newRes);
        localStorage.setItem('voltaje_resources', JSON.stringify(resources));
        alert("¡Recurso publicado exitosamente en la tienda!");

        document.getElementById('add-resource-form').reset();
        renderResources('all');
    };

    reader.readAsDataURL(imageFile);
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