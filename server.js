var express = require('express');
var socketio = require('socket.io');
var cors = require('cors')
var http = http = require('http');
const dotenv = require('dotenv');
dotenv.config();
var app = express();
app.use(cors())
var server = http.createServer(app);
var io = socketio(server, { cors: true });
app.set('socketio', io);
app.set('server', server);
require('./routes/index.js')(app, io);
io.on('connection', function (socket) {
    console.log("New Client Connected")
});
app.listen(process.env.SERVER_PORT);
server.listen(process.env.SOCKET_PORT)