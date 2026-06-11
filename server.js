const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

const rooms = {};

console.log(`Serveur Songo en écoute sur le port ${PORT}`);

wss.on('connection', (ws) => {
    console.log('Un joueur s\'est connecté.');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // ACTION : CRÉER UN SALON
            if (data.type === 'create_room') {
                const roomCode = data.roomCode;
                if (rooms[roomCode]) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Ce salon existe déjà !' }));
                } else {
                    rooms[roomCode] = {
                        players: [ws],
                        gameState: {
                            board: Array(14).fill(5),
                            scoreSud: 0,
                            scoreNord: 0,
                            currentTurn: 'sud'
                        }
                    };
                    ws.roomCode = roomCode;
                    ws.role = 'sud';
                    ws.send(JSON.stringify({ type: 'room_created', roomCode: roomCode, role: ws.role, gameState: rooms[roomCode].gameState }));
                }
            }

            // ACTION : REJOINDRE UN SALON
            if (data.type === 'join_room') {
                const roomCode = data.roomCode;
                const room = rooms[roomCode];

                if (!room) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Salon introuvable.' }));
                } else if (room.players.length >= 2) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Ce salon est complet.' }));
                } else {
                    room.players.push(ws);
                    ws.roomCode = roomCode;
                    ws.role = 'nord';

                    ws.send(JSON.stringify({ type: 'room_joined', roomCode: roomCode, role: ws.role, gameState: room.gameState }));
                    room.players[0].send(JSON.stringify({ type: 'opponent_joined' }));
                }
            }

            // ACTION : MISE À JOUR ET SUIVI DES MOUVEMENTS
            if (data.type === 'make_move') {
                const roomCode = ws.roomCode;
                const room = rooms[roomCode];

                if (room) {
                    room.gameState.board = data.gameState.board;
                    room.gameState.scoreSud = data.gameState.scoreSud;
                    room.gameState.scoreNord = data.gameState.scoreNord;
                    room.gameState.currentTurn = data.gameState.currentTurn;

                    room.players.forEach((player) => {
                        if (player.readyState === WebSocket.OPEN) {
                            player.send(JSON.stringify({
                                type: 'update_game',
                                gameState: room.gameState,
                                logInfo: data.logInfo
                            }));
                        }
                    });
                }
            }

        } catch (error) {
            console.error(error);
        }
    });

    ws.on('close', () => {
        const roomCode = ws.roomCode;
        if (roomCode && rooms[roomCode]) {
            const room = rooms[roomCode];
            room.players = room.players.filter(p => p !== ws);
            if (room.players.length === 0) {
                delete rooms[roomCode];
            } else {
                room.players[0].send(JSON.stringify({ type: 'opponent_left', message: 'L\'adversaire a quitté la partie.' }));
            }
        }
    });
});