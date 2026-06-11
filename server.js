const WebSocket = require('ws');

// Choix automatique du port (celui fourni par Render, ou 3000 en local)
const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

// Stockage dynamique des salons : { 'nom_du_salon': { players: [ws1, ws2], gameState: {...} } }
const rooms = {};

console.log(`Serveur Songo en écoute sur le port ${PORT}`);

wss.on('connection', (ws) => {
    console.log('Un joueur s\'est connecté au serveur.');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // ACTION : CRÉER UN SALON
            if (data.type === 'create_room') {
                const roomCode = data.roomCode;
                
                if (rooms[roomCode]) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Ce salon existe déjà ! Utilisez un autre nom ou rejoignez-le.' }));
                } else {
                    // Initialisation du salon avec le créateur (Joueur Sud)
                    rooms[roomCode] = {
                        players: [ws],
                        gameState: {
                            board: Array(14).fill(5), // 14 cases avec 5 graines chacune
                            scoreSud: 0,
                            scoreNord: 0,
                            currentTurn: 'sud' // Le créateur commence
                        }
                    };
                    ws.roomCode = roomCode;
                    ws.role = 'sud';

                    ws.send(JSON.stringify({ 
                        type: 'room_created', 
                        roomCode: roomCode, 
                        role: ws.role,
                        gameState: rooms[roomCode].gameState
                    }));
                    console.log(`Salon créé : ${roomCode} par le Joueur Sud`);
                }
            }

            // ACTION : REJOINDRE UN SALON
            if (data.type === 'join_room') {
                const roomCode = data.roomCode;
                const room = rooms[roomCode];

                if (!room) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Salon introuvable. Vérifiez le nom ou créez-le.' }));
                } else if (room.players.length >= 2) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Ce salon est déjà complet (2 joueurs maximum).' }));
                } else {
                    // Intégration du second joueur (Joueur Nord)
                    room.players.push(ws);
                    ws.roomCode = roomCode;
                    ws.role = 'nord';

                    ws.send(JSON.stringify({ 
                        type: 'room_joined', 
                        roomCode: roomCode, 
                        role: ws.role, 
                        gameState: room.gameState 
                    }));

                    // Alerter le créateur (Sud) que l'adversaire est arrivé
                    room.players[0].send(JSON.stringify({ type: 'opponent_joined' }));
                    console.log(`Joueur Nord a rejoint le salon : ${roomCode}. Le jeu peut commencer !`);
                }
            }

            // ACTION : JOUER UN COUP (TRANSMISSION & SYNCHRONISATION)
            if (data.type === 'make_move') {
                const roomCode = ws.roomCode;
                const room = rooms[roomCode];

                if (room) {
                    // On met à jour l'état du jeu global sur le serveur
                    room.gameState = data.gameState;

                    // On diffuse le nouvel état à TOUS les joueurs du salon
                    room.players.forEach((player) => {
                        if (player.readyState === WebSocket.OPEN) {
                            player.send(JSON.stringify({
                                type: 'update_game',
                                gameState: room.gameState
                            }));
                        }
                    });
                }
            }

        } catch (error) {
            console.error('Erreur lors du traitement du message :', error);
        }
    });

    // GESTION DES DÉCONNEXIONS
    ws.on('close', () => {
        const roomCode = ws.roomCode;
        if (roomCode && rooms[roomCode]) {
            const room = rooms[roomCode];
            
            // Retirer le joueur déconnecté de la liste
            room.players = room.players.filter(p => p !== ws);
            console.log(`Un joueur a quitté le salon : ${roomCode}`);

            // Si le salon est vide, on le supprime de la mémoire
            if (room.players.length === 0) {
                delete rooms[roomCode];
                console.log(`Salon ${roomCode} supprimé car vide.`);
            } else {
                // S'il reste un joueur, on l'informe du départ de son adversaire
                room.players[0].send(JSON.stringify({ type: 'opponent_left', message: 'Votre adversaire a quitté la partie.' }));
            }
        }
    });
});