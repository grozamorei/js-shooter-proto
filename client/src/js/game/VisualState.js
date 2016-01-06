
VisualState = function(game, networkState) {
    console.log("visual state created");
    this._game = game;
    this._networkState = networkState;
    this._group = new Phaser.Group(game, game.world);
    game.world.add(this._group);

    this._visuals = {};
    this._visualMe = null;
}

VisualState.prototype.constructor = VisualState;

VisualState.prototype = {
    update: function(dt) {
        this._addNewPlayers();
        this._removeLeftPlayers();

        var players = this._networkState.players;
        for (var clientId in this._visuals) {

            // debug server movement display:
            var player = players[clientId];
            var playerVisual = this._visuals[clientId];
            playerVisual.debugView.x = player.lastPos.x;
            playerVisual.debugView.y = player.lastPos.y;

            // visual interpolation of other players:
            if (player.isMe) continue;
            player.interpolate(playerVisual.view, dt);
        }

        // client prediction for myself:
        var sX = Facade.params.playerSpeedX;
        var sY = Facade.params.playerSpeedY;
        Facade.queue.simulateStream(Date.now(), 0, this._visualMe.view.position, sX, sY);
    },

    _addNewPlayers: function() {
        var newPlayersLen = this._networkState.newPlayers.length;
        if (newPlayersLen > 0) {
            for (var i = 0; i < newPlayersLen; i++) {
                var newPlayerId = this._networkState.newPlayers.shift();
                var newPlayer = this._networkState.players[newPlayerId];
                var pos = newPlayer.lastPos;
                console.log('adding visual player (isMe:', newPlayer.isMe);
                this._visuals[newPlayerId] = new PlayerVisual(pos.x, pos.y, this._group, newPlayer.isMe);
                if (newPlayer.isMe) {
                    this._visualMe = this._visuals[newPlayerId];
                }
            }
        }
    },

    _removeLeftPlayers: function() {

    },

    _doDebugSprite: function(x, y, isMe) {
        var color = isMe ? 0xCCCCCC : 0xAAAAAA;
        var alpha = Facade.params.serverStateVisible ? 0.2 : 0;
        return Facade.factory.sprite(
            x, y, 'player_sprite', this._group, color, undefined, undefined, alpha
            );
    },

    _doClientSprite: function(x, y, isMe) {
        var color = isMe ? 0x0000CC : 0xCC0000;
        return Facade.factory.sprite(
            x, y, 'player_sprite', this._group, color, new Phaser.Point(0.95, 0.95)
            );  
    }
};

Object.defineProperty(VisualState.prototype, 'me', {
    get: function() {
        return this._clientMe;
    }
});

Object.defineProperty(VisualState.prototype, 'serverMe', {
    get: function() {
        return this._serverMe;
    }
});