let socket = null;
let myRole = null; 
let serverGameState = { board: Array(14).fill(5), scoreSud: 0, scoreNord: 0, currentTurn: 'sud' };
let isAnimating = false; 
let gameActive = false; 

const SERVER_URL = 'wss://songo-server.onrender.com';

const pits = document.querySelectorAll('.pit');
const turnIndicator = document.getElementById('turn-indicator');
const scoreSudEl = document.getElementById('score-sud');
const scoreNordEl = document.getElementById('score-nord');
const statusMessage = document.getElementById('status-message');
const moveLog = document.getElementById('move-log');
const roleBadge = document.getElementById('role-badge');
const lobbyContainer = document.getElementById('lobby-container');
const roomCodeInput = document.getElementById('room-code');
const btnCreate = document.getElementById('btn-create');
const btnConnect = document.getElementById('btn-connect');

connectToServer();

function connectToServer() {
    socket = new WebSocket(SERVER_URL);

    socket.onopen = () => {
        statusMessage.textContent = "Connecté au Cloud ! Entrez un nom de salon.";
        statusMessage.style.color = "#28a745";
        roomCodeInput.disabled = false;
        btnCreate.disabled = false;
        btnConnect.disabled = false;
    };

    socket.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
            case 'room_created':
                myRole = msg.role;
                serverGameState = msg.gameState;
                lobbyContainer.style.display = 'none'; 
                roleBadge.textContent = `Mon Rôle : JOUEUR ${myRole.toUpperCase()}`;
                moveLog.innerHTML = `<div class="log-entry system-log">Salon "${roomCodeInput.value.trim()}" créé. En attente d'un adversaire...</div>`;
                updateUI();
                break;

            case 'room_joined':
                myRole = msg.role;
                serverGameState = msg.gameState;
                gameActive = true; 
                lobbyContainer.style.display = 'none';
                roleBadge.textContent = `Mon Rôle : JOUEUR ${myRole.toUpperCase()}`;
                moveLog.innerHTML = `<div class="log-entry system-log">Salon rejoint. Le Joueur Sud commence !</div>`;
                updateUI();
                break;

            case 'opponent_joined':
                gameActive = true; 
                moveLog.innerHTML += `<div class="log-entry system-log">L'adversaire est connecté. La partie commence !</div>`;
                updateUI();
                break;

            case 'update_game':
                // Synchronisation stricte envoyée par le serveur
                serverGameState = msg.gameState;
                updateUI();
                
                // Si un log de mouvement est attaché, on l'ajoute à l'historique visuel
                if (msg.logInfo) {
                    appendLogEntry(msg.logInfo.text, msg.logInfo.cssClass);
                }
                break;

            case 'opponent_left':
                gameActive = false;
                alert(msg.message);
                break;

            case 'error':
                alert(msg.message);
                break;
        }
    };
}

btnCreate.addEventListener('click', () => {
    const roomCode = roomCodeInput.value.trim();
    if (!roomCode) return alert("Entrez un nom de salon.");
    socket.send(JSON.stringify({ type: 'create_room', roomCode: roomCode }));
});

btnConnect.addEventListener('click', () => {
    const roomCode = roomCodeInput.value.trim();
    if (!roomCode) return alert("Entrez un nom de salon.");
    socket.send(JSON.stringify({ type: 'join_room', roomCode: roomCode }));
});

function updateUI() {
    pits.forEach(pit => {
        const index = parseInt(pit.getAttribute('data-index'));
        const seedCount = serverGameState.board[index];
        
        const oldSeeds = pit.querySelectorAll('.seed');
        oldSeeds.forEach(s => s.remove());

        for (let i = 0; i < seedCount; i++) {
            const seedDiv = document.createElement('div');
            seedDiv.className = 'seed';
            
            const angle = (i * (360 / Math.max(seedCount, 6))) * (Math.PI / 180);
            const radius = Math.min(i * 2.2 + 11, 25); 
            
            const leftPos = Math.round(32 + Math.cos(angle) * radius);
            const topPos = Math.round(28 + Math.sin(angle) * radius);
            const randomRotation = (i * 45) % 360;