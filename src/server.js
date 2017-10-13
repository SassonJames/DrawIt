const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');

const port = process.env.PORT || process.env.NODE_PORT || 3000;

// read the client html file into memory
const index = fs.readFileSync(`${__dirname}/../client/index.html`);

const onRequest = (request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html'});
  response.write(index);
  response.end();
};

const app = http.createServer(onRequest).listen(port);

// io Server
const io = socketio(app);

// keep track of users squares
let users = [];
let pictures = ["Crown", "Pepe", "Mushroom", "Triforce", "House", "Sword"];
let drawstack = [];
let currentTime = 0;

io.on('connection', (socket) => {
    // Join the Room
    socket.join('room1');
    
    // broadcast the current drawstack
    socket.emit('catchUp', drawstack);
    
    socket.on("join", (data) => {
        socket.color = data.color;
        users.push(data);
        if(users.length == 1){
            currentTime = 30;
            let message = {};
            message.draw = pictures[Math.floor(Math.random() * 6)];
            message.status = true;
            socket.emit("changeTurn", message);
        }
    });
   
   // When they update their square's position, redraw it
   socket.on('newcircle', (data) => {
        drawstack.push(data);
        io.sockets.in('room1').emit('updateDraw', data);
      
   });
    
    // Tick the Timer
    socket.on('ticktimer', () => {
        currentTime -= 1;
        let message = `Time Left: ${currentTime}`;
        io.sockets.in('room1').emit('tickTimer', message);
    });
   
   // When they disconnect, leave the room
   socket.on('disconnect', () => {
      socket.leave('room1'); 
   });
});