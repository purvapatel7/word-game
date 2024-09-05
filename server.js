const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};
const words = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry'];

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

let votingTimeout;

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('createRoom', (playerName, callback) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = { 
            players: [{ id: socket.id, name: playerName, word: '' }],
            wordAssignments: [],
            votes: {}
        };
        socket.join(roomCode);
        callback({ roomCode, players: rooms[roomCode].players });
    });

    socket.on('joinRoom', ({ roomCode, playerName }, callback) => {
        if (rooms[roomCode]) {
            rooms[roomCode].players.push({ id: socket.id, name: playerName, word: '' });
            socket.join(roomCode);
            io.to(roomCode).emit('updateRoom', rooms[roomCode].players);
            callback({ success: true, players: rooms[roomCode].players });
        } else {
            callback({ success: false, message: 'Room not found' });
        }
    });

    socket.on('startGame', (roomCode) => {
        if (rooms[roomCode] && rooms[roomCode].players.length >= 3) {
            const shuffledWords = [...words].sort(() => 0.5 - Math.random());
            const imposterWord = shuffledWords.pop();
            const normalWord = shuffledWords[0];

            rooms[roomCode].players.forEach((player, index) => {
                player.word = index === 0 ? imposterWord : normalWord;
                io.to(player.id).emit('assignWords', player.word);
            });
        }
    });

    socket.on('submitSentence', ({ roomCode, sentence }) => {
        const player = rooms[roomCode].players.find(p => p.id === socket.id);
        io.to(roomCode).emit('receiveSentence', { sentence, playerName: player.name });
    });

    socket.on('callVote', (roomCode) => {
        rooms[roomCode].votes = {};
        rooms[roomCode].votesReceived = 0;
        io.to(roomCode).emit('startVote', rooms[roomCode].players.map(p => p.name));
        
        // Set a timeout to end voting after 30 seconds
        votingTimeout = setTimeout(() => endVoting(roomCode), 30000);
    });

    socket.on('vote', ({ roomCode, votedPlayerName }) => {
        if (!rooms[roomCode].votes[votedPlayerName]) {
            rooms[roomCode].votes[votedPlayerName] = 0;
        }
        rooms[roomCode].votes[votedPlayerName]++;
        rooms[roomCode].votesReceived++;
        io.to(roomCode).emit('updateVotes', rooms[roomCode].votes);
        
        // Check if all players have voted
        if (rooms[roomCode].votesReceived === rooms[roomCode].players.length) {
            clearTimeout(votingTimeout);
            endVoting(roomCode);
        }
    });

    function endVoting(roomCode) {
        const votes = rooms[roomCode].votes;
        const votedOut = Object.entries(votes).reduce((a, b) => a[1] > b[1] ? a : b)[0];
        const imposter = rooms[roomCode].players.find(p => p.word !== rooms[roomCode].players[1].word);
        
        io.to(roomCode).emit('voteResult', {
            votedOut: votedOut,
            votes: votes,
            imposter: imposter.name,
            isImposterCaught: votedOut === imposter.name
        });
        
        // Reset votes for next round
        rooms[roomCode].votes = {};
        rooms[roomCode].votesReceived = 0;
    }

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        for (const roomCode in rooms) {
            rooms[roomCode].players = rooms[roomCode].players.filter(p => p.id !== socket.id);
            if (rooms[roomCode].players.length === 0) {
                delete rooms[roomCode];
            } else {
                io.to(roomCode).emit('updateRoom', rooms[roomCode].players);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));