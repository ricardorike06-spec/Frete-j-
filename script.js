// Variáveis de estado do aplicativo
let isDriverMode = false;
let selectedTruckType = 'leve';
let selectedServiceType = 'imediato';
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDate = null;
let isLoggedIn = false;
let pendingAction = null;
let mapsLoaded = false;
let isDriverOnline = false;
let resetCpf = null;

// Variáveis para armazenar dados de rota
let routeData = {
    imediato: { distance: 0, duration: '', durationText: '' },
    orcamento: { distance: 0, duration: '', durationText: '' }
};

// Variáveis para os mapas
let imediatoMap = null;
let orcamentoMap = null;
let imediatoDirectionsRenderer = null;
let orcamentoDirectionsRenderer = null;

// Variáveis para pagamento e histórico
let currentPaymentMethod = null;
let currentFreightData = null;
let currentHistoryFilter = 'all';

// Variáveis para fretes disponíveis (para caminhoneiros)
let availableFreights = [];

// Constantes para cálculo de frete
const PRICE_PER_KM_LEVE = 2.5;
const PRICE_PER_KM_PESADA = 4.0;
const FUEL_PRICE_PER_LITER = 6.0;
const AVERAGE_CONSUMPTION_LEVE = 3.5;
const AVERAGE_CONSUMPTION_PESADA = 2.5;

// ==================== FUNÇÕES DE RECUPERAÇÃO DE SENHA ====================

function showRecoveryMethod(method) {
    document.querySelectorAll('.recovery-form').forEach(form => form.classList.add('hidden'));
    
    if (method === 'whatsapp') {
        document.getElementById('whatsappRecovery').classList.remove('hidden');
    } else if (method === 'email') {
        document.getElementById('emailRecovery').classList.remove('hidden');
    } else if (method === 'security') {
        document.getElementById('securityRecovery').classList.remove('hidden');
    }
}

function sendRecoveryWhatsapp() {
    const cpf = document.getElementById('whatsappCpf').value.replace(/\D/g, '');
    const phone = document.getElementById('whatsappPhone').value.replace(/\D/g, '');
    
    const users = JSON.parse(localStorage.getItem('freteja_users')) || [];
    const user = users.find(u => u.cpf === cpf);
    
    if (!user) {
        showToast('CPF não encontrado');
        return;
    }
    
    if (user.phone !== phone) {
        showToast('WhatsApp não corresponde ao cadastro');
        return;
    }
    
    // Simular envio de código
    const recoveryCode = Math.floor(100000 + Math.random() * 900000).toString();
    localStorage.setItem(`recovery_code_${cpf}`, recoveryCode);
    
    showToast(`Código enviado para ${formatPhone(phone)}: ${recoveryCode}`);
    
    const code = prompt('Digite o código recebido:');
    if (code === recoveryCode) {
        resetCpf = cpf;
        document.getElementById('resetPasswordForm').classList.remove('hidden');
        document.getElementById('whatsappRecovery').classList.add('hidden');
        showToast('Código verificado! Digite sua nova senha');
    } else {
        showToast('Código inválido');
    }
}

function sendRecoveryEmail() {
    const cpf = document.getElementById('emailCpf').value.replace(/\D/g, '');
    const email = document.getElementById('recoveryEmail').value;
    
    const users = JSON.parse(localStorage.getItem('freteja_users')) || [];
    const user = users.find(u => u.cpf === cpf);
    
    if (!user) {
        showToast('CPF não encontrado');
        return;
    }
    
    if (user.email !== email) {
        showToast('E-mail não corresponde ao cadastro');
        return;
    }
    
    const recoveryCode = Math.floor(100000 + Math.random() * 900000).toString();
    localStorage.setItem(`recovery_code_${cpf}`, recoveryCode);
    
    showToast(`Código enviado para ${email}: ${recoveryCode}`);
    
    const code = prompt('Digite o código recebido:');
    if (code === recoveryCode) {
        resetCpf = cpf;
        document.getElementById('resetPasswordForm').classList.remove('hidden');
        document.getElementById('emailRecovery').classList.add('hidden');
        showToast('Código verificado! Digite sua nova senha');
    } else {
        showToast('Código inválido');
    }
}

function verifySecurityAnswer() {
    const cpf = document.getElementById('securityCpf').value.replace(/\D/g, '');
    const answer = document.getElementById('securityAnswer').value;
    
    const users = JSON.parse(localStorage.getItem('freteja_users')) || [];
    const user = users.find(u => u.cpf === cpf);
    
    if (!user) {
        showToast('CPF não encontrado');
        return;
    }
    
    if (user.securityQuestion !== answer) {
        showToast('Frase de segurança incorreta');
        return;
    }
    
    resetCpf = cpf;
    document.getElementById('resetPasswordForm').classList.remove('hidden');
    document.getElementById('securityRecovery').classList.add('hidden');
    showToast('Frase verificada! Digite sua nova senha');
}

function resetPassword() {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;
    
    if (newPassword.length < 6) {
        showToast('A senha deve ter pelo menos 6 caracteres');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('As senhas não coincidem');
        return;
    }
    
    const users = JSON.parse(localStorage.getItem('freteja_users')) || [];
    const userIndex = users.findIndex(u => u.cpf === resetCpf);
    
    if (userIndex !== -1) {
        users[userIndex].password = newPassword;
        localStorage.setItem('freteja_users', JSON.stringify(users));
        showToast('Senha alterada com sucesso! Faça login com sua nova senha');
        showPage('loginPage');
        
        // Limpar campos
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmNewPassword').value = '';
        document.getElementById('resetPasswordForm').classList.add('hidden');
        resetCpf = null;
    }
}

// ==================== FUNÇÕES DE CAMINHONEIRO ====================

// Toggle modo caminhoneiro
function toggleDriverMode() {
    if (!isLoggedIn) {
        pendingAction = toggleDriverMode;
        showPage('loginPage');
        return;
    }
    
    isDriverMode = !isDriverMode;
    const toggle = document.querySelector('.mode-toggle');
    
    if (isDriverMode) {
        toggle.innerHTML = '<i class="fas fa-truck"></i> Caminhoneiro';
        showToast('Modo caminhoneiro ativado');
        loadDriverPanel();
        showPage('driverPanelPage');
        document.getElementById('appTabBar').style.display = 'flex';
    } else {
        toggle.innerHTML = '<i class="fas fa-user"></i> Cliente';
        showToast('Modo cliente ativado');
        showPage('homePage');
        document.getElementById('appTabBar').style.display = 'flex';
    }
}

// Carregar painel do caminhoneiro
function loadDriverPanel() {
    loadDriverEarnings();
    loadDriverRating();
    loadAvailableFreights();
    loadMyFreights();
    updateDriverStatusUI();
}

// Carregar ganhos do caminhoneiro
function loadDriverEarnings() {
    const user = JSON.parse(localStorage.getItem('freteja_current_user'));
    if (!user) return;
    
    const driverFreights = JSON.parse(localStorage.getItem(`freteja_driver_freights_${user.cpf}`)) || [];
    const today = new Date().toDateString();
    const todayEarnings = driverFreights
        .filter(f => new Date(f.acceptedAt).toDateString() === today && f.status === 'completed')
        .reduce((sum, f) => sum + f.price, 0);
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekEarnings = driverFreights
        .filter(f => new Date(f.acceptedAt) >= weekAgo && f.status === 'completed')
        .reduce((sum, f) => sum + f.price, 0);
    
    document.getElementById('todayEarnings').textContent = formatCurrency(todayEarnings);
    document.getElementById('weekEarnings').textContent = formatCurrency(weekEarnings);
}

// Carregar avaliação do caminhoneiro
function loadDriverRating() {
    const user = JSON.parse(localStorage.getItem('freteja_current_user'));
    if (!user) return;
    
    const ratings = JSON.parse(localStorage.getItem(`freteja_driver_ratings_${user.cpf}`)) || [];
    if (ratings.length === 0) {
        document.getElementById('driverRating').textContent = '0.0';
        return;
    }
    const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
    document.getElementById('driverRating').textContent = avgRating.toFixed(1);
}

// Alternar status online/offline do caminhoneiro
function toggleDriverOnlineStatus() {
    isDriverOnline = !isDriverOnline;
    updateDriverStatusUI();
    
    if (isDriverOnline) {
        showToast('Você está online e receberá solicitações de frete');
        // Simular recebimento de novos fretes a cada 30 segundos
        if (window.freightInterval) clearInterval(window.freightInterval);
        window.freightInterval = setInterval(() => {
            if (isDriverOnline && isDriverMode) {
                checkNewFreights();
            }
        }, 30000);
    } else {
        showToast('Você está offline. Não receberá novas solicitações');
        if (window.freightInterval) {
            clearInterval(window.freightInterval);
            window.freightInterval = null;
        }
    }
}

function updateDriverStatusUI() {
    const indicator = document.getElementById('driverStatusIndicator');
    const statusText = document.getElementById('driverStatusText');
    const toggleBtn = document.getElementById('onlineToggleBtn');
    
    if (isDriverOnline) {
        indicator.innerHTML = '<i class="fas fa-circle online"></i><span>Online</span>';
        statusText.textContent = 'Online';
        toggleBtn.innerHTML = '<i class="fas fa-power-off"></i> Ficar Offline';
        toggleBtn.style.background = '#e74c3c';
        toggleBtn.style.color = 'white';
    } else {
        indicator.innerHTML = '<i class="fas fa-circle offline"></i><span>Offline</span>';
        statusText.textContent = 'Offline';
        toggleBtn.innerHTML = '<i class="fas fa-power-off"></i> Ficar Online';
        toggleBtn.style.background = 'white';
        toggleBtn.style.color = '#2c3e50';
    }
}

// Carregar fretes disponíveis
function loadAvailableFreights() {
    const allRequests = JSON.parse(localStorage.getItem('freteja_all_requests')) || [];
    const user = JSON.parse(localStorage.getItem('freteja_current_user'));
    
    if (!user) return;
    
    const driverFreights = JSON.parse(localStorage.getItem(`freteja_driver_freights_${user.cpf}`)) || [];
    const acceptedIds = driverFreights.map(f => f.requestId);
    
    const available = allRequests.filter(req => 
        req.status === 'pending' && 
        !acceptedIds.includes(req.id) &&
        req.truckType === selectedTruckType
    );
    
    availableFreights = available;
    renderAvailableFreights();
}

function renderAvailableFreights() {
    const container = document.getElementById('availableFreightsList');
    
    if (availableFreights.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-truck"></i>
                <p>Nenhum frete disponível no momento</p>
                <small>Fique online para receber solicitações</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = availableFreights.map(freight => `
        <div class="freight-card" data-id="${freight.id}">
            <div class="freight-header">
                <span class="freight-price">${formatCurrency(freight.price)}</span>
                <span class="freight-type-badge">${freight.truckType === 'leve' ? 'Carga Leve' : 'Carga Pesada'}</span>
            </div>
            <div class="freight-route">
                <i class="fas fa-route"></i> ${freight.origin} → ${freight.destination}
            </div>
            <div class="freight-info">
                <span><i class="fas fa-box"></i> ${freight.cargo.substring(0, 40)}${freight.cargo.length > 40 ? '...' : ''}</span>
                <span><i class="fas fa-road"></i> ${freight.distance} km</span>
                ${freight.scheduledDate ? `<span><i class="fas fa-calendar"></i> ${new Date(freight.scheduledDate).toLocaleDateString('pt-BR')}</span>` : ''}
            </div>
            <button class="accept-freight-btn" onclick="acceptFreight(${freight.id})">
                <i class="fas fa-check-circle"></i> Aceitar Frete
            </button>
        </div>
    `).join('');
}

// Aceitar um frete
function acceptFreight(freightId) {
    const freight = availableFreights.find(f => f.id === freightId);
    if (!freight) return;
    
    const user = JSON.parse(localStorage.getItem('freteja_current_user'));
    if (!user) return;
    
    const driverFreights = JSON.parse(localStorage.getItem(`freteja_driver_freights_${user.cpf}`)) || [];
    
    const acceptedFreight = {
        ...freight,
        driverName: user.name,
        driverCpf: user.cpf,
        acceptedAt: new Date().toISOString(),
        status: 'accepted',
        requestId: freight.id
    };
    
    driverFreights.push(acceptedFreight);
    localStorage.setItem(`freteja_driver_freights_${user.cpf}`, JSON.stringify(driverFreights));
    
    // Atualizar status do request
    const allRequests = JSON.parse(localStorage.getItem('freteja_all_requests')) || [];
    const requestIndex = allRequests.findIndex(r => r.id === freight.id);
    if (requestIndex !== -1) {
        allRequests[requestIndex].status = 'accepted';
        allRequests[requestIndex].driverName = user.name;
        allRequests[requestIndex].driverCpf = user.cpf;
        localStorage.setItem('freteja_all_requests', JSON.stringify(allRequests));
        
        // Atualizar histórico do cliente
        const clientHistory = JSON.parse(localStorage.getItem(`freteja_history_${freight.clientCpf}`)) || [];
        const historyIndex = clientHistory.findIndex(h => h.id === freight.id);
        if (historyIndex !== -1) {
            clientHistory[historyIndex].status = 'accepted';
            clientHistory[historyIndex].driverName = user.name;
            localStorage.setItem(`freteja_history_${freight.clientCpf}`, JSON.stringify(clientHistory));
        }
    }
    
    showToast(`Frete aceito! Entre em contato com o cliente.`);
    loadAvailableFreights();
    loadMyFreights();
    loadDriverEarnings();
}

// Carregar fretes do caminhoneiro
function loadMyFreights() {
    const user = JSON.parse(localStorage.getItem('freteja_current_user'));
    if (!user) return;
    
    const driverFreights = JSON.parse(localStorage.getItem(`freteja_driver_freights_${user.cpf}`)) || [];
    const container = document.getElementById('myFreightsList');
    
    if (driverFreights.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-history"></i>
                <p>Você ainda não aceitou nenhum frete</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = driverFreights.map(freight => `
        <div class="my-freight-card">
            <div class="freight-status status-${freight.status === 'completed' ? 'completed' : 'pending'}">
                ${freight.status === 'completed' ? 'Concluído' : 'Em andamento'}
            </div>
            <div class="freight-header">
                <span class="freight-price">${formatCurrency(freight.price)}</span>
            </div>
            <div class="freight-route">
                <i class="fas fa-route"></i> ${freight.origin} → ${freight.destination}
            </div>
            <div class="freight-info">
                <span><i class="fas fa-user"></i> Cliente: ${freight.clientName || 'Cliente'}</span>
                <span><i class="fas fa-calendar"></i> ${new Date(freight.acceptedAt).toLocaleDateString('pt-BR')}</span>
            </div>
            ${freight.status !== 'completed' ? `
                <button class="accept-freight-btn" style="background: var(--success); margin-top: 10px;" onclick="completeFreight(${freight.id})">
                    <i class="fas fa-check"></i> Concluir Entrega
                </button>
            ` : ''}
        </div>
    `).join('');
}

// Concluir frete
function completeFreight(freightId) {
    const user = JSON.parse(localStorage.getItem('freteja_current_user'));
    if (!user) return;
    
    const driverFreights = JSON.parse(localStorage.getItem(`freteja_driver_freights_${user.cpf}`)) || [];
    const freightIndex = driverFreights.findIndex(f => f.id === freightId);
    
    if (freightIndex !== -1) {
        driverFreights[freightIndex].status = 'completed';
        driverFreights[freightIndex].completedAt = new Date().toISOString();
        localStorage.setItem(`freteja_driver_freights_${user.cpf}`, JSON.stringify(driverFreights));
        
        // Atualizar histórico do cliente
        const freight = driverFreights[freightIndex];
        const clientHistory = JSON.parse(localStorage.getItem(`freteja_history_${freight.clientCpf}`)) || [];
        const historyIndex = clientHistory.findIndex(h => h.id === freight.requestId);
        if (historyIndex !== -1) {
            clientHistory[historyIndex].status = 'completed';
            localStorage.setItem(`freteja_history_${freight.clientCpf}`, JSON.stringify(clientHistory));
        }
        
        showToast('Entrega concluída! Aguardando pagamento.');
        loadMyFreights();
        loadDriverEarnings();
    }
}

// Verificar novos fretes
function checkNewFreights() {
    loadAvailableFreights();
    if (availableFreights.length > 0) {
        showToast(`📦 ${availableFreights.length} novo(s) frete(s) disponível(is)!`);
    }
}

// ==================== FUNÇÕES DE CLIENTE ====================

// Solicitar frete (frete imediato)
function requestFreight() {
    if (!isLoggedIn) {
        pendingAction = requestFreight;
        showPage('loginPage');
        return;
    }
    
    const price = parseFloat(document.getElementById('priceInput').value);
    if (price < 100) { showToast('O valor mínimo é R$ 100,00'); return; }
    if (routeData.imediato.distance === 0) { showToast('Por favor, calcule a rota primeiro'); return; }
    
    const user = JSON.parse(localStorage.getItem('freteja_current_user'));
    const cargo = document.getElementById('imediatoCargo').value;
    const origin = document.getElementById('imediatoOrigin').value;
    const destination = document.getElementById('imediatoDestination').value;
    
    const freightRequest = {
        id: Date.now(),
        type: 'imediato',
        origin,
        destination,
        cargo,
        price,
        distance: routeData.imediato.distance,
        truckType: selectedTruckType,
        clientName: user.name,
        clientCpf: user.cpf,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    
    // Salvar request
    const allRequests = JSON.parse(localStorage.getItem('freteja_all_requests')) || [];
    allRequests.push(freightRequest);
    localStorage.setItem('freteja_all_requests', JSON.stringify(allRequests));
    
    // Adicionar ao histórico do cliente
    const historyEntry = {
        ...freightRequest,
        date: freightRequest.createdAt,
        id: freightRequest.id
    };
    addToHistory(historyEntry);
    
    showToast('Solicitação enviada! Aguardando caminhoneiro.');
    
    // Mostrar ofertas simuladas
    showOffers();
}

// Solicitar orçamento
function requestOrcamento() {
    if (!isLoggedIn) {
        pendingAction = requestOrcamento;
        showPage('loginPage');
        return;
    }
    
    const price = parseFloat(document.getElementById('priceInputOrcamento').value);
    if (price < 100) { showToast('O valor mínimo é R$ 100,00'); return; }
    if (!selectedDate) { showToast('Por favor, selecione uma data'); return; }
    if (routeData.orcamento.distance === 0) { showToast('Por favor, calcule a rota primeiro'); return; }
    
    const user = JSON.parse(localStorage.getItem('freteja_current_user'));
    const cargo = document.getElementById('orcamentoCargo').value;
    const origin = document.getElementById('orcamentoOrigin').value;
    const destination = document.getElementById('orcamentoDestination').value;
    
    const freightRequest = {
        id: Date.now(),
        type: 'orcamento',
        origin,
        destination,
        cargo,
        price,
        distance: routeData.orcamento.distance,
        truckType: selectedTruckType,
        clientName: user.name,
        clientCpf: user.cpf,
        scheduledDate: selectedDate.toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    
    const allRequests = JSON.parse(localStorage.getItem('freteja_all_requests')) || [];
    allRequests.push(freightRequest);
    localStorage.setItem('freteja_all_requests', JSON.stringify(allRequests));
    
    const historyEntry = {
        ...freightRequest,
        date: freightRequest.createdAt,
        id: freightRequest.id
    };
    addToHistory(historyEntry);
    
    showToast('Orçamento solicitado! Você receberá cotações em breve.');
    showOffersOrcamento();
}

// Mostrar ofertas (frete imediato)
function showOffers() {
    const cargo = document.getElementById('imediatoCargo').value;
    const origin = document.getElementById('imediatoOrigin').value;
    const dest = document.getElementById('imediatoDestination').value;
    const price = parseFloat(document.getElementById('priceInput').value);
    const distance = routeData.imediato.distance;
    document.getElementById('imediatoPriceSection').classList.add('hidden');
    
    const html = `<div id="offersContainer" style="padding:15px">
        <h2 style="margin-bottom:15px;text-align:center">Ofertas Recebidas</h2>
        <div style="background:#ecf0f1;padding:10px;border-radius:10px;margin-bottom:15px;text-align:center">
            <small><i class="fas fa-road"></i> Distância: ${distance.toFixed(1)} km | <i class="fas fa-clock"></i> ${routeData.imediato.duration}</small>
        </div>
        ${generateOfferCard('JC', 'João Costa', 'Volvo VM - 2020', Math.max(price - 100, 500), cargo, origin, dest)}
        ${generateOfferCard('MA', 'Maria Andrade', 'Mercedes-Benz - 2022', price, cargo, origin, dest)}
        ${generateOfferCard('PS', 'Pedro Silva', 'Scania - 2021', price + 150, cargo, origin, dest)}
    </div>`;
    const mapContainer = document.querySelector('#imediatoPage .map-container');
    const existingOffers = document.getElementById('offersContainer');
    if (existingOffers) existingOffers.remove();
    mapContainer.insertAdjacentHTML('afterend', html);
}

// Mostrar ofertas (orçamento)
function showOffersOrcamento() {
    const cargo = document.getElementById('orcamentoCargo').value;
    const origin = document.getElementById('orcamentoOrigin').value;
    const dest = document.getElementById('orcamentoDestination').value;
    const price = parseFloat(document.getElementById('priceInputOrcamento').value);
    const distance = routeData.orcamento.distance;
    const dateStr = selectedDate ? selectedDate.toLocaleDateString('pt-BR') : '';
    document.getElementById('orcamentoPriceSection').classList.add('hidden');
    
    const html = `<div id="offersContainer" style="padding:15px">
        <h2 style="margin-bottom:15px;text-align:center">Orçamentos Recebidos</h2>
        <div style="background:#ecf0f1;padding:10px;border-radius:10px;margin-bottom:15px;text-align:center">
            <small><i class="fas fa-road"></i> Distância: ${distance.toFixed(1)} km | <i class="fas fa-clock"></i> ${routeData.orcamento.duration}</small>
        </div>
        ${generateOfferCard('JC', 'João Costa', 'Volvo VM - 2020', Math.max(price - 200, 500), cargo, origin, dest, dateStr)}
        ${generateOfferCard('MA', 'Maria Andrade', 'Mercedes-Benz - 2022', price, cargo, origin, dest, dateStr)}
        ${generateOfferCard('PS', 'Pedro Silva', 'Scania - 2021', price + 250, cargo, origin, dest, dateStr)}
    </div>`;
    const calendarSection = document.querySelector('#orcamentoPage .calendar-section');
    const existingOffers = document.getElementById('offersContainer');
    if (existingOffers) existingOffers.remove();
    calendarSection.insertAdjacentHTML('afterend', html);
}

function generateOfferCard(avatar, name, truck, price, cargo, origin, dest, date = null) {
    const truckBadge = selectedTruckType === 'leve' ? 'Leve' : 'Média/Pesada';
    const dateHtml = date ? `<p><i class="fas fa-calendar"></i> ${date}</p>` : '';
    return `<div class="offer-card">
        <div class="offer-header">
            <div class="driver-info">
                <div class="driver-avatar">${avatar}</div>
                <div>
                    <div class="driver-name">${name}</div>
                    <div class="truck-info">${truck}</div>
                    <span class="truck-badge">${truckBadge}</span>
                </div>
            </div>
            <div class="offer-price">${formatCurrency(price)}</div>
        </div>
        <p class="cargo-badge">${cargo.substring(0, 50)}${cargo.length > 50 ? '...' : ''}</p>
        <p><i class="fas fa-route"></i> ${origin} → ${dest}</p>
        ${dateHtml}
        <div class="offer-actions">
            <button class="action-btn decline-btn" onclick="declineOffer(this)">Recusar</button>
            <button class="action-btn negotiate-btn" onclick="negotiateOffer(this)">Negociar</button>
            <button class="action-btn accept-btn" onclick="acceptOffer(this)">Aceitar</button>
        </div>
    </div>`;
}

function acceptOffer(btn) {
    const card = btn.closest('.offer-card');
    const driver = card.querySelector('.driver-name').textContent;
    const truck = card.querySelector('.truck-info').textContent;
    const priceText = card.querySelector('.offer-price').textContent;
    const price = parseFloat(priceText.replace('R$', '').replace('.', '').replace(',', '.').trim());
    const origin = document.getElementById(`${selectedServiceType}Origin`).value;
    const destination = document.getElementById(`${selectedServiceType}Destination`).value;
    const cargo = document.getElementById(`${selectedServiceType}Cargo`).value;
    
    const freightData = {
        origin,
        destination,
        cargo,
        price,
        driverName: driver,
        truckType: selectedTruckType,
        truckModel: truck,
        serviceType: selectedServiceType,
        scheduledDate: selectedDate ? selectedDate.toISOString() : null
    };
    
    const savedFreight = addToHistory(freightData);
    
    // Atualizar request
    const allRequests = JSON.parse(localStorage.getItem('freteja_all_requests')) || [];
    const requestIndex = allRequests.findIndex(r => r.id === savedFreight.id);
    if (requestIndex !== -1) {
        allRequests[requestIndex].status = 'accepted';
        allRequests[requestIndex].driverName = driver;
        localStorage.setItem('freteja_all_requests', JSON.stringify(allRequests));
    }
    
    card.innerHTML = `<div style="text-align:center;padding:20px 0">
        <h3 style="color:#2ecc71;margin-bottom:15px">Frete ${selectedServiceType === 'imediato' ? 'aceito' : 'contratado'}!</h3>
        <p>Caminhoneiro: ${driver}</p>
        <p>Preço: ${priceText}</p>
        <div style="font-size:48px;color:#2ecc71;margin:20px 0"><i class="fas fa-check-circle"></i></div>
        <p>${selectedServiceType === 'imediato' ? 'Seu caminhoneiro chegará em aproximadamente 2 horas' : 'Seu frete foi agendado com sucesso'}</p>
        <button class="action-btn accept-btn" style="margin-top:15px" onclick="proceedToPayment(${savedFreight.id})">
            <i class="fas fa-credit-card"></i> Prosseguir para Pagamento
        </button>
    </div>`;
}

function declineOffer(btn) { 
    btn.closest('.offer-card').remove();
    const offersContainer = document.getElementById('offersContainer');
    if (offersContainer && offersContainer.querySelectorAll('.offer-card').length === 0) {
        offersContainer.innerHTML += '<div style="text-align:center;padding:20px">Nenhuma oferta disponível no momento.</div>';
    }
}

function negotiateOffer(btn) {
    const card = btn.closest('.offer-card');
    const currentPrice = card.querySelector('.offer-price').textContent.replace('R$', '').replace('.', '').replace(',', '.').trim();
    card.querySelector('.offer-actions').innerHTML = `
        <div style="display:flex;width:100%;gap:10px">
            <input type="number" value="${parseFloat(currentPrice)}" style="flex:1;padding:10px;border:1px solid #3498db;border-radius:20px">
            <button class="action-btn accept-btn" onclick="sendCounterOffer(this)">Enviar</button>
        </div>
    `;
}

function sendCounterOffer(btn) {
    const input = btn.previousElementSibling;
    const newPrice = parseFloat(input.value);
    if (newPrice < 100) { showToast('Valor mínimo R$ 100,00'); return; }
    const card = btn.closest('.offer-card');
    card.querySelector('.offer-price').textContent = formatCurrency(newPrice);
    card.querySelector('.offer-actions').innerHTML = `
        <button class="action-btn decline-btn" onclick="declineOffer(this)">Recusar</button>
        <button class="action-btn negotiate-btn" onclick="negotiateOffer(this)">Negociar</button>
        <button class="action-btn accept-btn" onclick="acceptOffer(this)">Aceitar</button>
    `;
    showToast('Contraproposta enviada!');
}

// ==================== FUNÇÕES DE HISTÓRICO ====================

function loadHistory() {
    const user = JSON.parse(localStorage.getItem('freteja_current_user'));
    if (!user) return [];
    const history = JSON.parse(localStorage.getItem(`freteja_history_${user.cpf}`)) || [];
    return history;
}

function saveHistory(history) {
    const user = JSON.parse(localStorage.getItem('freteja_current_user'));
    if (user) {
        localStorage.setItem(`freteja_history_${user.cpf}`, JSON.stringify(history));
    }
}

function addToHistory(freightData) {
    const history = loadHistory();
    const newEntry = {
        id: Date.now(),
        ...freightData,
        date: new Date().toISOString(),
        status: 'pending',
        rating: null,
        comment: null
    };
    history.unshift(newEntry);
    saveHistory(history);
    return newEntry;
}

function showHistory() {
    if (!isLoggedIn) {
        pendingAction = showHistory;
        showPage('loginPage');
        return;
    }
    renderHistoryList('all');
    document.getElementById('historyModal').style.display = 'flex';
}

function closeHistoryModal() {
    document.getElementById('historyModal').style.display = 'none';
}

function filterHistory(filter) {
    currentHistoryFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderHistoryList(filter);
}

function renderHistoryList(filter) {
    const history = loadHistory();
    let filteredHistory = history;
    
    if (filter !== 'all') {
        filteredHistory = history.filter(item => item.status === filter);
    }
    
    const container = document.getElementById('historyList');
    
    if (filteredHistory.length === 0) {
        container.innerHTML = `
            <div class="empty-history">
                <i class="fas fa-history" style="font-size: 48px; color: #ccc; margin-bottom: 15px;"></i>
                <p>Nenhum frete encontrado</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredHistory.map(item => `
        <div class="history-item ${item.status}">
            <div class="history-header">
                <span class="history-date">${new Date(item.date).toLocaleDateString('pt-BR')}</span>
                <span class="history-status status-${item.status}">
                    ${item.status === 'completed' ? 'Concluído' : item.status === 'pending' ? 'Pendente' : 'Cancelado'}
                </span>
            </div>
            <div class="history-route">
                <i class="fas fa-route"></i> ${item.origin} → ${item.destination}
            </div>
            <div class="history-price">
                <i class="fas fa-tag"></i> ${formatCurrency(item.price)}
            </div>
            <div class="history-driver">
                <i class="fas fa-truck"></i> Motorista: ${item.driverName || 'Aguardando'} - ${item.truckType === 'leve' ? 'Leve' : 'Média/Pesada'}
            </div>
            ${item.status === 'completed' && !item.rating ? `
                <button class="rate-btn" onclick="openRatingModal(${item.id})">
                    <i class="fas fa-star"></i> Avaliar Motorista
                </button>
            ` : item.rating ? `
                <div class="history-rating">
                    <i class="fas fa-star" style="color: var(--warning);"></i> ${item.rating}/5
                    ${item.comment ? `<small> - "${item.comment}"</small>` : ''}
                </div>
            ` : ''}
        </div>
    `).join('');
}

// ==================== FUNÇÕES DE PAGAMENTO ====================

function showPayments() {
    if (!isLoggedIn) {
        pendingAction = showPayments;
        showPage('loginPage');
        return;
    }
    
    // Verificar se é modo caminhoneiro para mudar os textos
    const titleElement = document.getElementById('paymentsModalTitle');
    const totalPaidLabel = document.getElementById('totalPaidLabel');
    const pendingLabel = document.getElementById('pendingPaymentsLabel');
    
    if (isDriverMode) {
        titleElement.textContent = 'Meu Saldo';
        totalPaidLabel.textContent = 'Saldo total';
        pendingLabel.textContent = 'A depositar';
    } else {
        titleElement.textContent = 'Meus Pagamentos';
        totalPaidLabel.textContent = 'Total pago';
        pendingLabel.textContent = 'Pagamentos pendentes';
    }
    
    renderPaymentsList();
    document.getElementById('paymentsModal').style.display = 'flex';
}

function closePaymentsModal() {
    document.getElementById('paymentsModal').style.display = 'none';
}

function renderPaymentsList() {
    const history = loadHistory();
    const completedPayments = history.filter(item => item.status === 'completed');
    const totalPaid = completedPayments.reduce((sum, item) => sum + item.price, 0);
    const pendingPayments = history.filter(item => item.status === 'pending').length;
    
    document.getElementById('totalPaid').textContent = formatCurrency(totalPaid);
    document.getElementById('pendingPayments').textContent = pendingPayments;
    
    const container = document.getElementById('paymentsList');
    
    if (completedPayments.length === 0 && pendingPayments === 0) {
        container.innerHTML = `
            <div class="empty-history">
                <i class="fas fa-wallet" style="font-size: 48px; color: #ccc; margin-bottom: 15px;"></i>
                <p>Nenhum ${isDriverMode ? 'depósito' : 'pagamento'} registrado</p>
            </div>
        `;
        return;
    }
    
    const allPayments = [...history];
    container.innerHTML = allPayments.map(item => `
        <div class="payment-item">
            <div class="payment-info">
                <div><strong>${item.origin} → ${item.destination}</strong></div>
                <div class="history-date">${new Date(item.date).toLocaleDateString('pt-BR')}</div>
                <span class="payment-method-badge payment-method-${item.paymentMethod === 'PIX' ? 'pix' : item.paymentMethod === 'Dinheiro' ? 'money' : 'card'}">
                    <i class="fas ${item.paymentMethod === 'PIX' ? 'fa-qrcode' : item.paymentMethod === 'Dinheiro' ? 'fa-money-bill-wave' : 'fa-credit-card'}"></i>
                    ${item.paymentMethod || (isDriverMode ? 'Aguardando depósito' : 'Pendente')}
                </span>
            </div>
            <div class="payment-amount">${formatCurrency(item.price)}</div>
        </div>
    `).join('');
}

function openPaymentModal(freightData) {
    currentFreightData = freightData;
    document.getElementById('paymentModal').style.display = 'flex';
    resetPaymentModal();
}

function closePaymentModal() {
    document.getElementById('paymentModal').style.display = 'none';
    currentPaymentMethod = null;
    currentFreightData = null;
}

function resetPaymentModal() {
    currentPaymentMethod = null;
    document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('selected'));
    document.querySelectorAll('.payment-area').forEach(a => a.classList.add('hidden'));
    document.getElementById('confirmPaymentBtn').classList.add('hidden');
    document.getElementById('cardName').value = '';
    document.getElementById('cardNumber').value = '';
    document.getElementById('cardExpiry').value = '';
    document.getElementById('cardCvv').value = '';
}

function selectPaymentMethod(method) {
    currentPaymentMethod = method;
    
    document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('selected'));
    event.target.closest('.payment-method').classList.add('selected');
    
    document.querySelectorAll('.payment-area').forEach(a => a.classList.add('hidden'));
    
    const areaMap = {
        'pix': 'pixArea',
        'money': 'moneyArea',
        'card': 'cardArea'
    };
    
    document.getElementById(areaMap[method]).classList.remove('hidden');
    
    if (method === 'card') {
        document.getElementById('confirmPaymentBtn').classList.add('hidden');
    } else {
        document.getElementById('confirmPaymentBtn').classList.remove('hidden');
    }
}

function copyPixCode() {
    const pixCode = document.querySelector('.pix-code').textContent;
    navigator.clipboard.writeText(pixCode).then(() => {
        showToast('Código PIX copiado!');
    });
}

function formatCardNumber(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 16) value = value.substring(0, 16);
    value = value.replace(/(\d{4})/g, '$1 ').trim();
    input.value = value;
}

function formatCardExpiry(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 4) value = value.substring(0, 4);
    if (value.length > 2) {
        value = value.substring(0, 2) + '/' + value.substring(2);
    }
    input.value = value;
}

function processCardPayment() {
    const cardName = document.getElementById('cardName').value;
    const cardNumber = document.getElementById('cardNumber').value;
    const cardExpiry = document.getElementById('cardExpiry').value;
    const cardCvv = document.getElementById('cardCvv').value;
    
    if (!cardName || !cardNumber || !cardExpiry || !cardCvv) {
        showToast('Preencha todos os dados do cartão');
        return;
    }
    
    if (cardNumber.replace(/\D/g, '').length < 16) {
        showToast('Número de cartão inválido');
        return;
    }
    
    showToast('Processando pagamento...');
    
    setTimeout(() => {
        confirmPayment();
    }, 1500);
}

function confirmPayment() {
    if (!currentFreightData) return;
    
    const paymentMethodText = {
        'pix': 'PIX',
        'money': 'Dinheiro',
        'card': 'Cartão de Crédito'
    };
    
    const completedFreight = {
        ...currentFreightData,
        paymentMethod: paymentMethodText[currentPaymentMethod],
        completedAt: new Date().toISOString(),
        status: 'completed'
    };
    
    const history = loadHistory();
    const index = history.findIndex(f => f.id === currentFreightData.id);
    if (index !== -1) {
        history[index] = { ...history[index], ...completedFreight, status: 'completed' };
        saveHistory(history);
    }
    
    // Atualizar request
    const allRequests = JSON.parse(localStorage.getItem('freteja_all_requests')) || [];
    const requestIndex = allRequests.findIndex(r => r.id === currentFreightData.id);
    if (requestIndex !== -1) {
        allRequests[requestIndex].status = 'completed';
        localStorage.setItem('freteja_all_requests', JSON.stringify(allRequests));
    }
    
    closePaymentModal();
    
    showToast(`Pagamento confirmado! Frete finalizado com sucesso.`);
    
    setTimeout(() => {
        openRatingModal(currentFreightData.id);
    }, 1500);
}

// ==================== FUNÇÕES DE AVALIAÇÃO ====================

let currentRatingFreightId = null;
let selectedRating = 0;

function openRatingModal(freightId) {
    currentRatingFreightId = freightId;
    selectedRating = 0;
    document.getElementById('ratingModal').style.display = 'flex';
    
    document.querySelectorAll('#ratingStars i').forEach(star => {
        star.classList.remove('active');
        star.classList.add('far');
    });
    document.getElementById('ratingComment').value = '';
}

function closeRatingModal() {
    document.getElementById('ratingModal').style.display = 'none';
    currentRatingFreightId = null;
}

function setupRatingStars() {
    const stars = document.querySelectorAll('#ratingStars i');
    stars.forEach(star => {
        star.addEventListener('click', function() {
            selectedRating = parseInt(this.dataset.rating);
            stars.forEach(s => {
                if (parseInt(s.dataset.rating) <= selectedRating) {
                    s.classList.add('active');
                    s.classList.remove('far');
                    s.classList.add('fas');
                } else {
                    s.classList.remove('active');
                    s.classList.remove('fas');
                    s.classList.add('far');
                }
            });
        });
    });
}

function submitRating() {
    if (selectedRating === 0) {
        showToast('Selecione uma nota para o motorista');
        return;
    }
    
    const comment = document.getElementById('ratingComment').value;
    
    const history = loadHistory();
    const index = history.findIndex(f => f.id === currentRatingFreightId);
    if (index !== -1 && history[index].driverName) {
        history[index].rating = selectedRating;
        history[index].comment = comment;
        saveHistory(history);
        
        // Salvar avaliação do motorista
        const driverRatings = JSON.parse(localStorage.getItem(`freteja_driver_ratings_${history[index].driverName}`)) || [];
        driverRatings.push({
            rating: selectedRating,
            comment: comment,
            freightId: currentRatingFreightId,
            clientName: JSON.parse(localStorage.getItem('freteja_current_user')).name,
            date: new Date().toISOString()
        });
        localStorage.setItem(`freteja_driver_ratings_${history[index].driverName}`, JSON.stringify(driverRatings));
        
        showToast('Avaliação enviada! Obrigado pelo feedback.');
    }
    
    closeRatingModal();
    renderHistoryList(currentHistoryFilter);
}

// ==================== FUNÇÕES DE CONFIGURAÇÕES ====================

function showSettings() {
    if (!isLoggedIn) {
        pendingAction = showSettings;
        showPage('loginPage');
        return;
    }
    
    const user = JSON.parse(localStorage.getItem('freteja_current_user'));
    const settings = JSON.parse(localStorage.getItem(`freteja_settings_${user.cpf}`)) || {};
    
    // Mostrar dados pessoais
    document.getElementById('personalDataInfo').innerHTML = `${user.name}<br><small>${user.cpf} | ${user.email} | ${user.phone}</small>`;
    
    document.getElementById('notificationsToggle').checked = settings.notifications !== false;
    document.getElementById('defaultPayment').value = settings.defaultPayment || 'pix';
    document.getElementById('preferredTruck').value = settings.preferredTruck || 'leve';
    
    document.getElementById('settingsModal').style.display = 'flex';
}

function closeSettingsModal() {
    const user = JSON.parse(localStorage.getItem('freteja_current_user'));
    if (user) {
        const settings = {
            notifications: document.getElementById('notificationsToggle').checked,
            defaultPayment: document.getElementById('defaultPayment').value,
            preferredTruck: document.getElementById('preferredTruck').value
        };
        localStorage.setItem(`freteja_settings_${user.cpf}`, JSON.stringify(settings));
        
        if (settings.preferredTruck !== selectedTruckType) {
            selectedTruckType = settings.preferredTruck;
            document.querySelectorAll('.type-btn').forEach(btn => {
                if (btn.dataset.truck === selectedTruckType) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            if (routeData.imediato.distance > 0) updatePriceSuggestion('imediato');
            if (routeData.orcamento.distance > 0) updatePriceSuggestion('orcamento');
        }
    }
    document.getElementById('settingsModal').style.display = 'none';
}

function editPersonalData() {
    const user = JSON.parse(localStorage.getItem('freteja_current_user'));
    if (user) {
        const newName = prompt('Digite seu novo nome:', user.name);
        if (newName && newName.trim()) {
            user.name = newName.trim();
            localStorage.setItem('freteja_current_user', JSON.stringify(user));
            
            const users = JSON.parse(localStorage.getItem('freteja_users')) || [];
            const userIndex = users.findIndex(u => u.cpf === user.cpf);
            if (userIndex !== -1) {
                users[userIndex].name = newName.trim();
                localStorage.setItem('freteja_users', JSON.stringify(users));
            }
            
            const newEmail = prompt('Digite seu novo e-mail:', user.email);
            if (newEmail && validateEmail(newEmail)) {
                user.email = newEmail;
                const users2 = JSON.parse(localStorage.getItem('freteja_users')) || [];
                const userIndex2 = users2.findIndex(u => u.cpf === user.cpf);
                if (userIndex2 !== -1) {
                    users2[userIndex2].email = newEmail;
                    localStorage.setItem('freteja_users', JSON.stringify(users2));
                }
                localStorage.setItem('freteja_current_user', JSON.stringify(user));
            }
            
            const newPhone = prompt('Digite seu novo telefone:', user.phone);
            if (newPhone && newPhone.replace(/\D/g, '').length >= 10) {
                user.phone = newPhone.replace(/\D/g, '');
                const users3 = JSON.parse(localStorage.getItem('freteja_users')) || [];
                const userIndex3 = users3.findIndex(u => u.cpf === user.cpf);
                if (userIndex3 !== -1) {
                    users3[userIndex3].phone = user.phone;
                    localStorage.setItem('freteja_users', JSON.stringify(users3));
                }
                localStorage.setItem('freteja_current_user', JSON.stringify(user));
            }
            
            document.getElementById('personalDataInfo').innerHTML = `${user.name}<br><small>${user.cpf} | ${user.email} | ${user.phone}</small>`;
            showToast('Dados atualizados com sucesso!');
        }
    }
}

function showPrivacyPolicy() {
    showToast('Política de privacidade em desenvolvimento');
}

function logout() {
    localStorage.removeItem('freteja_current_user');
    isLoggedIn = false;
    isDriverMode = false;
    isDriverOnline = false;
    if (window.freightInterval) {
        clearInterval(window.freightInterval);
        window.freightInterval = null;
    }
    showPage('loginPage');
    document.getElementById('appHeader').style.display = 'none';
    document.getElementById('appTabBar').style.display = 'none';
    document.querySelector('.mode-toggle').innerHTML = '<i class="fas fa-user"></i> Cliente';
    showToast('Você saiu da sua conta');
    closeSettingsModal();
}

// ==================== FUNÇÕES EXISTENTES ====================

function initMapsCallback() {
    console.log('Google Maps carregado com sucesso!');
    mapsLoaded = true;
    initMaps();
    setupAutocomplete();
}

function initMaps() {
    if (!mapsLoaded) return;
    
    const imediatoMapElement = document.getElementById('imediatoMap');
    if (imediatoMapElement && !imediatoMap) {
        imediatoMap = new google.maps.Map(imediatoMapElement, {
            center: { lat: -15.8231, lng: -48.1065 }, // Centro de Ceilândia
            zoom: 12,
            styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }]
        });
        imediatoDirectionsRenderer = new google.maps.DirectionsRenderer({
            map: imediatoMap,
            polylineOptions: { strokeColor: "#3498db", strokeWeight: 5 }
        });
    }
    
    const orcamentoMapElement = document.getElementById('orcamentoMap');
    if (orcamentoMapElement && !orcamentoMap) {
        orcamentoMap = new google.maps.Map(orcamentoMapElement, {
            center: { lat: -15.8231, lng: -48.1065 },
            zoom: 12,
            styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }]
        });
        orcamentoDirectionsRenderer = new google.maps.DirectionsRenderer({
            map: orcamentoMap,
            polylineOptions: { strokeColor: "#3498db", strokeWeight: 5 }
        });
    }
    
    setTimeout(() => {
        const imediatoOrigin = document.getElementById('imediatoOrigin')?.value;
        const imediatoDest = document.getElementById('imediatoDestination')?.value;
        if (imediatoOrigin && imediatoDest) calculateRoute('imediato');
        
        const orcamentoOrigin = document.getElementById('orcamentoOrigin')?.value;
        const orcamentoDest = document.getElementById('orcamentoDestination')?.value;
        if (orcamentoOrigin && orcamentoDest) calculateRoute('orcamento');
    }, 500);
}

function setupAutocomplete() {
    if (!mapsLoaded) return;
    
    const inputs = document.querySelectorAll('.origin-input, .destination-input');
    inputs.forEach(input => {
        try {
            const autocomplete = new google.maps.places.Autocomplete(input);
            autocomplete.setFields(['formatted_address', 'geometry']);
            autocomplete.addListener('place_changed', () => {
                const type = input.id.includes('imediato') ? 'imediato' : 'orcamento';
                const origin = document.getElementById(`${type}Origin`).value;
                const destination = document.getElementById(`${type}Destination`).value;
                if (origin && destination) calculateRoute(type);
            });
        } catch(e) {
            console.error('Erro no autocomplete:', e);
        }
    });
}

function calculateRoute(type) {
    if (!mapsLoaded) {
        showToast('Aguarde o carregamento do mapa...');
        return;
    }
    
    const originInput = document.getElementById(`${type}Origin`);
    const destinationInput = document.getElementById(`${type}Destination`);
    const origin = originInput.value;
    const destination = destinationInput.value;
    
    if (!origin || !destination) {
        showToast('Por favor, preencha origem e destino');
        return;
    }
    
    const routeInfo = document.getElementById(`${type}RouteInfo`);
    const distanceSpan = document.getElementById(`${type === 'imediato' ? 'distanceValue' : 'orcamentoDistanceValue'}`);
    const durationSpan = document.getElementById(`${type === 'imediato' ? 'durationValue' : 'orcamentoDurationValue'}`);
    const fuelSpan = document.getElementById(`${type === 'imediato' ? 'fuelCost' : 'orcamentoFuelCost'}`);
    
    if (routeInfo) {
        routeInfo.classList.remove('hidden');
        distanceSpan.textContent = 'Calculando...';
        durationSpan.textContent = 'Calculando...';
        fuelSpan.textContent = 'Calculando...';
    }
    
    const directionsService = new google.maps.DirectionsService();
    
    directionsService.route({
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING
    }, (result, status) => {
        if (status === 'OK') {
            const route = result.routes[0];
            const distanceInKm = route.legs[0].distance.value / 1000;
            const durationText = route.legs[0].duration.text;
            
            routeData[type] = {
                distance: distanceInKm,
                duration: durationText,
                durationText: durationText
            };
            
            distanceSpan.textContent = distanceInKm.toFixed(1);
            durationSpan.textContent = durationText;
            
            const fuelCost = calculateFuelCost(distanceInKm);
            fuelSpan.textContent = formatCurrency(fuelCost);
            
            updatePriceSuggestion(type);
            
            const directionsRenderer = type === 'imediato' ? imediatoDirectionsRenderer : orcamentoDirectionsRenderer;
            if (directionsRenderer) {
                directionsRenderer.setDirections(result);
                
                const bounds = new google.maps.LatLngBounds();
                route.legs[0].steps.forEach(step => {
                    bounds.extend(step.start_location);
                    bounds.extend(step.end_location);
                });
                
                const map = type === 'imediato' ? imediatoMap : orcamentoMap;
                if (map) map.fitBounds(bounds);
            }
            
            showToast(`Rota calculada: ${distanceInKm.toFixed(1)} km - ${durationText}`);
        } else {
            console.error('Erro ao calcular rota:', status);
            let errorMsg = 'Não foi possível calcular a rota. ';
            if (status === 'ZERO_RESULTS') errorMsg += 'Nenhuma rota encontrada.';
            else if (status === 'NOT_FOUND') errorMsg += 'Local não encontrado.';
            else errorMsg += 'Verifique os endereços.';
            showToast(errorMsg);
            distanceSpan.textContent = 'Erro';
            durationSpan.textContent = 'Erro';
            fuelSpan.textContent = 'Erro';
        }
    });
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function calculateFuelCost(distanceKm) {
    const consumption = selectedTruckType === 'leve' ? AVERAGE_CONSUMPTION_LEVE : AVERAGE_CONSUMPTION_PESADA;
    const litersNeeded = distanceKm / consumption;
    return litersNeeded * FUEL_PRICE_PER_LITER;
}

function calculateSuggestedPrice(distanceKm) {
    const pricePerKm = selectedTruckType === 'leve' ? PRICE_PER_KM_LEVE : PRICE_PER_KM_PESADA;
    const basePrice = distanceKm * pricePerKm;
    const fuelCost = calculateFuelCost(distanceKm);
    return Math.max(basePrice, fuelCost * 1.5);
}

function updatePriceSuggestion(type) {
    const distance = routeData[type].distance;
    if (distance > 0) {
        const suggestedPrice = calculateSuggestedPrice(distance);
        const suggestedPriceSpan = document.getElementById(`${type}SuggestedPrice`);
        if (suggestedPriceSpan) {
            suggestedPriceSpan.textContent = formatCurrency(suggestedPrice);
        }
    }
}

function handleLogin(e) {
    e.preventDefault();
    const cpf = document.getElementById('loginCpf').value.replace(/\D/g, '');
    const password = document.getElementById('loginPassword').value;
    
    document.getElementById('loginCpfError').style.display = 'none';
    document.getElementById('loginPasswordError').style.display = 'none';
    
    if (!validateCPF(cpf)) {
        document.getElementById('loginCpfError').style.display = 'block';
        return;
    }
    
    if (password.length < 6) {
        document.getElementById('loginPasswordError').style.display = 'block';
        return;
    }
    
    const users = JSON.parse(localStorage.getItem('freteja_users')) || [];
    const user = users.find(u => u.cpf === cpf && u.password === password);
    
    if (user) {
        loginUser(user);
        showToast('Login realizado com sucesso!');
        if (pendingAction) {
            setTimeout(() => { pendingAction(); pendingAction = null; }, 500);
        }
    } else {
        document.getElementById('loginPasswordError').textContent = 'CPF ou senha incorretos';
        document.getElementById('loginPasswordError').style.display = 'block';
    }
}

function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value.trim();
    const cpf = document.getElementById('registerCpf').value.replace(/\D/g, '');
    const email = document.getElementById('registerEmail').value.trim();
    const phone = document.getElementById('registerPhone').value.replace(/\D/g, '');
    const securityQuestion = document.getElementById('registerSecurityQuestion').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    
    let isValid = true;
    document.querySelectorAll('.error-message').forEach(el => el.style.display = 'none');
    
    if (name.length < 3) {
        document.getElementById('registerNameError').textContent = 'Nome deve ter pelo menos 3 caracteres';
        document.getElementById('registerNameError').style.display = 'block';
        isValid = false;
    }
    if (!validateCPF(cpf)) {
        document.getElementById('registerCpfError').style.display = 'block';
        isValid = false;
    }
    if (!validateEmail(email)) {
        document.getElementById('registerEmailError').style.display = 'block';
        isValid = false;
    }
    if (phone.length < 10 || phone.length > 11) {
        document.getElementById('registerPhoneError').style.display = 'block';
        isValid = false;
    }
    if (!securityQuestion) {
        document.getElementById('registerSecurityError').style.display = 'block';
        isValid = false;
    }
    if (password.length < 6) {
        document.getElementById('registerPasswordError').style.display = 'block';
        isValid = false;
    }
    if (password !== confirmPassword) {
        document.getElementById('registerConfirmPasswordError').style.display = 'block';
        isValid = false;
    }
    
    if (isValid) {
        const users = JSON.parse(localStorage.getItem('freteja_users')) || [];
        if (users.some(u => u.cpf === cpf)) {
            document.getElementById('registerCpfError').textContent = 'CPF já cadastrado';
            document.getElementById('registerCpfError').style.display = 'block';
            return;
        }
        if (users.some(u => u.email === email)) {
            document.getElementById('registerEmailError').textContent = 'E-mail já cadastrado';
            document.getElementById('registerEmailError').style.display = 'block';
            return;
        }
        
        const newUser = { name, cpf, email, phone, securityQuestion, password, createdAt: new Date().toISOString() };
        users.push(newUser);
        localStorage.setItem('freteja_users', JSON.stringify(users));
        
        loginUser(newUser);
        showToast('Conta criada com sucesso!');
        if (pendingAction) {
            setTimeout(() => { pendingAction(); pendingAction = null; }, 500);
        }
    }
}

function loginUser(user) {
    isLoggedIn = true;
    localStorage.setItem('freteja_current_user', JSON.stringify(user));
    document.getElementById('appHeader').style.display = 'flex';
    document.getElementById('appTabBar').style.display = 'flex';
    if (!pendingAction) showPage('homePage');
}

function checkLoginStatus() {
    const user = localStorage.getItem('freteja_current_user');
    if (user) loginUser(JSON.parse(user));
}

function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:white;padding:10px 20px;border-radius:5px;z-index:1000;font-size:14px;max-width:80%;text-align:center';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    
    if (pageId === 'homePage' || pageId === 'loginPage' || pageId === 'registerPage' || pageId === 'driverPanelPage' || pageId === 'forgotPasswordPage') {
        document.getElementById('backButton').style.display = 'none';
    } else {
        document.getElementById('backButton').style.display = 'flex';
        setTimeout(() => {
            if (pageId === 'imediatoPage' && imediatoMap) google.maps.event.trigger(imediatoMap, 'resize');
            if (pageId === 'orcamentoPage' && orcamentoMap) google.maps.event.trigger(orcamentoMap, 'resize');
        }, 200);
    }
}

function showMainPage() {
    if (isDriverMode) {
        loadDriverPanel();
        showPage('driverPanelPage');
    } else {
        showPage('homePage');
    }
}

function selectService(serviceType) {
    if (!isLoggedIn) {
        pendingAction = () => selectService(serviceType);
        showPage('loginPage');
        return;
    }
    
    selectedServiceType = serviceType;
    if (serviceType === 'imediato') {
        showPage('imediatoPage');
        setTimeout(() => {
            if (mapsLoaded) {
                const origin = document.getElementById('imediatoOrigin').value;
                const destination = document.getElementById('imediatoDestination').value;
                if (origin && destination) calculateRoute('imediato');
            }
        }, 500);
    } else {
        showPage('orcamentoPage');
        setTimeout(() => {
            if (mapsLoaded) {
                const origin = document.getElementById('orcamentoOrigin').value;
                const destination = document.getElementById('orcamentoDestination').value;
                if (origin && destination) calculateRoute('orcamento');
            }
        }, 500);
    }
}

document.getElementById('backButton').addEventListener('click', () => showMainPage());

function selectTruckType(type, element) {
    selectedTruckType = type;
    document.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');
    if (routeData.imediato.distance > 0) updatePriceSuggestion('imediato');
    if (routeData.orcamento.distance > 0) updatePriceSuggestion('orcamento');
}

function generateCalendar(month, year) {
    const calendarGrid = document.getElementById('calendarGrid');
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;
    calendarGrid.innerHTML = '';
    
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    days.forEach(day => {
        const el = document.createElement('div');
        el.classList.add('calendar-cell', 'day-header');
        el.textContent = day;
        calendarGrid.appendChild(el);
    });
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.classList.add('calendar-cell', 'empty');
        calendarGrid.appendChild(empty);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.classList.add('calendar-cell', 'day');
        dayCell.textContent = day;
        const cellDate = new Date(year, month, day);
        cellDate.setHours(0, 0, 0, 0);
        
        if (cellDate >= today) {
            dayCell.addEventListener('click', () => selectDay(dayCell, day, month, year));
        } else {
            dayCell.style.opacity = '0.5';
            dayCell.style.cursor = 'not-allowed';
        }
        calendarGrid.appendChild(dayCell);
    }
}

function selectDay(element, day, month, year) {
    document.querySelectorAll('.calendar-cell.selected').forEach(cell => cell.classList.remove('selected'));
    element.classList.add('selected');
    selectedDate = new Date(year, month, day);
}

function changeMonth(direction) {
    currentMonth += direction;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    generateCalendar(currentMonth, currentYear);
}

function setPrice(price) { document.getElementById('priceInput').value = price; }
function setPriceOrcamento(price) { document.getElementById('priceInputOrcamento').value = price; }

function validateCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
    let rem = (sum * 10) % 11;
    if (rem === 10 || rem === 11) rem = 0;
    if (rem !== parseInt(cpf.charAt(9))) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
    rem = (sum * 10) % 11;
    if (rem === 10 || rem === 11) rem = 0;
    return rem === parseInt(cpf.charAt(10));
}

function formatCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length > 11) cpf = cpf.substring(0, 11);
    if (cpf.length > 9) return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (cpf.length > 6) return cpf.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
    if (cpf.length > 3) return cpf.replace(/(\d{3})(\d+)/, '$1.$2');
    return cpf;
}

function formatPhone(phone) {
    phone = phone.replace(/\D/g, '');
    if (phone.length > 11) phone = phone.substring(0, 11);
    if (phone.length > 10) return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (phone.length > 6) return phone.replace(/(\d{2})(\d{4})(\d+)/, '($1) $2-$3');
    if (phone.length > 2) return phone.replace(/(\d{2})(\d+)/, '($1) $2');
    return phone;
}

function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

function checkPasswordStrength(password) {
    const indicator = document.getElementById('passwordStrength');
    if (!password.length) { indicator.textContent = ''; return; }
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    let text = strength < 2 ? 'Fraca' : strength < 4 ? 'Média' : 'Forte';
    let color = strength < 2 ? '#e74c3c' : strength < 4 ? '#f39c12' : '#2ecc71';
    indicator.textContent = `Força da senha: ${text}`;
    indicator.style.color = color;
}

function setupAuthEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('showRegister').addEventListener('click', () => showPage('registerPage'));
    document.getElementById('showLogin').addEventListener('click', () => showPage('loginPage'));
    document.getElementById('forgotPassword').addEventListener('click', () => showPage('forgotPasswordPage'));
    document.getElementById('backToLogin').addEventListener('click', () => showPage('loginPage'));
    document.getElementById('loginCpf').addEventListener('input', e => e.target.value = formatCPF(e.target.value));
    document.getElementById('registerCpf').addEventListener('input', e => e.target.value = formatCPF(e.target.value));
    document.getElementById('registerPhone').addEventListener('input', e => e.target.value = formatPhone(e.target.value));
    document.getElementById('registerPassword').addEventListener('input', e => checkPasswordStrength(e.target.value));
    
    const cardNumber = document.getElementById('cardNumber');
    const cardExpiry = document.getElementById('cardExpiry');
    if (cardNumber) cardNumber.addEventListener('input', () => formatCardNumber(cardNumber));
    if (cardExpiry) cardExpiry.addEventListener('input', () => formatCardExpiry(cardExpiry));
}

function proceedToPayment(freightId) {
    const history = loadHistory();
    const freight = history.find(f => f.id === freightId);
    if (freight) {
        openPaymentModal(freight);
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    generateCalendar(currentMonth, currentYear);
    setupAuthEventListeners();
    checkLoginStatus();
    setupRatingStars();
    
    const cardNumber = document.getElementById('cardNumber');
    const cardExpiry = document.getElementById('cardExpiry');
    if (cardNumber) cardNumber.addEventListener('input', () => formatCardNumber(cardNumber));
    if (cardExpiry) cardExpiry.addEventListener('input', () => formatCardExpiry(cardExpiry));
});