const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');

const port = process.env.PORT || process.env.NODE_PORT || 3000;

// read the client html file into memory
const index = fs.readFileSync(`${__dirname}/../client/index.html`);

const onRequest = (request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.write(index);
  response.end();
};

const app = http.createServer(onRequest).listen(port);

// io Server
const io = socketio(app);

const users = {}; // Object to hold user data
const userNames = []; // Array to hold usernames
let pictures = []; // Array to hold words submitted by users to create pictures
let drawstack = []; // Array to hold the drawstack for players that join
let currentDrawer = null; // Variable to hold the current drawer's name
let currentWord = null; // Variable to hold the current word
let currentTime = 0; // The current time left in the round

// When the socket connects, set up the events
io.on('connection', (socket) => {
  // Join the Room
  socket.join('room1');
  let sockName;

  // When the user joins set the username and socket name
  // Add user to the users object
  // Then tell user they have joined the room
  socket.on('userjoin', (data) => {
    users.name = data.msg;
    sockName = data.msg;
    socket.emit('joinedroom');
  });

  // When the user submits their words, add it to the picture array
  // Let the user catch up on the current round
  // If there is exactly 2 users, restart the game
  socket.on('addwords', (data) => {
    pictures = pictures.concat(data.words);
    // broadcast the current drawstack
    socket.emit('catchUp', drawstack);
    userNames.push(data.name);

    if (userNames.length === 2) {
      currentTime = 60;
      const message = {};
      message.draw = pictures[Math.floor(Math.random() * pictures.length)];
      currentWord = message.draw;
      message.name = userNames[Math.floor(Math.random() * userNames.length)];
      currentDrawer = message.name;
      drawstack = [];
      io.sockets.in('room1').emit('changeTurn', message);
    }
  });

  // When the user adds a new point, broadcast it to all users in the room
  // Update the drawstack
  socket.on('newpoint', (data) => {
    drawstack.push(data);
    io.sockets.in('room1').emit('updateDraw', data);
  });

  // When the server recieves a message
  // If the message matches the current word, don't display it and award the player a point
  // Otherwise, send the message to every player
  socket.on('msgToServer', (data) => {
    if (data.msg.toLowerCase() === currentWord.toLowerCase()) {
      io.sockets.in('room1').emit('msg', { msg: `${data.name} guessed the word!`, name: data.name });
      socket.emit('correctguess', { msg: 'You guessed correctly!' });
    } else {
      io.sockets.in('room1').emit('msg', { name: data.name, msg: data.msg });
    }
  });

  // Tick the Timer
  // Once it reaches zero, start the next round
  // Chooses a new player
  socket.on('ticktimer', () => {
    currentTime -= 1;
    if (currentTime <= 0) {
      io.sockets.in('room1').emit('msg', { msg: `The word was ${currentWord}`, name: 'Server' });
      currentTime = 60;
      const message = {};

      message.draw = pictures[Math.floor(Math.random() * 6)];
      currentWord = message.draw;

      message.name = userNames[Math.floor(Math.random() * userNames.length)];

      while (message.name === currentDrawer) {
        message.name = userNames[Math.floor(Math.random() * userNames.length)];
      }
      currentDrawer = message.name;
      drawstack = [];
      io.sockets.in('room1').emit('changeTurn', message);
    } else {
      const message = `Time Left: ${currentTime}`;
      io.sockets.in('room1').emit('tickTimer', message);
    }
  });

  // When they disconnect, leave the room
  // If they were the drawer, start a new round
  socket.on('disconnect', () => {
    socket.leave('room1');
    userNames.splice(userNames.indexOf(sockName), 1);
    if (sockName === currentDrawer) {
      currentTime = 30;
      const message = {};

      message.draw = pictures[Math.floor(Math.random() * pictures.length)];
      currentWord = message.draw;

      message.name = userNames[Math.floor(Math.random() * userNames.length)];

      while (message.name === currentDrawer) {
        message.name = userNames[Math.floor(Math.random() * userNames.length)];
      }
      currentDrawer = message.name;
      drawstack = [];
      io.sockets.in('room1').emit('changeTurn', message);
    }
    delete (users.name);
    if (userNames.length === 0) {
      drawstack = [];
      pictures = [];
    }
  });
});
