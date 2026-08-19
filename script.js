// CONFIGURACIÓN OFICIAL DE DISCORD OAUTH2 (VERCEL PRODUCTION)
const CLIENT_ID = '1517661392369483907'; 
const REDIRECT_URI = 'https://voltaje-soterd.vercel.app/';

// CONFIGURACIÓN DE PAYPAL (CUENTA RECEPTORA DE PAGOS)
const PAYPAL_BUSINESS_EMAIL = 'morilloysaia6@gmail.com';
const PAYPAL_CURRENCY = 'USD';

// CREADORES AUTORIZADOS PARA EL PANEL ADMIN (BASE, NO EDITABLE DESDE LA APP)
const CREATORS = [
    "x_donald",
    "x_donald.",
    "jasdielduenodelamafiachina_97134",
    "starling102429",
    "yoaldo"
];

// Estado global de la aplicación
let currentUser = JSON.parse(localStorage.getItem('voltaje_current_user')) || null;
let cart = JSON.parse(localStorage.getItem('voltaje_cart')) || [];
let resources = JSON.parse(localStorage.getItem('voltaje_resources')) || [];

let userPurchases = JSON.parse(localStorage.getItem('voltaje_purchases')) || {};
let registeredUsers = JSON.parse(localStorage.getItem('voltaje_users')) || [];
// Administradores añadidos manualmente desde el Panel Creador (además de los CREATORS base)
let extraAdmins = JSON.parse(localStorage.getItem('voltaje_extra_admins')) || [];

// 1. INICIAR SESIÓN CON DISCORD
function loginWithDiscord() {
    const cleanClientId = CLIENT_ID.trim();
    const cleanRedirectUri = encodeURIComponent(REDIRECT_URI.trim());

    const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${cleanClientId}&redirect_uri=${cleanRedirectUri}&response_type=token&scope=identify`;

    window.location.href = discordAuthUrl;
}

// 2. LEER ACCESSTOKEN DE LA URL AL VOLVER DE DISCORD (Y RESTAURAR SESIÓN / PAGOS)
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
                handlePaypalReturn();
            }
        })
        .catch(err => console.error("Error al autenticar con Discord:", err));
        return;
    }

    // Si ya había una sesión guardada localmente (por ejemplo, al volver de PayPal), la restauramos
    if (currentUser) {
        restoreSession();
        handlePaypalReturn();
    }
});

// RESTAURAR UNA SESIÓN YA INICIADA (SIN VOLVER A PASAR POR DISCORD)
function restoreSession() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    updateProfileUI();

    if (currentUser.isCreator) {
        document.getElementById('admin-nav').classList.remove('hidden');
        renderAdminResources();
        renderAdminsList();
    }

    renderResources('all');
    renderUsers();
    renderOwnedProducts();
    renderRanking();
    updateCart();
}

// 3. CONFIGURAR LA SESIÓN Y ROLES
function setupUserSession(discordUser) {
    const defaultAvatar = discordUser.avatar 
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/0.png`;

    const cleanUsername = discordUser.username.trim().toLowerCase();
    const isCreator = CREATORS.includes(cleanUsername) || extraAdmins.includes(cleanUsername);

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
        isCreator: isCreator,
        cleanUsername: cleanUsername
    };

    localStorage.setItem('voltaje_current_user', JSON.stringify(currentUser));

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
        renderAdminResources();
        renderAdminsList();
    }

    renderResources('all');
    renderUsers();
    renderOwnedProducts();
    renderRanking();
    updateCart();
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
    localStorage.removeItem('voltaje_current_user');
    localStorage.removeItem('voltaje_cart');
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
            <img src="${res.image}" alt="${res.name}" onclick="openResourceModal(${res.id})">
            <div class="res-content">
                <h3 onclick="openResourceModal(${res.id})">${res.name}</h3>
                <p>${res.desc}</p>
                <button onclick="openResourceModal(${res.id})" class="btn-details"><i class="fa-solid fa-circle-info"></i> VER DETALLES COMPLETOS</button>
                <div class="res-price">$${res.price.toFixed(2)} USD</div>
                <button onclick="addToCart(${res.id})" class="btn-glow">AÑADIR AL CARRITO</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// MODAL DE DETALLES DE UN RECURSO (para descripciones largas)
function openResourceModal(id) {
    const res = resources.find(r => r.id === id);
    if (!res) return;

    document.getElementById('modal-res-image').src = res.image;
    document.getElementById('modal-res-image').alt = res.name;
    document.getElementById('modal-res-category').innerText = res.category.toUpperCase();
    document.getElementById('modal-res-name').innerText = res.name;
    document.getElementById('modal-res-desc').innerText = res.desc;
    document.getElementById('modal-res-price').innerText = `$${res.price.toFixed(2)} USD`;
    document.getElementById('modal-add-btn').setAttribute('onclick', `addToCart(${res.id})`);

    document.getElementById('resource-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeResourceModal() {
    document.getElementById('resource-modal').classList.add('hidden');
    document.body.style.overflow = '';
}

function filterResources(category, btn) {
    renderResources(category, btn);
}

// CARRITO DE COMPRAS Y PROCESO DE PAGO
function addToCart(id) {
    const item = resources.find(r => r.id === id);
    cart.push(item);
    localStorage.setItem('voltaje_cart', JSON.stringify(cart));
    updateCart();
    closeResourceModal();
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
    localStorage.setItem('voltaje_cart', JSON.stringify(cart));
    updateCart();
}

// PAGO CON PAYPAL: redirige a PayPal y solo desbloquea los recursos cuando el pago se confirma
function checkout() {
    if (cart.length === 0) return alert("Tu carrito está vacío.");
    if (!currentUser) return alert("Debes iniciar sesión con Discord.");

    // Guardamos el carrito por si el usuario vuelve desde PayPal tras el pago
    localStorage.setItem('voltaje_cart', JSON.stringify(cart));

    const itemIds = cart.map(item => item.id);
    const returnUrl = `${REDIRECT_URI}?voltaje_payment=success&items=${encodeURIComponent(JSON.stringify(itemIds))}`;
    const cancelUrl = `${REDIRECT_URI}?voltaje_payment=cancel`;

    const params = new URLSearchParams();
    params.set('cmd', '_cart');
    params.set('upload', '1');
    params.set('business', PAYPAL_BUSINESS_EMAIL);
    params.set('currency_code', PAYPAL_CURRENCY);
    params.set('return', returnUrl);
    params.set('cancel_return', cancelUrl);
    params.set('no_shipping', '1');

    cart.forEach((item, index) => {
        const n = index + 1;
        params.set(`item_name_${n}`, item.name);
        params.set(`item_number_${n}`, item.id);
        params.set(`amount_${n}`, item.price.toFixed(2));
        params.set(`quantity_${n}`, '1');
    });

    window.location.href = `https://www.paypal.com/cgi-bin/webscr?${params.toString()}`;
}

// PROCESA EL REGRESO DESDE PAYPAL Y DESBLOQUEA LOS ENLACES SOLO SI EL PAGO FUE EXITOSO
function handlePaypalReturn() {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('voltaje_payment');
    if (!paymentStatus) return;

    if (paymentStatus === 'success' && currentUser) {
        let itemIds = [];
        try { itemIds = JSON.parse(params.get('items') || '[]'); } catch (e) { itemIds = []; }

        const savedCart = JSON.parse(localStorage.getItem('voltaje_cart')) || [];

        if (!userPurchases[currentUser.id]) {
            userPurchases[currentUser.id] = [];
        }

        itemIds.forEach(id => {
            const item = resources.find(r => r.id === id) || savedCart.find(r => r.id === id);
            if (item && !userPurchases[currentUser.id].some(p => p.id === item.id)) {
                userPurchases[currentUser.id].push(item);
            }
        });

        localStorage.setItem('voltaje_purchases', JSON.stringify(userPurchases));

        cart = [];
        localStorage.removeItem('voltaje_cart');
        updateCart();
        renderOwnedProducts();
        renderRanking();

        alert("¡Pago recibido con éxito! Tus enlaces de descarga ya están desbloqueados en 'Mi Perfil'.");
        showSection('perfil');
        switchProfileTab('purchases');
    } else if (paymentStatus === 'cancel') {
        alert("El pago fue cancelado. Tu carrito sigue disponible para intentarlo de nuevo.");
    }

    window.history.replaceState({}, document.title, window.location.pathname);
}

// RANKING DE TOP COMPRADORES (SECCIÓN INICIO)
function renderRanking() {
    const container = document.getElementById('ranking-list');
    if (!container) return;

    const ranked = registeredUsers
        .map(u => ({
            ...u,
            count: (userPurchases[u.id] || []).length
        }))
        .filter(u => u.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    container.innerHTML = '';

    if (ranked.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); padding:10px 5px;">Aún no hay compras registradas. ¡Sé el primero en aparecer en el ranking!</p>';
        return;
    }

    ranked.forEach((u, index) => {
        const item = document.createElement('div');
        item.className = 'ranking-item glass';
        item.innerHTML = `
            <div class="rank-position">#${index + 1}</div>
            <img src="${u.avatar}" alt="${u.username}">
            <div class="ranking-user">
                <strong>${u.username}</strong>
                <small>Miembro desde ${u.date}</small>
            </div>
            <div class="ranking-count">${u.count} compra${u.count !== 1 ? 's' : ''}</div>
        `;
        container.appendChild(item);
    });
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
        renderAdminResources();
    };

    reader.readAsDataURL(imageFile);
});

// PANEL ADMIN: ELIMINAR UN RECURSO DE LA TIENDA
function deleteResource(id) {
    const item = resources.find(r => r.id === id);
    if (!item) return;
    if (!confirm(`¿Seguro que quieres eliminar "${item.name}" de la tienda? Esta acción no se puede deshacer.`)) return;

    resources = resources.filter(r => r.id !== id);
    localStorage.setItem('voltaje_resources', JSON.stringify(resources));

    renderResources('all');
    renderAdminResources();
}

// PANEL ADMIN: LISTA DE RECURSOS CON OPCIÓN DE ELIMINAR
function renderAdminResources() {
    const list = document.getElementById('admin-resource-list');
    if (!list) return;
    list.innerHTML = '';

    if (resources.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted); padding:8px 0;">No hay recursos publicados todavía.</p>';
        return;
    }

    resources.forEach(res => {
        const li = document.createElement('li');
        li.innerHTML = `
            <img src="${res.image}" alt="${res.name}" style="width:34px; height:34px; border-radius:8px; object-fit:cover;">
            <div style="flex-grow:1;">
                <strong>${res.name}</strong>
                <br><small style="color:var(--text-muted)">${res.category.toUpperCase()} · $${res.price.toFixed(2)} USD</small>
            </div>
            <button onclick="deleteResource(${res.id})" class="btn-icon-danger" title="Eliminar recurso"><i class="fa-solid fa-trash"></i></button>
        `;
        list.appendChild(li);
    });
}

// PANEL ADMIN: AÑADIR OTRO ADMINISTRADOR POR SU USUARIO DE DISCORD
document.getElementById('add-admin-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('admin-username-input');
    const newAdmin = input.value.trim().toLowerCase();

    if (!newAdmin) return;
    if (CREATORS.includes(newAdmin) || extraAdmins.includes(newAdmin)) {
        alert("Ese usuario ya tiene permisos de administrador.");
        return;
    }

    extraAdmins.push(newAdmin);
    localStorage.setItem('voltaje_extra_admins', JSON.stringify(extraAdmins));

    input.value = '';
    renderAdminsList();
    alert(`"${newAdmin}" ahora es administrador. Tendrá acceso al Panel Creador la próxima vez que inicie sesión.`);
});

// PANEL ADMIN: QUITAR UN ADMINISTRADOR AÑADIDO MANUALMENTE
function removeAdmin(username) {
    if (!confirm(`¿Quitar permisos de administrador a "${username}"?`)) return;
    extraAdmins = extraAdmins.filter(u => u !== username);
    localStorage.setItem('voltaje_extra_admins', JSON.stringify(extraAdmins));
    renderAdminsList();
}

// PANEL ADMIN: LISTA DE ADMINISTRADORES (BASE + AÑADIDOS)
function renderAdminsList() {
    const list = document.getElementById('admin-manage-list');
    if (!list) return;
    list.innerHTML = '';

    CREATORS.forEach(username => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div style="flex-grow:1;">
                <strong>${username}</strong>
                <br><small style="color:var(--text-muted)">Administrador base</small>
            </div>
        `;
        list.appendChild(li);
    });

    extraAdmins.forEach(username => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div style="flex-grow:1;">
                <strong>${username}</strong>
                <br><small style="color:var(--text-muted)">Añadido manualmente</small>
            </div>
            <button onclick="removeAdmin('${username}')" class="btn-icon-danger" title="Quitar administrador"><i class="fa-solid fa-user-minus"></i></button>
        `;
        list.appendChild(li);
    });
}

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