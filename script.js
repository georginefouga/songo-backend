let socket = null;
let myRole = null; // 'sud' ou 'nord'
let serverGameState = { board: Array(14).fill(5), scoreSud: 0, scoreNord: 0, currentTurn: 'sud' };
let isAnimating = false; // Bloque les clics pendant le semis visuel cadencé
let gameActive = false; // S'active quand 2 joueurs sont dans le salon

// URL DE TON SERVEUR RENDER
const SERVER_URL = 'wss://songo-server.onrender.com';

// ÉLÉMENTS DU DOM RECUEILLIS DE LA VERSION LOCALE & RÉSEAU
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

// INITIALISATION ET CONNEXION AU SERVEUR CLOUD
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
                lobbyContainer.style.display = 'none'; // Ferme l'accueil visuel
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
                moveLog.innerHTML = `<div class="log-entry system-log">Vous avez rejoint le salon. C'est au Joueur Sud de commencer.</div>`;
                updateUI();
                break;

            case 'opponent_joined':
                gameActive = true; 
                moveLog.innerHTML += `<div class="log-entry system-log">Un adversaire s'est connecté ! La partie commence.</div>`;
                statusMessage.textContent = "Votre adversaire est arrivé ! À vous de jouer.";
                updateUI();
                break;

            case 'update_game':
                // Reçu lors d'un coup validé par l'autre joueur en face
                serverGameState = msg.gameState;
                updateUI();
                break;

            case 'opponent_left':
                gameActive = false;
                statusMessage.textContent = "L'adversaire a quitté la partie.";
                alert(msg.message);
                break;

            case 'error':
                alert(msg.message);
                break;
        }
    };

    socket.onclose = () => {
        statusMessage.textContent = "Connexion défaillante. Tentative de reconnexion...";
        statusMessage.style.color = "#dc3545";
        roomCodeInput.disabled = true;
        btnCreate.disabled = true;
        btnConnect.disabled = true;
        setTimeout(connectToServer, 3000);
    };
}

// GESTION DES CLICS SUR LES BOUTONS DU REPERTOIRE LOBBY
btnCreate.addEventListener('click', () => {
    const roomCode = roomCodeInput.value.trim();
    if (!roomCode) return alert("Veuillez donner un nom au salon à créer.");
    socket.send(JSON.stringify({ type: 'create_room', roomCode: roomCode }));
});

btnConnect.addEventListener('click', () => {
    const roomCode = roomCodeInput.value.trim();
    if (!roomCode) return alert("Veuillez inscrire le nom du salon à rejoindre.");
    socket.send(JSON.stringify({ type: 'join_room', roomCode: roomCode }));
});

// SYNC VISUELLE AVEC L'ÉPARPILLAGE EN SPIRALE IMPARFAITE DE TA VERSION LOCALE
function updateUI() {
    pits.forEach(pit => {
        const index = parseInt(pit.getAttribute('data-index'));
        const seedCount = serverGameState.board[index];
        
        // Nettoyage des anciennes billes graphiques
        const oldSeeds = pit.querySelectorAll('.seed');
        oldSeeds.forEach(s => s.remove());

        // Génération géométrique des graines (.seed) comme en local
        for (let i = 0; i < seedCount; i++) {
            const seedDiv = document.createElement('div');
            seedDiv.className = 'seed';
            
            const angle = (i * (360 / Math.max(seedCount, 6))) * (Math.PI / 180);
            const radius = Math.min(i * 2.2 + 11, 25); 
            
            const leftPos = Math.round(35 + Math.cos(angle) * radius);
            const topPos = Math.round(30 + Math.sin(angle) * radius);
            const randomRotation = (i * 45) % 360;

            seedDiv.style.left = `${leftPos}px`;
            seedDiv.style.top = `${topPos}px`;
            seedDiv.style.transform = `rotate(${randomRotation}deg)`;

            pit.appendChild(seedDiv);
        }
    });

    // Mise à jour textuelle des scores
    scoreSudEl.textContent = serverGameState.scoreSud;
    scoreNordEl.textContent = serverGameState.scoreNord;

    // Ajustement de la bannière de tour
    if (!gameActive) {
        turnIndicator.textContent = "En attente du 2ème joueur...";
        turnIndicator.style.background = "#7f8c8d";
    } else if (serverGameState.currentTurn === myRole) {
        turnIndicator.textContent = "À vous de jouer !";
        turnIndicator.style.background = (myRole === 'sud') ? "#5c3a21" : "#8b2514";
    } else {
        turnIndicator.textContent = "Tour de l'adversaire...";
        turnIndicator.style.background = "#333333";
    }

    checkGameEnd();
}

// CAPTURE ET RÈGLES DE VALIDATION DES PUITS
pits.forEach(pit => {
    pit.addEventListener('click', (e) => {
        if (!gameActive || isAnimating) return;

        const index = parseInt(e.currentTarget.getAttribute('data-index'));

        // Validation stricte du tour de rôle en ligne
        if (serverGameState.currentTurn !== myRole) {
            statusMessage.textContent = "Ce n'est pas votre tour de jouer !";
            return;
        }

        // Restriction territoriale Ekang (Sud : 7 à 13 | Nord : 0 à 6)
        if (myRole === 'sud' && (index < 7 || index > 13)) return;
        if (myRole === 'nord' && (index < 0 || index > 6)) return;

        if (serverGameState.board[index] === 0) {
            statusMessage.textContent = "Ce puits ne contient aucune graine !";
            return;
        }

        // Lancement de l'animation partagée
        executeMoveAnimated(index);
    });
});

// SEMIS PAS-A-PAS VISUEL CADENCÉ À 400MS (REPRIS DE TON CODE SOURCE)
function executeMoveAnimated(startIndex) {
    isAnimating = true;

    let seedsInHand = serverGameState.board[startIndex];
    serverGameState.board[startIndex] = 0; 
    updateUI();

    let currentIndex = startIndex;
    statusMessage.textContent = `Semis en cours... (${seedsInHand} graines en main)`;

    const distributionInterval = setInterval(() => {
        if (seedsInHand > 0) {
            currentIndex = (currentIndex + 1) % 14;
            
            // Règle du Grand Tour : sauter la case de départ
            if (currentIndex === startIndex) return; 

            serverGameState.board[currentIndex]++;
            seedsInHand--;
            
            // Surbrillance au passage de la graine
            const activePit = document.querySelector(`.pit[data-index='${currentIndex}']`);
            if (activePit) {
                activePit.classList.add('active-semis');
                setTimeout(() => activePit.classList.remove('active-semis'), 250);
            }

            updateUI();
        } else {
            clearInterval(distributionInterval);
            // Traitement immédiat des récoltes à la fin du semis
            executeCaptures(currentIndex);
        }
    }, 400); 
}

// RÉCOLTE ET TRANSMISSION INTERNATIONALE AU SERVEUR CLOUD
function executeCaptures(finalIndex) {
    let capturedSeedsTotal = 0;
    let checkIdx = finalIndex;
    
    // Vérification : on ne peut capturer que dans le camp adverse !
    while (
        (myRole === 'sud' && checkIdx >= 0 && checkIdx <= 6) || 
        (myRole === 'nord' && checkIdx >= 7 && checkIdx <= 13)
    ) {
        let seedsInPit = serverGameState.board[checkIdx];
        
        // Prise valide si le total est égal à 2, 3 ou 4 graines (Règlement Ekang local)
        if (seedsInPit === 2 || seedsInPit === 3 || seedsInPit === 4) {
            capturedSeedsTotal += seedsInPit;
            serverGameState.board[checkIdx] = 0;
            checkIdx = (checkIdx - 1 + 14) % 14; // Recul vers la gauche pour la récolte en chaîne
        } else {
            break; 
        }
    }

    if (myRole === 'sud') {
        serverGameState.scoreSud += capturedSeedsTotal;
    } else {
        serverGameState.scoreNord += capturedSeedsTotal;
    }

    logMove(myRole, finalIndex, capturedSeedsTotal);
    
    // Changement de tour alternatif
    serverGameState.currentTurn = (myRole === 'sud') ? 'nord' : 'sud';
    isAnimating = false;
    updateUI();

    // ENVOI IMMÉDIAT DE L'ÉTAT DU JEU MIS À JOUR À TON SERVEUR RENDER
    socket.send(JSON.stringify({
        type: 'make_move',
        gameState: serverGameState
    }));
}

// ALIMENTATION DE L'HISTORIQUE DES COUPS (LOGS)
function logMove(player, to, captured) {
    const caseTo = (to < 7) ? `S${to + 1}` : `N${to - 6}`;
    const pLabel = (player === 'sud') ? 'Sud' : 'Nord';
    const cssClass = (player === 'sud') ? 'sud-move' : 'nord-move';
    let captureText = captured > 0 ? ` (Récolte de ${captured} graines 🌾)` : ' (Pas de capture)';

    const entry = document.createElement('div');
    entry.className = `log-entry ${cssClass}`;
    entry.textContent = `Joueur ${pLabel} : Termine en ${caseTo}${captureText}`;
    
    moveLog.appendChild(entry);
    moveLog.scrollTop = moveLog.scrollHeight;
    statusMessage.textContent = `C'est au tour du joueur adverse.`;
}

// VÉRIFICATION DES CRITÈRES DE FIN DE PARTIE (40 GRAINES)
function checkGameEnd() {
    if (serverGameState.scoreSud >= 40) {
        statusMessage.innerHTML = "<span style='color:#8ce68c'>VICTOIRE DU JOUEUR SUD ! 🏆</span>";
        gameActive = false;
    } else if (serverGameState.scoreNord >= 40) {
        statusMessage.innerHTML = "<span style='color:#ff9e9e'>VICTOIRE DU JOUEUR NORD ! 🏆</span>";
        gameActive = false;
    }
}