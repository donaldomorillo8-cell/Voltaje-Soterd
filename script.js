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
let extraAdmins = JSON.parse(localStorage.getItem('voltaje_extra_admins')) || [];
let reviews = JSON.parse(localStorage.getItem('voltaje_reviews')) || [];

// MIGRACIÓN: si el carrito o las compras quedaron guardados con objetos completos
// (versión vieja, que llenaba la cuota de localStorage por guardar la imagen en base64
// una y otra vez), los reducimos a solo IDs para liberar espacio.
(function migrarAlmacenamientoLiviano() {
    try {
        let cambiado = false;

        if (cart.some(entry => entry && typeof entry === 'object')) {
            cart = cart.map(entry => (entry && typeof entry === 'object') ? entry.id : entry);
            cambiado = true;
        }

        Object.keys(userPurchases).forEach(uid => {
            const list = userPurchases[uid] || [];
            if (list.some(entry => entry && typeof entry === 'object')) {
                userPurchases[uid] = list.map(entry => (entry && typeof entry === 'object') ? entry.id : entry);
                cambiado = true;
            }
        });

        if (cambiado) {
            localStorage.setItem('voltaje_cart', JSON.stringify(cart));
            localStorage.setItem('voltaje_purchases', JSON.stringify(userPurchases));
        }
    } catch (err) {
        // Si el propio localStorage está lleno, lo vaciamos para que el sitio vuelva a funcionar.
        console.error("No se pudo migrar el almacenamiento, limpiando carrito/compras corruptas:", err);
        cart = [];
        localStorage.removeItem('voltaje_cart');
    }
})();

// 1. INICIAR SESIÓN CON DISCORD
function loginWithDiscord() {
    const cleanClientId = CLIENT_ID.trim();
    const cleanRedirectUri = encodeURIComponent(REDIRECT_URI.trim());
    const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${cleanClientId}&redirect_uri=${cleanRedirectUri}&response_type=token&scope=identify`;
    window.location.href = discordAuthUrl;
}

// 2. LEER ACCESSTOKEN DE LA URL AL VOLVER DE DISCORD
window.addEventListener('DOMContentLoaded', () => {
    // Inicializar listeners del formulario de edición de perfil y delegaciones
    initProfileEvents();
    initCartEvents();

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

    if (currentUser) {
        restoreSession();
        handlePaypalReturn();
    }
});

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
    renderReviews();
    renderMyReviews();
    updateCart();
}

function setupUserSession(discordUser) {
    const defaultAvatar = discordUser.avatar 
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/0.png`;

    const cleanUsername = discordUser.username.trim().toLowerCase();
    const isCreator = CREATORS.includes(cleanUsername) || extraAdmins.includes(cleanUsername);

    if(cleanUsername.includes("x_donald")) setCreatorAvatar("creator-avatar-x_donald", defaultAvatar);
    if(cleanUsername.includes("jasdiel")) setCreatorAvatar("creator-avatar-jasdiel", defaultAvatar);
    if(cleanUsername.includes("starling")) setCreatorAvatar("creator-avatar-starling", defaultAvatar);
    if(cleanUsername.includes("yoaldo")) setCreatorAvatar("creator-avatar-yoaldo", defaultAvatar);

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
    renderReviews();
    renderMyReviews();
    updateCart();
}

function setCreatorAvatar(elementId, avatarUrl) {
    const el = document.getElementById(elementId);
    if(el) el.src = avatarUrl;
}

function updateProfileUI() {
    if (!currentUser) return;
    document.getElementById('user-name').innerText = currentUser.username;
    document.getElementById('user-avatar').src = currentUser.avatar;
    document.getElementById('user-role').innerText = currentUser.isCreator ? "Creador / Admin" : "Cliente VIP";
    const usernameInput = document.getElementById('profile-input-username');
    if (usernameInput) usernameInput.value = currentUser.username;
}

function logout() {
    localStorage.removeItem('voltaje_current_user');
    localStorage.removeItem('voltaje_cart');
    window.location.href = REDIRECT_URI;
}

function showSection(sectionId, btn) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(sectionId).classList.add('active');
    if(btn) btn.classList.add('active');
}

function switchProfileTab(tabName, btn) {
    document.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.remove('active'));

    document.getElementById(`tab-${tabName}`).classList.add('active');
    if(btn) btn.classList.add('active');
}

// CORRECCIÓN: EVENTO EDITAR PERFIL
function initProfileEvents() {
    const editForm = document.getElementById('edit-profile-form');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return alert("Debes iniciar sesión.");

            const newUsername = document.getElementById('profile-input-username').value.trim();
            const fileInput = document.getElementById('profile-input-avatar');

            if (fileInput.files && fileInput.files[0]) {
                try {
                    const avatarComprimido = await comprimirImagen(fileInput.files[0], 300, 0.75);
                    saveProfileChanges(newUsername, avatarComprimido);
                } catch (err) {
                    console.error("Error al procesar la foto de perfil:", err);
                    alert("No se pudo procesar la imagen seleccionada. Intenta con otra foto.");
                }
            } else {
                saveProfileChanges(newUsername, currentUser.avatar);
            }
        });
    }
}

function saveProfileChanges(username, avatar) {
    currentUser.username = username;
    currentUser.avatar = avatar;

    try {
        localStorage.setItem(`voltaje_profile_${currentUser.id}`, JSON.stringify({
            username: username,
            avatar: avatar
        }));
    } catch (err) {
        console.error("No se pudo guardar el perfil:", err);
        alert("No se pudo guardar la foto de perfil: el almacenamiento del navegador está lleno.");
        return;
    }

    // Actualizar usuario en lista global
    const idx = registeredUsers.findIndex(u => u.id === currentUser.id);
    if (idx !== -1) {
        registeredUsers[idx].username = username;
        registeredUsers[idx].avatar = avatar;
        localStorage.setItem('voltaje_users', JSON.stringify(registeredUsers));
    }

    localStorage.setItem('voltaje_current_user', JSON.stringify(currentUser));
    updateProfileUI();
    renderRanking();
    alert("¡Perfil actualizado con éxito!");
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// CORRECCIÓN: RENDERIZADO Y DELEGACIÓN DE EVENTOS EN TIENDA
function renderResources(filter, btn) {
    if(btn) {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    const grid = document.getElementById('resources-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const list = filter === 'all' ? resources : resources.filter(r => r.category === filter);

    list.forEach(res => {
        const card = document.createElement('div');
        card.className = 'res-card glass';
        card.innerHTML = `
            <img src="${res.image}" alt="${escapeHtml(res.name)}" data-action="open" data-id="${res.id}">
            <div class="res-content">
                <h3 data-action="open" data-id="${res.id}">${escapeHtml(res.name)}</h3>
                <p>${escapeHtml(res.desc)}</p>
                <button data-action="open" data-id="${res.id}" class="btn-details"><i class="fa-solid fa-circle-info"></i> VER DETALLES COMPLETOS</button>
                <div class="res-price">$${res.price.toFixed(2)} USD</div>
                <button data-action="add" data-id="${res.id}" class="btn-glow">AÑADIR AL CARRITO</button>
            </div>
        `;
        grid.appendChild(card);
    });

    populateReviewProductSelect();
}

function initCartEvents() {
    document.body.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const id = target.dataset.id;
        if (target.dataset.action === 'open') {
            openResourceModal(id);
        } else if (target.dataset.action === 'add') {
            addToCart(id);
        }
    });

    const modalAddBtn = document.getElementById('modal-add-btn');
    if (modalAddBtn) {
        modalAddBtn.addEventListener('click', () => {
            const id = modalAddBtn.dataset.id;
            if (id) addToCart(id);
        });
    }
}

function openResourceModal(id) {
    const res = resources.find(r => String(r.id) === String(id));
    if (!res) return;

    document.getElementById('modal-res-image').src = res.image;
    document.getElementById('modal-res-image').alt = res.name;
    document.getElementById('modal-res-category').innerText = res.category.toUpperCase();
    document.getElementById('modal-res-name').innerText = res.name;
    document.getElementById('modal-res-desc').innerText = res.desc;
    document.getElementById('modal-res-price').innerText = `$${res.price.toFixed(2)} USD`;
    document.getElementById('modal-add-btn').dataset.id = res.id;

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

function addToCart(id) {
    const item = resources.find(r => String(r.id) === String(id));
    if (!item) {
        console.error("addToCart: no se encontró el recurso con id", id, "resources actuales:", resources);
        alert("Ese recurso ya no está disponible.");
        return;
    }

    // Solo guardamos el ID en localStorage (no la imagen completa) para no llenar la cuota de almacenamiento.
    cart.push(item.id);
    try {
        localStorage.setItem('voltaje_cart', JSON.stringify(cart));
    } catch (err) {
        cart.pop();
        console.error("No se pudo guardar el carrito:", err);
        alert("No se pudo agregar el producto: el almacenamiento del navegador está lleno. Intenta liberar espacio o usa otro navegador.");
        return;
    }
    updateCart();
    closeResourceModal();
    alert(`"${item.name}" fue agregado al carrito.`);
}

function getCartItems() {
    // cart puede contener ids (nuevo formato) o, por compatibilidad con datos viejos, objetos completos.
    return cart
        .map(entry => {
            const id = (entry && typeof entry === 'object') ? entry.id : entry;
            return resources.find(r => String(r.id) === String(id));
        })
        .filter(Boolean);
}

function updateCart() {
    const items = getCartItems();

    const countEl = document.getElementById('cart-count');
    if (countEl) countEl.innerText = items.length;

    const container = document.getElementById('cart-items');
    if (!container) return;

    container.innerHTML = '';
    let total = 0;

    if(items.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted)">El carrito está totalmente vacío.</p>';
    }

    items.forEach((item, index) => {
        total += item.price;
        const row = document.createElement('div');
        row.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; background:rgba(0,0,0,0.3); padding:10px 15px; border-radius:8px;";
        row.innerHTML = `
            <div>
                <strong>${escapeHtml(item.name)}</strong>
                <div style="color:#10b981; font-size:0.9rem;">$${item.price.toFixed(2)} USD</div>
            </div>
            <button onclick="removeFromCart(${index})" style="background:var(--neon-secondary); color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
        `;
        container.appendChild(row);
    });

    const totalEl = document.getElementById('cart-total');
    if (totalEl) totalEl.innerText = `$${total.toFixed(2)} USD`;
}

function removeFromCart(index) {
    // El índice viene de la lista ya resuelta (getCartItems), así que lo mapeamos de vuelta al array real de ids.
    const items = getCartItems();
    const removed = items[index];
    if (!removed) return;

    const rawIndex = cart.findIndex(entry => {
        const id = (entry && typeof entry === 'object') ? entry.id : entry;
        return String(id) === String(removed.id);
    });
    if (rawIndex !== -1) cart.splice(rawIndex, 1);

    localStorage.setItem('voltaje_cart', JSON.stringify(cart));
    updateCart();
}

function checkout() {
    const items = getCartItems();
    if (items.length === 0) return alert("Tu carrito está vacío.");
    if (!currentUser) return alert("Debes iniciar sesión con Discord.");

    const itemIds = items.map(item => item.id);
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

    items.forEach((item, index) => {
        const n = index + 1;
        params.set(`item_name_${n}`, item.name);
        params.set(`item_number_${n}`, item.id);
        params.set(`amount_${n}`, item.price.toFixed(2));
        params.set(`quantity_${n}`, '1');
    });

    window.location.href = `https://www.paypal.com/cgi-bin/webscr?${params.toString()}`;
}

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
            const item = resources.find(r => String(r.id) === String(id)) || savedCart.find(r => String((r && r.id) ?? r) === String(id));
            const purchasedId = item ? item.id : id;
            if (purchasedId && !userPurchases[currentUser.id].some(p => String((p && p.id) ?? p) === String(purchasedId))) {
                // Guardamos solo el ID de la compra, no el objeto completo con la imagen en base64,
                // para no llenar la cuota de localStorage.
                userPurchases[currentUser.id].push(purchasedId);
            }
        });

        try {
            localStorage.setItem('voltaje_purchases', JSON.stringify(userPurchases));
        } catch (err) {
            console.error("No se pudo guardar las compras:", err);
        }

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
            <img src="${u.avatar}" alt="${escapeHtml(u.username)}">
            <div class="ranking-user">
                <strong>${escapeHtml(u.username)}</strong>
                <small>Miembro desde ${u.date}</small>
            </div>
            <div class="ranking-count">${u.count} compra${u.count !== 1 ? 's' : ''}</div>
        `;
        container.appendChild(item);
    });
}

function getOwnedResources() {
    if (!currentUser) return [];
    const purchaseEntries = userPurchases[currentUser.id] || [];
    // Compatibilidad: entradas antiguas guardadas como objeto completo, y nuevas guardadas como id.
    return purchaseEntries
        .map(entry => {
            const id = (entry && typeof entry === 'object') ? entry.id : entry;
            return resources.find(r => String(r.id) === String(id)) || (entry && typeof entry === 'object' ? entry : null);
        })
        .filter(Boolean);
}

function renderOwnedProducts() {
    if (!currentUser) return;
    const purchases = getOwnedResources();

    const grid = document.getElementById('owned-products-grid');
    const downloadsList = document.getElementById('downloads-list');

    if (!grid || !downloadsList) return;

    grid.innerHTML = '';
    downloadsList.innerHTML = '';

    if (purchases.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted)">Aún no has comprado ningún recurso.</p>';
        downloadsList.innerHTML = '<p style="color:var(--text-muted)">Aún no tienes enlaces de descarga.</p>';
        return;
    }

    purchases.forEach(res => {
        const card = document.createElement('div');
        card.className = 'res-card glass';
        card.innerHTML = `
            <img src="${res.image}" alt="${escapeHtml(res.name)}">
            <div class="res-content">
                <h3>${escapeHtml(res.name)}</h3>
                <p>${escapeHtml(res.desc)}</p>
                <a href="${res.link}" target="_blank" class="btn-glow" style="text-align:center; text-decoration:none; display:block;">DESCARGAR AHORA</a>
            </div>
        `;
        grid.appendChild(card);

        const li = document.createElement('li');
        li.className = 'download-item glass';
        li.innerHTML = `
            <div>
                <strong>${escapeHtml(res.name)}</strong>
                <div style="color:var(--text-muted); font-size:0.85rem;">Categoría: ${res.category.toUpperCase()}</div>
            </div>
            <a href="${res.link}" target="_blank" class="btn-download-direct"><i class="fa-solid fa-cloud-arrow-down"></i> Descargar</a>
        `;
        downloadsList.appendChild(li);
    });
}


// PANEL ADMIN: PUBLICAR RECURSO
// Comprime/redimensiona una imagen antes de guardarla en base64, para no llenar
// la cuota de localStorage con fotos originales de varios MB.
function comprimirImagen(file, maxAncho = 800, calidad = 0.72) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const escala = Math.min(1, maxAncho / img.width);
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * escala);
                canvas.height = Math.round(img.height * escala);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', calidad));
            };
            img.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada."));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
        reader.readAsDataURL(file);
    });
}

const addResourceForm = document.getElementById('add-resource-form');
if (addResourceForm) {
    addResourceForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('res-name').value;
        const category = document.getElementById('res-category').value;
        const price = parseFloat(document.getElementById('res-price').value);
        const link = document.getElementById('res-link').value;
        const desc = document.getElementById('res-desc').value;
        const imageFile = document.getElementById('res-image-file').files[0];

        if (!imageFile) return alert("Por favor selecciona una imagen desde tu dispositivo.");

        const submitBtn = addResourceForm.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "PUBLICANDO..."; }

        try {
            const imagenComprimida = await comprimirImagen(imageFile);

            const newRes = {
                id: Date.now(),
                name: name,
                category: category,
                price: price,
                image: imagenComprimida,
                link: link,
                desc: desc
            };

            resources.push(newRes);
            localStorage.setItem('voltaje_resources', JSON.stringify(resources));
            alert("¡Recurso publicado exitosamente en la tienda!");

            addResourceForm.reset();
            renderResources('all');
            renderAdminResources();
        } catch (err) {
            console.error("Error al publicar recurso:", err);
            if (err && err.name === 'QuotaExceededError') {
                alert("No se pudo publicar: el almacenamiento del navegador está lleno. Elimina algún recurso viejo desde 'Gestionar Recursos Publicados' o usa una imagen más liviana, y vuelve a intentar.");
            } else {
                alert("No se pudo publicar el recurso: " + (err && err.message ? err.message : "error desconocido."));
            }
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "PUBLICAR EN TIENDA"; }
        }
    });
}

function deleteResource(id) {
    const item = resources.find(r => r.id === id);
    if (!item) return;
    if (!confirm(`¿Seguro que quieres eliminar "${item.name}" de la tienda?`)) return;

    resources = resources.filter(r => r.id !== id);
    localStorage.setItem('voltaje_resources', JSON.stringify(resources));

    renderResources('all');
    renderAdminResources();
}

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
            <img src="${res.image}" alt="${escapeHtml(res.name)}" style="width:34px; height:34px; border-radius:8px; object-fit:cover;">
            <div style="flex-grow:1;">
                <strong>${escapeHtml(res.name)}</strong>
                <br><small style="color:var(--text-muted)">${res.category.toUpperCase()} · $${res.price.toFixed(2)} USD</small>
            </div>
            <button onclick="deleteResource(${res.id})" class="btn-icon-danger" title="Eliminar recurso"><i class="fa-solid fa-trash"></i></button>
        `;
        list.appendChild(li);
    });
}

const addAdminForm = document.getElementById('add-admin-form');
if (addAdminForm) {
    addAdminForm.addEventListener('submit', (e) => {
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
        alert(`"${newAdmin}" ahora es administrador.`);
    });
}

function removeAdmin(username) {
    if (!confirm(`¿Quitar permisos de administrador a "${username}"?`)) return;
    extraAdmins = extraAdmins.filter(u => u !== username);
    localStorage.setItem('voltaje_extra_admins', JSON.stringify(extraAdmins));
    renderAdminsList();
}

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
    if (!list) return;
    list.innerHTML = '';
    registeredUsers.forEach(u => {
        const li = document.createElement('li');
        li.innerHTML = `
            <img src="${u.avatar}" alt="Avatar">
            <div>
                <strong>${escapeHtml(u.username)}</strong>
                <br><small style="color:var(--text-muted)">Registrado: ${u.date}</small>
            </div>
        `;
        list.appendChild(li);
    });
}

function populateReviewProductSelect() {
    const select = document.getElementById('review-product');
    if (!select) return;

    const previousValue = select.value;
    select.innerHTML = '<option value="">Calificación general</option>';

    resources.forEach(res => {
        const option = document.createElement('option');
        option.value = res.id;
        option.textContent = res.name;
        select.appendChild(option);
    });

    if (resources.some(r => String(r.id) === previousValue)) {
        select.value = previousValue;
    }
}

function buildStarsHtml(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += i <= rating ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>';
    }
    return html;
}

const starRatingInput = document.getElementById('star-rating-input');
if (starRatingInput) {
    const ratingHiddenInput = document.getElementById('review-rating-value');
    const stars = starRatingInput.querySelectorAll('i');

    function paintStars(value) {
        stars.forEach(star => {
            star.classList.toggle('active', Number(star.dataset.value) <= value);
        });
    }

    paintStars(Number(ratingHiddenInput.value));

    stars.forEach(star => {
        star.addEventListener('click', () => {
            const value = Number(star.dataset.value);
            ratingHiddenInput.value = value;
            paintStars(value);
        });
        star.addEventListener('mouseenter', () => paintStars(Number(star.dataset.value)));
    });
    starRatingInput.addEventListener('mouseleave', () => paintStars(Number(ratingHiddenInput.value)));
}

const addReviewForm = document.getElementById('add-review-form');
if (addReviewForm) {
    addReviewForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentUser) return alert("Debes iniciar sesión para dejar una reseña.");

        const rating = Number(document.getElementById('review-rating-value').value) || 5;
        const text = document.getElementById('review-text').value.trim();
        if (!text) return;

        const productSelect = document.getElementById('review-product');
        const productId = productSelect && productSelect.value ? Number(productSelect.value) : null;
        const productMatch = productId ? resources.find(r => r.id === productId) : null;

        const newReview = {
            id: Date.now(),
            userId: currentUser.id,
            username: currentUser.username,
            avatar: currentUser.avatar,
            rating: rating,
            text: text,
            date: new Date().toLocaleDateString(),
            productId: productMatch ? productMatch.id : null,
            productName: productMatch ? productMatch.name : null
        };

        reviews.unshift(newReview);
        localStorage.setItem('voltaje_reviews', JSON.stringify(reviews));

        addReviewForm.reset();
        document.getElementById('review-rating-value').value = 5;

        renderReviews();
        renderMyReviews();
        alert("¡Gracias por tu reseña! Ya está publicada.");
    });
}

function buildReviewCardHtml(rev) {
    const tag = rev.productName ? `<span class="review-tag">${escapeHtml(rev.productName)}</span>` : '';
    return `
        <div class="review-card-header">
            <img src="${rev.avatar}" alt="${escapeHtml(rev.username)}">
            <div>
                <strong>${escapeHtml(rev.username)}</strong>
                <div class="review-stars">${buildStarsHtml(rev.rating)}</div>
            </div>
        </div>
        <p>${escapeHtml(rev.text)}</p>
        ${tag}
    `;
}

function renderReviews() {
    const container = document.getElementById('reviews-list');
    if (!container) return;
    container.innerHTML = '';

    if (reviews.length === 0) {
        container.innerHTML = '<p class="review-card-empty">Aún no hay reseñas. ¡Sé el primero en dejar una desde tu perfil!</p>';
        return;
    }

    reviews.slice(0, 9).forEach(rev => {
        const card = document.createElement('div');
        card.className = 'review-card glass';
        card.innerHTML = buildReviewCardHtml(rev);
        container.appendChild(card);
    });
}

function renderMyReviews() {
    const container = document.getElementById('my-reviews-list');
    if (!container || !currentUser) return;
    container.innerHTML = '';

    const mine = reviews.filter(r => r.userId === currentUser.id);

    if (mine.length === 0) {
        container.innerHTML = '<p class="review-card-empty">Todavía no has publicado ninguna reseña.</p>';
        return;
    }

    mine.forEach(rev => {
        const card = document.createElement('div');
        card.className = 'review-card glass';
        card.innerHTML = buildReviewCardHtml(rev);
        container.appendChild(card);
    });
}