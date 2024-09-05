const socket = io();

let currentRoomCode = '';
let isCreator = false;

document.getElementById('createRoomButton').addEventListener('click', () => {
    const playerName = document.getElementById('playerNameInput').value.trim();
    if (playerName) {
        socket.emit('createRoom', playerName, (response) => {
            if (response && response.roomCode) {
                handleRoomJoin(response.roomCode, response.players, true);
            } else {
                alert('Failed to create room');
            }
        });
    } else {
        alert('Please enter your name');
    }
});

document.getElementById('joinRoomButton').addEventListener('click', () => {
    document.getElementById('roomCodeInput').style.display = 'block';
});

document.getElementById('roomCodeInput').addEventListener('change', () => {
    const playerName = document.getElementById('playerNameInput').value.trim();
    const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (playerName && roomCode) {
        socket.emit('joinRoom', { roomCode, playerName }, (response) => {
            if (response.success) {
                handleRoomJoin(roomCode, response.players, false);
            } else {
                alert(response.message);
            }
        });
    } else {
        alert('Please enter your name and room code');
    }
});

function handleRoomJoin(roomCode, players, creator) {
    currentRoomCode = roomCode;
    isCreator = creator;
    document.getElementById('nameContainer').style.display = 'none';
    document.getElementById('waitingContainer').style.display = 'block';
    document.getElementById('roomCodeDisplay').textContent = `Room Code: ${roomCode}`;
    updatePlayersList(players);
    document.getElementById('startGameButton').style.display = creator ? 'block' : 'none';
}

function updatePlayersList(players) {
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.name;
        playersList.appendChild(li);
    });
}

document.getElementById('startGameButton').addEventListener('click', () => {
    socket.emit('startGame', currentRoomCode);
});

socket.on('assignWords', (word) => {
    document.getElementById('waitingContainer').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'block';
    document.getElementById('wordDisplay').textContent = `Your word is: ${word}`;
});

document.getElementById('sendButton').addEventListener('click', () => {
    const sentence = document.getElementById('sentenceInput').value.trim();
    if (sentence) {
        socket.emit('submitSentence', { roomCode: currentRoomCode, sentence });
        document.getElementById('sentenceInput').value = '';
    }
});

socket.on('receiveSentence', ({ sentence, playerName }) => {
    const messages = document.getElementById('messages');
    const li = document.createElement('li');
    li.textContent = `${playerName}: ${sentence}`;
    messages.appendChild(li);
});

document.getElementById('callVoteButton').addEventListener('click', () => {
    socket.emit('callVote', currentRoomCode);
});

socket.on('startVote', (playerNames) => {
    document.getElementById('voteContainer').style.display = 'block';
    const playerListForVote = document.getElementById('playerListForVote');
    playerListForVote.innerHTML = '';
    playerNames.forEach(name => {
        const li = document.createElement('li');
        li.textContent = name;
        li.addEventListener('click', () => {
            socket.emit('vote', { roomCode: currentRoomCode, votedPlayerName: name });
        });
        playerListForVote.appendChild(li);
    });
});

socket.on('updateVotes', (votes) => {
    const votesDisplay = document.getElementById('votesDisplay');
    votesDisplay.innerHTML = '';
    for (const [playerName, voteCount] of Object.entries(votes)) {
        const li = document.createElement('li');
        li.textContent = `${playerName}: ${voteCount} vote(s)`;
        votesDisplay.appendChild(li);
    }
    
});

socket.on('updateRoom', (players) => {
    updatePlayersList(players);
});

socket.on('voteResult', ({ votedOut, votes, imposter, isImposterCaught }) => {
    const resultContainer = document.getElementById('resultContainer');
    resultContainer.style.display = 'block';
    resultContainer.innerHTML = `
        <h2>Voting Results</h2>
        <p>Player voted out: ${votedOut}</p>
        <p>The imposter was: ${imposter}</p>
        <p>${isImposterCaught ? 'The imposter was caught!' : 'The imposter escaped!'}</p>
        <h3>Vote Distribution:</h3>
        <ul>
            ${Object.entries(votes).map(([player, voteCount]) => 
                `<li>${player}: ${voteCount} vote(s)</li>`
            ).join('')}
        </ul>
        <button id="nextRoundButton">Next Round</button>
    `;
    
    document.getElementById('voteContainer').style.display = 'none';
    document.getElementById('votesDisplay').style.display = 'none';
    
    document.getElementById('nextRoundButton').addEventListener('click', () => {
        resultContainer.style.display = 'none';
        // Here you can add logic to start the next round or end the game
    });
});