var ws = require('ws');
var time_util = require('./time_util.js');
var Client = require('./client.js');

var shared = require('./shared.gen.js');
var SendMessage = shared.SendMessage;
var GameParams = shared.GameParams;
var queue = shared.queue;

var spawnPositions = [
    {'x': 100, 'y': 100}, 
    {'x': 400, 'y': 100}, 
    {'x': 100, 'y': 400}, 
    {'x': 400, 'y': 400}
];
var currentSpawnPos = 0;

var clients = {};

ws.createServer({host: '0.0.0.0', port:3000}, function(socket) {
    var startPos = spawnPositions[currentSpawnPos];
    var client = new Client(socket, startPos);
    clients[client.id] = client;

    socket.on('message', function(rawMessage) {
        if (rawMessage == 'ping') {
            socket.send('pong');
        } else {
            var m = JSON.parse(rawMessage);
            switch(m.id) {
                case 'medianRTT':
                    if (m.clientId in clients) {
                        console.log('got player', m.clientId, 'median rtt:', m.value);
                        clients[m.clientId].setMedianRTT(m.value + GameParams.additionalVirtualLagMedian);
                        clients[m.clientId].send(SendMessage.srvTime(time_util.elapsed));
                    } else {
                        console.log('trying to do medianRTT at %i: does not exist!', m.clientId);
                    }
                    break;
                case 'vd':
                    // console.log('velocitydiff: ', rawMessage);
                    queue.addStreamAction(
                        time_util.elapsed, clients[m.cid].lag, m.cid, m.x, m.y, m.dt
                    );
                    break;
                case 'pointer':
                    clients[m.cid].pointer.x = m.x;
                    clients[m.cid].pointer.y = m.y;
                    break;
            }
            // console.log('incoming message: ', rawMessage);
        }
    });


    socket.on('close', function() {
        console.log('client', client.toString(), 'leaving: removing from clients');
        queue.deleteClient(client.id);
        delete clients[client.id];
        client.purge();
    });

    console.log('incoming connection: ', client.toString());

    queue.addClient(client.id, startPos.x, startPos.y);
    client.send(SendMessage.welcome(client.id, startPos.x, startPos.y)); 
    broadcast(SendMessage.position(client.id, startPos.x, startPos.y), client.id);
    iterateClients(function(iterClientId, iterClient) {
        if (iterClientId == client.id) return;
        console.log('sending client', client.id, ' position of', iterClientId);
        client.send(SendMessage.position(iterClient.id, iterClient.pos.x, iterClient.pos.y));
    });

    currentSpawnPos += 1;
    if (currentSpawnPos > 3) currentSpawnPos = 0;
});


time_util.onTimer(function(dt) {
    var currentTime = time_util.elapsed;
    var diff = [];
    iterateClients(function(clientId, client) {
        // console.log('moving client', clientId, client.pos);
        var addPointerToDiff = client.pointer.x !== client.lastSentPointer.x || client.pointer.y !== client.lastSentPointer.y;
        var clientMoved = queue.simulateStream(currentTime, clientId, client.pos, GameParams.playerSpeedX, GameParams.playerSpeedY);
        // if (!clientMoved) return;
        if (!clientMoved && !addPointerToDiff) return;
        var d = {clientId: clientId, time:currentTime};
        if (clientMoved) {
            d.x = client.pos.x;
            d.y = client.pos.y;
        }
        if (addPointerToDiff) {
            d.px = client.pointer.x;
            d.py = client.pointer.y;
            client.lastSentPointer.x = client.pointer.x;
            client.lastSentPointer.y = client.pointer.y;
        }
        diff.push(d);
    });
    if (diff.length === 0) return;
    // console.log('outcoming diffs: ', diff);
    broadcast(SendMessage.positionBatch(diff));
});

function broadcast(message, except) {
    iterateClients(function(clientId, client) {
        if (clientId == except) return;
        client.send(message);
    });
}

function iterateClients(action) {
    for (var clientId in clients) {
        action(clientId, clients[clientId]);
    }
}