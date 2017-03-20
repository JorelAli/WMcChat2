//
// # WMcChat2
//
// A web based Minecraft chat client
//

/* Web imports */
var http = require('http');
var path = require('path');
var socketio = require('socket.io');
var express = require('express');

/* Minecraft imports */
var mc = require('minecraft-protocol');

/* Starts up the web server */
var router = express();
var server = http.createServer(router);
var io = socketio.listen(server);
var ip = '127.0.0.1';
var serverVersion = "1.11.2";

router.use(express.static(path.resolve(__dirname, 'client')));

//These are the people connected to the webserver
/* This is actually completely useless and just uses up memory.
   TODO: remove this */
var sockets = [];

//The Minecraft clients
var clients = [];

/* Gets the WMcChat version from the package.json file */
var pjson = require('./package.json');
var WEBSERVER_VERSION = pjson.version;

//When a person connects to the web page
io.on('connection', function (socket) {
  
    // messages.forEach(function (data) {
    //   socket.emit('message', data);
    // });

    // Add them to the list of sockets
    sockets.push(socket);

    // Remove them from the list of sockets when they disconnect
    socket.on('disconnect', function () {
      sockets.splice(sockets.indexOf(socket), 1);
    });
    
    // When a person logs in using the login form
    socket.on('login', function(data) {
      loginToMinecraft(data[0], data[1], data[2], data[3], socket);
    }); 
    
    // When a person sends a message using the message form
    socket.on('chat', function(msg) {
      chat(socket, msg);
    }); 

    // socket.on('message', function (msg) {
    //   var text = String(msg || '');

    //   if (!text)
    //     return;

    //   socket.get('name', function (err, name) {
    //     var data = {
    //       name: name,
    //       text: text
    //     };

    //     broadcast('message', data);
    //     messages.push(data);
    //   });
    // });

    // socket.on('identify', function (name) {
    //   socket.set('name', String(name || 'Anonymous'), function (err) {
    //     updateRoster();
    //   });
    // });
  });

// function updateRoster() {
//   async.map(
//     sockets,
//     function (socket, callback) {
//       socket.get('name', callback);
//     },
//     function (err, names) {
//       broadcast('roster', names);
//     }
//   );
// }

// function broadcast(event, data) {
//   sockets.forEach(function (socket) {
//     socket.emit(event, data);
//   });
// }

// Server listens for new people
server.listen(process.env.PORT || 3000, process.env.IP || ip, function(){
  var addr = server.address();
  console.log("Chat server listening at", addr.address + ":" + addr.port);
});

// Logs the player into Minecraft
function loginToMinecraft(username, password, serverip, port, socket) {
  
  // Set default port
  if(!port)
    port = 25565;
  
  // Log the user into Minecraft using minecraft-protocol
  var client = mc.createClient({
    host: serverip,
    port: port,
    username: username,
    password: password,
    version: "1.11.2"
  });
  
  /* Information from server_info packet
  { "description":"A Minecraft Server",
    "players":{"max":2147483647,"online":0},
    "version":{"name":"CraftBukkit 1.8.8","protocol":47}
  }
  */

  // When the client receives a chat message
  client.on('chat', function(packet) {
    var jsonMsg = JSON.parse(decodeString(packet.message));
    
    if(!jsonMsg.extra){
      console.log("Gah! I can't read this info yet!");
      console.log(jsonMsg);
      return;
    }

    /*
    Weird object at the end:
    
    { extra: 
   [ { color: 'green', text: '(' },
     { color: 'dark_aqua', text: '[Diamond]' },
     { color: 'dark_purple', text: 'E' },
     { color: 'green', text: 't' },
     { color: 'dark_purple', text: 'h' },
     { color: 'green', text: 'e' },
     { color: 'green', text: ') Test' } ],
  text: '' }
  
  
  No weird object at the end:
  
  { extra: 
   [ { color: 'white', text: '[Iron]' },
     { color: 'yellow', text: 'Cape' },
     ': back' ],
  text: '' }
    */

    var chatMessage = [];
    for(var i = 0; i < jsonMsg.extra.length; i++) {
      chatMessage.push(jsonMsg.extra[i].text);
    }
    
    var extraMsg = jsonMsg.extra[jsonMsg.extra.length - 1];
    console.log(extraMsg);
    /*
    Unknown
    { color: 'green', text: ') hello' }
    
    Regular
    : hello

    
    */
    if(!extraMsg == '')
      chatMessage.push(extraMsg);
    
    var finalChatMessage = chatMessage.join(' ');
    //console.log("Final chat msg: " + finalChatMessage);
    
    socket.emit('chatbox', finalChatMessage);
  });
  
  // When the client logs in
  client.on('login', function(packet) {
    chat(socket, "/spawn");
    chat(socket, "Hello everyone, I've joined using WMcChat2 version " + WEBSERVER_VERSION);
  }); 
  
  // When the client is disconnected (e.g. kicked from the server)
  client.on('kick_disconnect', function(packet) {
    socket.emit('chatbox', "Connection lost: " + packet.reason);
     console.log(packet.reason);
  });
  
  // When the client shuts down (e.g. server closes, or other unknown issue)
  client.on('end', function() {
    socket.emit('chatbox', "Connection lost");
     console.log("Connection lost: Unknown cause");
  });
  
  // When there is a confusing error (e.g. server closes)
  client.on('error', function() {
     socket.emit('chatbox', "An error occured");
     console.log("An error occured");
  });
  
  //Store the client so multiple clients can be used at once
  clients.push({socket: socket, client: client});
}

// When a person needs to chat
function chat(socket, msg) {
  clients.forEach(function (clientData) {
    if(clientData.socket == socket)
      clientData.client.write('chat', {message: msg});
  });
}

// Converts weird codes into readable strings (e.g. \u003 to <)
function decodeString(string) {
  var r = /\\u([\d\w]{4})/gi;
  string = string.replace(r, function (match, grp) {
      return String.fromCharCode(parseInt(grp, 16)); } );
  string = unescape(string);
  return string;
}