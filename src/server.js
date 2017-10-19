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

const users = {};
const userNames = [];
let pictures = [];
let drawstack = [];
let currentDrawer = null;
let currentWord = null;
let currentTime = 0;

io.on('connection', (socket) => {
  // Join the Room
  socket.join('room1');
  let sockName;

  socket.on('userjoin', (data) => {
    users.name = data.msg;
    sockName = data.msg;
    socket.emit('joinedroom');
  });

  socket.on('addwords', (data) => {
    pictures = pictures.concat(data.words);
    // broadcast the current drawstack
    socket.emit('catchUp', drawstack);
    userNames.push(data.name);

    if (userNames.length >= 2) {
      currentTime = 30;
      const message = {};
      message.draw = pictures[Math.floor(Math.random() * pictures.length)];
      currentWord = message.draw;
      message.name = userNames[Math.floor(Math.random() * userNames.length)];
      currentDrawer = message.name;
      drawstack = [];
      io.sockets.in('room1').emit('changeTurn', message);
    }
  });

  // When they update their square's position, redraw it
  socket.on('newcircle', (data) => {
    drawstack.push(data);
    io.sockets.in('room1').emit('updateDraw', data);
  });

  socket.on('msgToServer', (data) => {
    if (data.msg.toLowerCase() === currentWord.toLowerCase()) {
      io.sockets.in('room1').emit('msg', { msg: `${data.name} guessed the word!`, name: data.name });
      socket.emit('correctguess', { msg: 'You guessed correctly!' });
    } else {
      io.sockets.in('room1').emit('msg', { name: data.name, msg: data.msg });
    }
  });

  // Tick the Timer
  socket.on('ticktimer', () => {
    currentTime -= 1;
    if (currentTime <= 0) {
      currentTime = 30;
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
