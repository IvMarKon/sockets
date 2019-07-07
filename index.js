const PORT = process.env.PORT || 5000;

const express = require('express');
const WebSocket = require('ws');

let counter = 0;
const rooms = [];

// Setup Express and start listening on PORT
const app = express()
  .use(express.static('.'))
  .get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  })
  .listen(PORT, () => {
    console.log(`Listening on ${PORT}`);
  });

const wss = new WebSocket.Server({ server: app });

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    console.log(message, rooms);
    const action = JSON.parse(message);

    switch (action.type) {
      case 'createGame':
        rooms.push({
          id: counter,
          player1: action.name,
        });
        ws.send(JSON.stringify({
          type: 'newGame',
          name: action.name,
          room: counter,
        }));
        counter++;
        break;
      case 'joinGame':
        if (action.room && rooms[action.room * 1] && !rooms[action.room * 1].player2) {
          rooms[action.room * 1].player2 = action.name;
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'player1',
              }));
            }
          });
          ws.send(JSON.stringify({
            type: 'player2',
            name: action.name,
            room: action.room,
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'err',
            message: 'Room not exist',
          }));
        }
        break;
      case 'playTurn':
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'turnPlayed',
              tile: action.tile,
              room: action.room,
            }));
          }
        });
        break;
      case 'gameEnded':
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'gameEnd',
              ...action,
            }));
          }
        });
        break;
      default:
        ws.send(JSON.stringify({
          type: 'err',
          message: 'no case for such type of action',
        }));
    }
  });
});
