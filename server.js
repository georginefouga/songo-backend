const { WebSocketServer } = require('ws');

// CRITIQUE POUR LE CLOUD : Render attribue un port aléatoire via process.env.PORT
const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

console.log(`Le serveur Songo Réseau Ékang est en ligne sur le port ${PORT}...`);

const games = {};

wss.on('connection', (ws) => {
    let currentRoom = null;
    let playerRole = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'join_room':
                    const room = data.roomCode;
                    currentRoom = room;

                    if (!games[room]) {
                        games[room] = {
                            board: Array(14).fill(5),
                            scoreSud: 0,
                            scoreNord: 0,
                            currentTurn: 'sud',
                            players: [ws]
                        };
                        playerRole = 'sud';
                        ws.send(JSON.stringify({ type: 'room_joined', role: 'sud', gameState: games[room] }));
                        console.log(`Salon [${room}] créé par le Joueur SUD`);
                    } else if (games[room].players.length === 1) {
                        games[room].players.push(ws);
                        playerRole = 'nord';
                        ws.send(JSON.stringify({ type: 'room_joined', role: 'nord', gameState: games[room] }));
                        
                        broadcastToRoom(room, { type: 'game_start', gameState: games[room] });
                        console.log(`Joueur NORD connecté au salon [${room}]. Duel lancé !`);
                    } else {
                        ws.send(JSON.stringify({ type: 'error', message: 'Ce salon est déjà complet.' }));
                    }
                    break;

                case 'play_move':
                    if (!currentRoom || !games[currentRoom]) return;
                    const game = games[currentRoom];

                    if (game.currentTurn !== playerRole) return;

                    const startIndex = data.index;
                    if (game.board[startIndex] === 0) return;

                    // Logique d'égrainage du Songo
                    let seeds = game.board[startIndex];
                    game.board[startIndex] = 0;
                    let currentIndex = startIndex;

                    while (seeds > 0) {
                        currentIndex = (currentIndex + 1) % 14;
                        if (currentIndex === startIndex) continue; // Saut du Grand Tour
                        game.board[currentIndex]++;
                        seeds--;
                    }

                    // Logique des captures (2, 3, 4 graines)
                    let capturedSeedsTotal = 0;
                    let checkIdx = currentIndex;

                    while (
                        (playerRole === 'sud' && checkIdx >= 7 && checkIdx <= 13) || 
                        (playerRole === 'nord' && checkIdx >= 0 && checkIdx <= 6)
                    ) {
                        let seedsInPit = game.board[checkIdx];
                        if (seedsInPit === 2 || seedsInPit === 3 || seedsInPit === 4) {
                            capturedSeedsTotal += seedsInPit;
                            game.board[checkIdx] = 0;
                            checkIdx = (checkIdx - 1 + 14) % 14;
                        } else {
                            break; 
                        }
                    }

                    if (playerRole === 'sud') {
                        game.scoreSud += capturedSeedsTotal;
                    } else {
                        game.scoreNord += capturedSeedsTotal;
                    }

                    game.currentTurn = (playerRole === 'sud') ? 'nord' : 'sud';

                    broadcastToRoom(currentRoom, {
                        type: 'move_executed',
                        startIndex: startIndex,
                        player: playerRole,
                        gameState: game
                    });
                    break;
            }
        } catch (e) {
            console.error("Erreur décodage message:", e);
        }
    });

    ws.on('close', () => {
        if (currentRoom && games[currentRoom]) {
            games[currentRoom].players = games[currentRoom].players.filter(p => p !== ws);
            if (games[currentRoom].players.length === 0) {
                delete games[currentRoom];
                console.log(`Salon [${currentRoom}] fermé.`);
            } else {
                broadcastToRoom(currentRoom, { type: 'opponent_disconnected' });
            }
        }
    });
});

function broadcastToRoom(roomCode, messageData) {
    if (games[roomCode]) {
        games[roomCode].players.forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify(messageData));
            }
        });
    }
}