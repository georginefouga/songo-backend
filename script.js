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
                moveLog.innerHTML = `<div class="log-entry">Salon "${roomCodeInput.value.trim()}" créé. En attente d'un adversaire...</div>`;
                updateUI();
                break;

            case 'room_joined':
                myRole = msg.role;
                serverGameState = msg.gameState;
                gameActive = true; 
                lobbyContainer.style.display = 'none';
                roleBadge.textContent = `Mon Rôle : JOUEUR ${myRole.toUpperCase()}`;
                moveLog.innerHTML = `<div class="log-entry">Salon rejoint. Le Joueur Sud commence !</div>`;
                updateUI();
                break;

            case 'opponent_joined':
                gameActive = true; 
                moveLog.innerHTML += `<div class="log-entry">L'adversaire est connecté. Jouez !</div>`;
                updateUI();
                break;

            case 'update_game':
                serverGameState = msg.gameState;
                updateUI();
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

// ÉPARPILLAGE GRAPHIQUE DES GRAINES (SPIRALE LOCALE)
function updateUI() {
    pits.forEach(pit => {
        const index = parseInt(pit.getAttribute('data-index'));
        const seedCount = serverGameState.board[index];
        
        // Retirer les résidus de graines
        const oldSeeds = pit.querySelectorAll('.seed');
        oldSeeds.forEach(s => s.remove());

        // Génération géométrique tridimensionnelle des graines
        for (let i = 0; i < seedCount; i++) {
            const seedDiv = document.createElement('div');
            seedDiv.className = 'seed';
            
            const angle = (i * (360 / Math.max(seedCount, 6))) * (Math.PI / 180);
            const radius = Math.min(i * 2.2 + 11, 25); 
            
            const leftPos = Math.round(32 + Math.cos(angle) * radius);
            const topPos = Math.round(28 + Math.sin(angle) * radius);
            const randomRotation = (i * 45) % 360;

            seedDiv.style.left = `${leftPos}px`;
            seedDiv.style.top = `${topPos}px`;
            seedDiv.style.transform = `rotate(${randomRotation}deg)`;

            pit.appendChild(seedDiv);
        }
    });

    scoreSudEl.textContent = serverGameState.scoreSud;
    scoreNordEl.textContent = serverGameState.scoreNord;

    if (!gameActive) {
        turnIndicator.textContent = "En attente du second joueur...";
        turnIndicator.style.background = "#7f8c8d";
    } else if (serverGameState.currentTurn === myRole) {
        turnIndicator.textContent = "À vous de jouer !";
        turnIndicator.style.background = (myRole === 'sud') ? "#5c3a21" : "#8b2514";
    } else {
        turnIndicator.textContent = "Tour de l'adversaire...";
        turnIndicator.style.background = "#333333";
    }
}

// CAPTURE DU CLIC ET VÉRIFICATION DES LOGS SIMILAIRES À TON CODE LOCAL
pits.forEach(pit => {
    pit.addEventListener('click', (e) => {
        if (!gameActive || isAnimating) return;

        const index = parseInt(e.currentTarget.getAttribute('data-index'));

        if (serverGameState.currentTurn !== myRole) {
            alert("Ce n'est pas votre tour !");
            return;
        }

        // REMISE EN PLACE DE TES INDICES LOCAUX D'ORIGINE (Sud = 0-6 | Nord = 7-13)
        if (myRole === 'sud' && (index < 0 || index > 6)) return;
        if (myRole === 'nord' && (index < 7 || index > 13)) return;

        if (serverGameState.board[index] === 0) return;

        executeMoveAnimated(index);
    });
});

function executeMoveAnimated(startIndex) {
    isAnimating = true;

    let seedsInHand = serverGameState.board[startIndex];
    serverGameState.board[startIndex] = 0; 
    updateUI();

    let currentIndex = startIndex;

    const distributionInterval = setInterval(() => {
        if (seedsInHand > 0) {
            currentIndex = (currentIndex + 1) % 14;
            
            if (currentIndex === startIndex) return; // Grand Tour

            serverGameState.board[currentIndex]++;
            seedsInHand--;
            
            const activePit = document.querySelector(`.pit[data-index='${currentIndex}']`);
            if (activePit) {
                activePit.classList.add('active-semis');
                setTimeout(() => activePit.classList.remove('active-semis'), 250);
            }

            updateUI();
        } else {
            clearInterval(distributionInterval);
            executeCaptures(currentIndex);
        }
    }, 400); 
}

function executeCaptures(finalIndex) {
    let capturedSeedsTotal = 0;
    let checkIdx = finalIndex;
    
    // Prise dans le camp adverse
    while (
        (myRole === 'sud' && checkIdx >= 7 && checkIdx <= 13) || 
        (myRole === 'nord' && checkIdx >= 0 && checkIdx <= 6)
    ) {
        let seedsInPit = serverGameState.board[checkIdx];
        
        if (seedsInPit === 2 || seedsInPit === 3 || seedsInPit === 4) {
            capturedSeedsTotal += seedsInPit;
            serverGameState.board[checkIdx] = 0;
            checkIdx = (checkIdx - 1 + 14) % 14; 
        } else {
            break; 
        }
    }

    if (myRole === 'sud') {
        serverGameState.scoreSud += capturedSeedsTotal;
    } else {
        serverGameState.scoreNord += capturedSeedsTotal;
    }

    serverGameState.currentTurn = (myRole === 'sud') ? 'nord' : 'sud';
    isAnimating = false;
    updateUI();

    socket.send(JSON.stringify({
        type: 'make_move',
        gameState: serverGameState
    }));
}