let socket = null;
let myRole = null; // 'sud' ou 'nord'
let serverGameState = { board: Array(14).fill(5), scoreSud: 0, scoreNord: 0, currentTurn: 'sud' };
let isAnimating = false;
let gameActive = false; // Bloque le jeu tant qu'un second joueur n'est pas connecté

// LIAISON AVEC TON SERVEUR RENDER
const SERVER_URL = 'wss://songo-server.onrender.com';

// RÉCUPÉRATION DES ÉLÉMENTS DU CODE LOCAL
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

// CONNEXION AUTOMATIQUE AU CLOUD
connectToServer();

function connectToServer() {
    socket = new WebSocket(https://songo-server.onrender.com);

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
                lobbyContainer.style.display = 'none'; // Affiche le plateau
                roleBadge.textContent = `Mon Rôle : JOUEUR ${myRole.toUpperCase()}`;
                moveLog.textContent = `Salon "${roomCodeInput.value.trim()}" créé. En attente de votre adversaire...`;
                updateUI();
                break;

            case 'room_joined':
                myRole = msg.role;
                serverGameState = msg.gameState;
                gameActive = true; 
                lobbyContainer.style.display = 'none'; // Affiche le plateau
                roleBadge.textContent = `Mon Rôle : JOUEUR ${myRole.toUpperCase()}`;
                moveLog.textContent = "Vous avez rejoint la partie. Le Joueur Sud commence !";
                updateUI();
                break;

            case 'opponent_joined':
                gameActive = true; 
                moveLog.textContent = "Votre adversaire est connecté ! C'est à vous de jouer (Sud).";
                alert("Un adversaire a rejoint votre salon !");
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
        statusMessage.textContent = "Connexion perdue. Tentative de reconnexion...";
        statusMessage.style.color = "#dc3545";
        roomCodeInput.disabled = true;
        btnCreate.disabled = true;
        btnConnect.disabled = true;
        setTimeout(connectToServer, 3000);
    };
}

// INTERACTION BOUTONS DU LOGIEL
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

// CAPTURE DU CLIC SUR LE PLATEAU TRADITIONNEL
pits.forEach(pit => {
    pit.addEventListener('click', (e) => {
        if (!gameActive || isAnimating) return;

        const clickedIndex = parseInt(e.target.getAttribute('data-index'));

        // Sécurité de vérification des tours réseau
        if (serverGameState.currentTurn !== myRole) {
            return alert("Ce n'est pas votre tour de jouer !");
        }

        // Sécurité de zone (Sud : cases 7-13 | Nord : cases 0-6)
        if (myRole === 'sud' && (clickedIndex < 7 || clickedIndex > 13)) return alert("Vous devez jouer dans vos cases (Rangée Sud) !");
        if (myRole === 'nord' && (clickedIndex < 0 || clickedIndex > 6)) return alert("Vous devez jouer dans vos cases (Rangée Nord) !");

        if (serverGameState.board[clickedIndex] === 0) return alert("Cette fosse est vide !");

        // Lancement de la logique de distribution
        executeSongoMove(clickedIndex);
    });
});

// LOGIQUE DE DISTRIBUTION ET DE RECAPTURE SANS IA
function executeSongoMove(index) {
    let seeds = serverGameState.board[index];
    serverGameState.board[index] = 0;
    let currentIdx = index;

    // Distribution circulaire anti-horaire classique
    while (seeds > 0) {
        currentIdx = (currentIdx + 1) % 14;
        serverGameState.board[currentIdx]++;
        seeds--;
    }

    // Capture basique (À adapter selon tes règles locales de capture Songo)
    // Exemple : si la case finale contient 2 ou 4 graines chez l'adversaire...

    // Alternance stricte des tours réseau
    serverGameState.currentTurn = (myRole === 'sud') ? 'nord' : 'sud';
    moveLog.textContent = `Dernier coup effectué depuis la fosse ${index}.`;

    // Envoi de la mise à jour au serveur Render
    socket.send(JSON.stringify({
        type: 'make_move',
        gameState: serverGameState
    }));
}

// SYNCHRONISATION DU MATÉRIEL VISUEL
function updateUI() {
    pits.forEach(pit => {
        const idx = parseInt(pit.getAttribute('data-index'));
        pit.textContent = serverGameState.board[idx];
    });

    scoreSudEl.textContent = serverGameState.scoreSud;
    scoreNordEl.textContent = serverGameState.scoreNord;

    if (!gameActive) {
        turnIndicator.textContent = "En attente d'un adversaire...";
        turnIndicator.style.color = "#ffc107";
    } else if (serverGameState.currentTurn === myRole) {
        turnIndicator.textContent = "À vous de jouer !";
        turnIndicator.style.color = "#28a745";
    } else {
        turnIndicator.textContent = "Tour de l'adversaire...";
        turnIndicator.style.color = "#ffffff";
    }
}