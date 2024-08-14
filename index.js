// this file uses import statements based on ES6 (as opposed to CommonJS)
// partially adapted from https://github.com/AkileshRao/chat-server/blob/master/users.js

import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import http from 'http';
import {addUser, getUser, deleteUser, getUsers} from './users.js';
//import libsignal-protocol from './libsignal-protocol-javascript-master/dist/libsignal-protocol.js';
import {curve, SessionRecord, SessionCipher} from 'libsignal'; // these are based on the exports in /node_modules/libsignal/index.js
import { createKeyPair } from 'libsignal/src/curve.js';
import { generateKeyPair } from 'libsignal/src/curve.js';
import { encrypt } from 'libsignal/src/crypto.js';

console.log("key pair")
const keyPair = generateKeyPair();
console.log(keyPair);
console.log("only private key")
console.log(keyPair["privKey"])

const PORT = process.env.PORT || 9472; // see explanation https://stackoverflow.com/questions/18864677/what-is-process-env-port-in-node-js

async function main() {
  // open the database file
  const db = await open({
    filename: 'chat.db',
    driver: sqlite3.Database
  });

  // create our 'messages' table (you can ignore the 'client_offset' column for now)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_offset TEXT UNIQUE,
        content TEXT
    );
  `);

const app = express();

/*
const server = http.createServer((req, res) => {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end('Hello world')
});
*/

const server = http.createServer(app);

//const server = createServer(app);
const io = new Server(server, {
  connectionStateRecovery: {}
});

const __dirname = dirname(fileURLToPath(import.meta.url));

app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'chat_interface.html'));
});

io.on('connection', async (socket) => {
  console.log("A user connected");
  //socket.on('login', ({name, room}, callback) => {
  socket.on('login', (name) => {
    //const { user, error } = addUser(socket.id, name, room)
    const {user, error} = addUser(socket.id, name, socket.id)
    //if (error) return callback(error)
    //socket.join(user.room)
    socket.join(socket.id)
    //socket.in(room).emit('notification', { title: 'Someone\'s here', description: `${user.name} just entered the room` })
    socket.in(socket.id).emit('notification', { title: 'Someone\'s here', description: `${user.name} just entered the room` })
    console.log(`${user.name} Joined the room ${user.room}`)
    //io.in(room).emit('users', getUsers(room))
    io.in(socket.id).emit('users', getUsers(socket.id))
    //callback()
    //document.title = "test"
  });

  socket.on('chat message', async (msg) => {
    let result;
      try {
        // Using user.name directly will not work, so we need to have the this_user_name intermediary
        var this_user_name = getUser(socket.id).name;
        // store the message in the database
        var msg_str = this_user_name + ": " + msg
        result = await db.run('INSERT INTO messages (content) VALUES (?)', msg_str);
      } catch (e) {
        // TODO handle the failure
        return;
      }
      // include the offset with the message
      io.emit('chat message', msg_str, result.lastID);
      io.emit('chat message', "Send another message after io.emit('chat message', msg_str, result.lastID);");
      io.emit('chat message', '' + encrypt(keyPair["privKey"], Buffer.from(msg_str, 'utf-8'), keyPair["privKey"]));

      const user = getUser(socket.id)
      //io.in(user.room).emit('message', { user: user.name, text: message });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
        const user = deleteUser(socket.id)
        if (user) {
            io.in(user.room).emit('notification', { title: 'Someone just left', description: `${user.name} just left the room` })
            io.in(user.room).emit('users', getUsers(user.room))
        }
  })

  if (!socket.recovered) {
    // if the connection state recovery was not successful
    try {
      await db.each('SELECT id, content FROM messages WHERE id > ?',
        [socket.handshake.auth.serverOffset || 0],
        (_err, row) => {
          socket.emit('chat message', row.content, row.id);
        }
      )
    } catch (e) {
      // something went wrong
    }
  }
});

const hostname = '172.20.10.3';
const port = 9472;

server.listen(PORT, hostname, () => {
    console.log(`server running at http://${hostname}:${PORT}`)
});

}

main();