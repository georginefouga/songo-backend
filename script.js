let socket = null;
let myRole = null; // 'sud' ou 'nord'
let serverGameState = { board: Array(14).fill(5), scoreSud: 0, scoreNord: 0, currentTurn: 'sud' };
let isAnimating = false;
let gameActive = false; // Bloque le jeu tant qu'on est pas deux

// LIAISON AVEC L'ADRESSE RENDER DU SERVEUR
const SERVER_URL = 'wss://songo-server.onrender.com';

// RÉCUPÉRATION DES ÉLÉMENTS DE L'INTERFACE
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

// INITIALISATION DE LA CONNEXION CLOUD DIRECTE
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
                lobbyContainer.style.display = 'none'; // Ferme l'accueil
                roleBadge.textContent = `Mon Rôle : JOUEUR ${myRole.toUpperCase()}`;
                moveLog.textContent = `Salon "${roomCodeInput.value.trim()}" créé. En attente de l'adversaire...`;
                updateUI();
                break;

            case 'room_joined':
                myRole = msg.role;
                serverGameState = msg.gameState;
                gameActive = true; // Deuxième joueur connecté, le jeu s'active
                lobbyContainer.style.display = 'none'; // Ferme l'accueil
                roleBadge.textContent = `Mon Rôle : JOUEUR ${myRole.toUpperCase()}`;
                moveLog.textContent = "Vous avez rejoint la partie. C'est au Joueur Sud de commencer !";
                updateUI();
                break;

            case 'opponent_joined':
                gameActive = true; // L'adversaire est arrivé, on débloque
                moveLog.textContent = "Votre adversaire est connecté ! À vous de jouer (Sud).";
                alert("Un adversaire a rejoint la partie !");
                updateUI();
                break;

            case 'update_game':
                serverGameState = msg.gameState;
                updateUI();
                break;

            case 'opponent_left':
                gameActive = false;
                moveLog.textContent = msg.message;
                alert(msg.message);
                break;

            case 'error':
                alert(msg.message);
                break;
        }
    };

    socket.onclose = () => {
        statusMessage.textContent = "Connexion perdue avec le serveur. Reconnexion...";
        statusMessage.style.color = "#dc3545";
        roomCodeInput.disabled = true;
        btnCreate.disabled = true;
        btnConnect.disabled = true;
        setTimeout(connectToServer, 3000); // Tente de se reconnecter après 3 secondes
    };
}

// BOUTON : CRÉER UN SALON
btnCreate.addEventListener('click', () => {
    const roomCode = roomCodeInput.value.trim();
    if (!roomCode) return alert("Veuillez donner un nom au salon à créer.");
    socket.send(JSON.stringify({ type: 'create_room', roomCode: roomCode }));
});

// BOUTON : REJOINDRE UN SALON
btnConnect.addEventListener('click', () => {
    const roomCode = roomCodeInput.value.trim();
    if (!roomCode) return alert("Veuillez inscrire le nom du salon à rejoindre.");
    socket.send(JSON.stringify({ type: 'join_room', roomCode: roomCode }));
});

// CLIC SUR LES CASES DU PLATEAU
pits.forEach(pit => {
    pit.addEventListener('click', (e) => {
        if (!gameActive || isAnimating) return;

        const clickedIndex = parseInt(e.target.getAttribute('data-index'));

        // Vérification du tour
        if (serverGameState.currentTurn !== myRole) {
            return alert("Ce n'est pas votre tour de jouer !");
        }

        // Vérification des zones d'autorisation (Sud = cases 7-13, Nord = cases 0-6)
        if (myRole === 'sud' && (clickedIndex < 7 || clickedIndex > 13)) return alert("Vous devez jouer dans votre rangée (Sud) !");
        if (myRole === 'nord' && (clickedIndex < 0 || clickedIndex > 6)) return alert("Vous devez jouer dans votre rangée (Nord) !");

        if (serverGameState.board[clickedIndex] === 0) return alert("Cette case est vide !");

        // Execution locale de la distribution des graines (simulation simplifiée pour l'exemple)
        executeMove(clickedIndex);
    });
});

// FONCTION EXÉCUTION DU COUP ET ENVOI AU CLOUD
function executeMove(index) {
    let seeds = serverGameState.board[index];
    serverGameState.board[index] = 0;
    let currentIdx = index;

    // Distribution simple dans le sens anti-horaire
    while (seeds > 0) {
        currentIdx = (currentIdx + 1) % 14;
        serverGameState.board[currentIdx]++;
        seeds--;
    }

    // Changement de tour alternatif
    serverGameState.currentTurn = (myRole === 'sud') ? 'nord' : 'sud';
    moveLog.textContent = `Dernier coup : Joueur ${myRole.toUpperCase()} a distribué depuis la case ${index}.`;

    // Envoi immédiat du nouvel état au serveur Render pour synchronisation
    socket.send(JSON.stringify({
        type: 'make_move',
        gameState: serverGameState
    }));
}

// METTRE À JOUR L'AFFICHAGE DU PLATEAU ET DES SCORES
function updateUI() {
    // Synchronisation graphique des fosses
    pits.forEach(pit => {
        const idx = parseInt(pit.getAttribute('data-index'));
        pit.textContent = serverGameState.board[idx];
    });

    // Synchronisation des scores globaux
    scoreSudEl.textContent = serverGameState.scoreSud;
    scoreNordEl.textContent = serverGameState.scoreNord;

    // Indicateur visuel du tour
    if (!gameActive) {
        turnIndicator.textContent = "En attente du 2ème joueur...";
        turnIndicator.style.color = "#ffc107";
    } else if (serverGameState.currentTurn === myRole) {
        turnIndicator.textContent = "À vous de jouer !";
        turnIndicator.style.color = "#28a745";
    } else {
        turnIndicator.textContent = "Tour de l'adversaire...";
        turnIndicator.style.color = "#ffffff";
    }
}