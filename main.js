const P1 = 'X';
const P2 = 'O';
let player;
let game;

const ws = new WebSocket('ws://localhost:5000');

class Player {
  constructor(name, type) {
    this.name = name;
    this.type = type;
    this.currentTurn = true;
    this.playsArr = 0;
  }

  static get wins() {
    return [7, 56, 448, 73, 146, 292, 273, 84];
  }

  // Set the bit of the move played by the player
  // tileValue - Bitmask used to set the recently played move.
  updatePlaysArr(tileValue) {
    this.playsArr += tileValue;
  }

  getPlaysArr() {
    return this.playsArr;
  }

  // Set the currentTurn for player to turn and update UI to reflect the same.
  setCurrentTurn(turn) {
    this.currentTurn = turn;
    const message = turn ? 'Your turn' : 'Waiting for Opponent';
    $('#turn').text(message);
  }

  getPlayerName() {
    return this.name;
  }

  getPlayerType() {
    return this.type;
  }

  getCurrentTurn() {
    return this.currentTurn;
  }
}

// roomId Id of the room in which the game is running on the server.
class Game {
  constructor(roomId) {
    this.roomId = roomId;
    this.board = [];
    this.moves = 0;
  }

  // Create the Game board by attaching event listeners to the buttons.
  createGameBoard() {
    function tileClickHandler() {
      const row = parseInt(this.id.split('_')[1][0], 10);
      const col = parseInt(this.id.split('_')[1][1], 10);
      if (!player.getCurrentTurn() || !game) {
        alert('Its not your turn!');
        return;
      }

      if ($(this).prop('disabled')) {
        alert('This tile has already been played on!');
        return;
      }

      // Update board after your turn.
      game.playTurn(this);
      game.updateBoard(player.getPlayerType(), row, col, this.id);

      player.setCurrentTurn(false);
      player.updatePlaysArr(1 << (row * 3 + col));

      game.checkWinner();
    }

    for (let i = 0; i < 3; i++) {
      this.board.push(['', '', '']);
      for (let j = 0; j < 3; j++) {
        $(`#button_${i}${j}`).on('click', tileClickHandler);
      }
    }
  }
  // Remove the menu from DOM, display the gameboard and greet the player.
  displayBoard(message) {
    $('.menu').css('display', 'none');
    $('.gameBoard').css('display', 'block');
    $('#userHello').html(message);
    this.createGameBoard();
  }
  /**
   * Update game board UI
   *
   * @param {string} type Type of player(X or O)
   * @param {int} row Row in which move was played
   * @param {int} col Col in which move was played
   * @param {string} tile Id of the the that was clicked
   */
  updateBoard(type, row, col, tile) {
    $(`#${tile} span`)
      .text(type)
      .prop('disabled', true);
    this.board[row][col] = type;
    this.moves++;
  }

  getRoomId() {
    return this.roomId;
  }

  // Send an update to the opponent to update their UI's tile
  playTurn(tile) {
    const clickedTile = $(tile).attr('id');

    // Emit an event to update other player that you've played your turn.
    ws.send(JSON.stringify({
      type: 'playTurn',
      tile: clickedTile,
      room: this.getRoomId(),
    }));
  }

  checkWinner() {
    const currentPlayerPositions = player.getPlaysArr();

    Player.wins.forEach((winningPosition) => {
      if ((winningPosition & currentPlayerPositions) === winningPosition) {
        game.announceWinner();
      }
    });

    const tieMessage = 'Game Tied :(';
    if (this.checkTie()) {
      ws.send(JSON.stringify({
        type: 'gameEnded',
        room: this.getRoomId(),
        message: tieMessage,
      }));
      alert(tieMessage);
      window.location.reload();
    }
  }

  checkTie() {
    return this.moves >= 9;
  }

  announceWinner() {
    const message = `${player.getPlayerName()} wins!`;
    ws.send(JSON.stringify({
      type: 'gameEnded',
      room: this.getRoomId(),
      message,
    }));
    alert(message);
    window.location.reload();
  }

  // End the game if the other player won.
  endGame(message) {
    alert(message);
    window.location.reload();
  }
}

// Create a new game. Emit newGame event.
$('#new').on('click', () => {
  const name = $('#nameNew').val();
  if (!name) {
    alert('Please enter your name.');
    return;
  }
  ws.send(JSON.stringify({
    type: 'createGame',
    name,
  }));
  player = new Player(name, P1);
});

// Join an existing game on the entered roomId. Emit the joinGame event.
$('#join').on('click', () => {
  const name = $('#nameJoin').val();
  const roomID = $('#room').val();
  if (!name || !roomID) {
    alert('Please enter your name and game ID.');
    return;
  }
  ws.send(JSON.stringify({
    type: 'joinGame',
    name,
    room: roomID,
  }));
  player = new Player(name, P2);
});


// server response handlers
const newGame = (data) => {
  const message = `Hello, ${data.name}. Please ask your friend to enter Game ID: 
  ${data.room}. Waiting for player 2...`;

  game = new Game(data.room);
  game.displayBoard(message);
};

const player1 = () => {
  const message = `Hello, ${player.getPlayerName()}`;
  $('#userHello').html(message);
  player.setCurrentTurn(true);
};

const player2 = (data) => {
  const message = `Hello, ${data.name}`;

  game = new Game(data.room);
  game.displayBoard(message);
  player.setCurrentTurn(false);
};

const turnPlayed = (data) => {
  const row = data.tile.split('_')[1][0];
  const col = data.tile.split('_')[1][1];
  const opponentType = player.getPlayerType() === P1 ? P2 : P1;

  game.updateBoard(opponentType, row, col, data.tile);
  player.setCurrentTurn(true);
};

const gameEnd = (data) => {
  game.endGame(data.message);
  ws.send(JSON.stringify({
    type: 'leaveRoom',
    room: data.room,
  }));
};

ws.addEventListener('message', (message) => {
  const action = JSON.parse(message.data);

  switch (action.type) {
    case 'newGame':
      newGame(action);
      break;
    case 'player1':
      player1();
      break;
    case 'player2':
      player2(action);
      break;
    case 'turnPlayed':
      turnPlayed(action);
      break;
    case 'gameEnd':
      gameEnd(action);
      break;
    default:
      game ? game.endGame(action.message) : alert(action.message);
  }
});
