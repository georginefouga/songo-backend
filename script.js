let socket = null;
let myRole = null; 
let serverGameState = { board: Array(14).fill(5), scoreSud: 0, scoreNord: 0, currentTurn: 'sud' };
let isAnimating = false;

const pits = document.querySelectorAll('.pit');
const turnIndicator = document.getElementById('turn-indicator');
const scoreSudEl = document.getElementById('score-sud');
const scoreNordEl = document.getElementById('score-nord');
const statusMessage = document.getElementById('status-message');
const moveLog = document.getElementById('move-log');
const roleBadge = document.getElementById('role-badge');
const btnConnect = document.getElementById('btn-connect');
const roomCodeInput = document.getElementById('room-code');

btnConnect.addEventListener('click', () => {
    const roomCode = roomCodeInput.value.trim();
    if (!roomCode) return alert("Veuillez entrer un nom de salon.");

    // METS TON URL DE RENDER ICI (conserve bien le wss:// au début !)
    socket = new WebSocket('wss://L_URL_DE_TON_SERVEUR_RENDER.onrender.com');

    socket.onopen = () => {
        logSystem(`Connexion au Cloud... Rejoindre le salon [${roomCode}]`);
        socket.send(JSON.stringify({ type: 'join_room', roomCode: roomCode }));
    };

    socket.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
            case 'room_joined':
                myRole = msg.role;
                serverGameState = msg.gameState;
                roleBadge.textContent = `Mon Rôle : JOUEUR ${myRole.toUpperCase()}`;
                roleBadge.style.background = myRole === 'sud' ? '#2e7d32' : '#c62828';
                statusMessage.textContent = "En attente de votre adversaire...";
                updateVisualBoardOnly();
                break;

            case 'game_start':
                serverGameState = msg.gameState;
                statusMessage.textContent = "Adversaire connecté. Que le meilleur gagne !";
                updateUI();
                break;

            case 'move_executed':
                executeMoveAnimated(msg.startIndex, msg.player, msg.gameState);
                break;

            case 'opponent_disconnected':
                statusMessage.textContent = "L'adversaire a quitté. Partie interrompue.";
                logSystem("Système : Déconnexion de l'autre joueur.");
                myRole = null;
                break;

            case 'error':
                alert(msg.message);
                break;
        }
    };

    socket.onclose = () => {
        logSystem("Serveur déconnecté.");
        statusMessage.textContent = "Connexion réseau perdue.";
    };
});

function updateVisualBoardOnly() {
    pits.forEach(pit => {
        const index = parseInt(pit.getAttribute('data-index'));
        const seedCount = serverGameState.board[index];
        pit.querySelectorAll('.seed').forEach(s => s.remove());

        for (let i = 0; i < seedCount; i++) {
            const seedDiv = document.createElement('div');
            seedDiv.className = 'seed';
            const angle = (i * (360 / Math.max(seedCount, 6))) * (Math.PI / 180);
            const radius = Math.min(i * 2.2 + 11, 25);
            seedDiv.style.left = `${Math.round(35 + Math.cos(angle) * radius)}px`;
            seedDiv.style.top = `${Math.round(30 + Math.sin(angle) * radius)}px`;
            seedDiv.style.transform = `rotate(${(i * 45) % 360}deg)`;
            pit.appendChild(seedDiv);
        }
    });
}

function updateUI() {
    updateVisualBoardOnly();
    scoreSudEl.textContent = serverGameState.scoreSud;
    scoreNordEl.textContent = serverGameState.scoreNord;

    if (serverGameState.currentTurn === myRole) {
        turnIndicator.textContent = "C'EST À TOI DE JOUER !";
        turnIndicator.style.background = "#d4af37";
        turnIndicator.style.color = "#000";
    } else {
        turnIndicator.textContent = `Tour : Joueur ${serverGameState.currentTurn.toUpperCase()}`;
        turnIndicator.style.background = "#333";
        turnIndicator.style.color = "#fff";
    }
}

pits.forEach(pit => {
    pit.addEventListener('click', (e) => {
        if (isAnimating || !socket || !myRole) return;
        if (serverGameState.currentTurn !== myRole) {
            statusMessage.textContent = "Patientez, ce n'est pas votre tour.";
            return;
        }

        const index = parseInt(e.currentTarget.getAttribute('data-index'));
        if (myRole === 'sud' && (index < 0 || index > 6)) return;
        if (myRole === 'nord' && (index < 7 || index > 13)) return;

        if (serverGameState.board[index] === 0) return;

        socket.send(JSON.stringify({ type: 'play_move', index: index }));
    });
});

function executeMoveAnimated(startIndex, movingPlayer, finalStateFromServer) {
    isAnimating = true;
    let seedsInHand = serverGameState.board[startIndex];
    serverGameState.board[startIndex] = 0;
    updateVisualBoardOnly();

    let currentIndex = startIndex;
    statusMessage.textContent = `Semis du Joueur ${movingPlayer.toUpperCase()}...`;

    const distributionInterval = setInterval(() => {
        if (seedsInHand > 0) {
            currentIndex = (currentIndex + 1) % 14;
            if (currentIndex === startIndex) return; 

            serverGameState.board[currentIndex]++;
            seedsInHand--;

            const activePit = document.querySelector(`.pit[data-index='${currentIndex}']`);
            activePit.classList.add('active-semis');
            setTimeout(() => activePit.classList.remove('active-semis'), 200);

            updateVisualBoardOnly();
        } else {
            clearInterval(distributionInterval);
            
            serverGameState = finalStateFromServer;
            logMove(movingPlayer, currentIndex);
            
            isAnimating = false;
            updateUI();
        }
    }, 350); 
}

function logMove(player, finalIndex) {
    const caseLabel = (finalIndex < 7) ? `S${finalIndex + 1}` : `N${finalIndex - 6}`;
    const entry = document.createElement('div');
    entry.className = `log-entry ${player}-move`;
    entry.textContent = `[Action] Joueur ${player.toUpperCase()} sème jusqu'en ${caseLabel}`;
    moveLog.appendChild(entry);
    moveLog.scrollTop = moveLog.scrollHeight;
}

function logSystem(text) {
    const entry = document.createElement('div');
    entry.className = "log-entry system-log";
    entry.textContent = text;
    moveLog.appendChild(entry);
}

document.getElementById('btn-restart').addEventListener('click', () => {
    if(socket) socket.close();
    roleBadge.textContent = "Mode Spectateur";
    roleBadge.style.background = "#333";
    turnIndicator.textContent = "En attente de connexion...";
    statusMessage.textContent = "Veuillez vous connecter à un salon réseau pour jouer.";
    moveLog.innerHTML = '<div class="log-entry system-log">Hors ligne.</div>';
    serverGameState.board = Array(14).fill(5);
    serverGameState.scoreSud = 0;
    serverGameState.scoreNord = 0;
    updateVisualBoardOnly();
});