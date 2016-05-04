
var _KEY_TO_VEL = {
    87: {'x': 0, 'y': -1},
    83: {'x': 0, 'y': 1},
    65: {'x': -1, 'y': 0},
    68: {'x': 1, 'y': -0}
};

var _OPPOSITE_KEYS = {
    87: 83,
    83: 87,
    65: 68,
    68: 65
};

Input = function(onVelocityChange, velocityContext, onPointerChange, pointerContext) {
    console.log("input created");
    this._game = Facade.game;
    this._game.input.keyboard.addCallbacks(this, this._onKeyDown, this._onKeyUp, null);
    this._game.input.mouse.callbackContext = this;
    this._railgunShotAt = 0;
    this._game.input.mouse.mouseDownCallback = function(e) {
        var t = Date.now();
        if (t - this._railgunShotAt < Facade.params.weapons.railgun.recoilTime) 
            return;
        this._railgunShotAt = t;

        var p = this._game.input.mousePointer;
        var myP = Facade.visualState.me.view.position;
        var shotOrigin = new Phaser.Point(p.worldX - myP.x, p.worldY - myP.y).normalize();
        var shotEnd = new Phaser.Point(shotOrigin.x, shotOrigin.y);
        shotEnd.setMagnitude(Facade.params.weapons.railgun.rayLength);
        shotOrigin.setMagnitude(Facade.params.playerRadius+1);
        shotEnd.subtract(shotOrigin.x, shotOrigin.y);
        // shotOrigin.add(myP.x, myP.y);

        t = Date.now();
        var bodies = Facade.queue.getAllBodies();
        var shitres = ShitCast.complexCast(bodies, Matter.Query.ray,
            function(bb) {
                // console.log(bb);
                if ('clientId' in bb) return true;
                return false;
            },
            {x:myP.x + shotOrigin.x, y:myP.y + shotOrigin.y}, 
            {x:myP.x + shotOrigin.x + shotEnd.x, y:myP.y + shotOrigin.y + shotEnd.y},
            1
        );
        // console.log('shit cast took:', Date.now() - t);
        if (shitres.length !== 0) {
            shotEnd.setMagnitude(shitres[0].rayLen);
        }

        var from = {x: myP.x + shotOrigin.x, y: myP.y + shotOrigin.y};
        var to = {x: myP.x + shotEnd.x, y: myP.y + shotEnd.y};

        Facade.visualState.drawRay(from, shotEnd);
        var timeOffset = this._velocity.isZero() ? Date.now() - this._lastVelEnded : Date.now() - this._lastVelStarted;

        Facade.connection.sendShot(0, timeOffset, to);
        // console.log(Facade.networkState.interpolator.testLerpTime);
    };

    this._onVelocityChange = onVelocityChange;
    this._velocityContext = velocityContext;
    this._onPointerChange = onPointerChange;
    this._pointerContext = pointerContext;
    this.reset();
};

Input.prototype.constructor = Input;

Input.prototype = {

    reset: function() {
        console.log("input reset");
        this._velocity = new Phaser.Point(0, 0);
        this._lastX = 0;
        this._lastY = 0;
        this._lastVelStarted = 0;
        this._lastVelEnded = Date.now();
        this._myVelocityUpdated = 0;
        this._lastPointerUpdated = 0;
        this._lastPointerPosition = null;
        this._downHistory = [];
        this._downKeys = {};
        for (var k in _KEY_TO_VEL) {
            this._downKeys[k] = false;
        }
    },
    
    update: function(dt) {

        // update mouse position
        var p = this._game.input.mousePointer;
        // console.log(p.worldX, p.worldY);
        var elapsed = Date.now() - this._lastPointerUpdated;
        if (this._lastPointerUpdated === 0) {
            this._sendPointer({x:p.worldX, y:p.worldY});
        } else {
            if (elapsed >= Facade.params.pointerSendRate) {
                this._sendPointer({x:p.worldX, y:p.worldY});
            }
        }

        // update move velocity
        // if (this._velocity.isZero()) {
        //     if (this._lastVelEnded > 0) {
        //         this._lastVelEnded = 0;
        //         this._myVelocityUpdated = 0;
        //     }
        //     return;
        // }

        // console.log('updating for current velocity: dt: ', dt, '; myDt: ', myDt);
        this._myVelocityUpdated = Date.now();
    },

    _sendPointer: function(p) {
        this._lastPointerUpdated = Date.now();
        this._onPointerChange.call(this._pointerContext, p.x, p.y);
        this._lastPointerPosition = {x: p.x, y: p.y};
    },

    _onKeyDown: function(e) {
        if (!(e.keyCode in _KEY_TO_VEL)) return;
        if (this._downKeys[e.keyCode]) return;
        this._downKeys[e.keyCode] = true;

        var kVel = _KEY_TO_VEL[e.keyCode];
        var multiplier = this._downKeys[_OPPOSITE_KEYS[e.keyCode]] ? 2 : 1;
        this._downHistory.push(e.keyCode);
        this._velocity.add(kVel.x * multiplier, kVel.y * multiplier);
        this._invalidateVelocity();

        // console.log('current velocity: %s, %s', this._velocity.x, this._velocity.y);
    },

    _onKeyUp: function(e) {
        if (!(e.keyCode in _KEY_TO_VEL)) return;
        if (!this._downKeys[e.keyCode]) return;
        this._downKeys[e.keyCode] = false;

        var kVel = _KEY_TO_VEL[e.keyCode];
        var oppKey = _OPPOSITE_KEYS[e.keyCode];
        var multiplier = 1;

        var thisKeyOrder = this._downHistory.indexOf(e.keyCode);
        if (this._downKeys[oppKey]) {
            var oppKeyOrder = this._downHistory.indexOf(oppKey);
            if (thisKeyOrder > oppKeyOrder) {
                multiplier = 2;
            } else {
                multiplier = 0;
            }
        }
        this._downHistory.splice(thisKeyOrder, 1);
        this._velocity.subtract(kVel.x * multiplier, kVel.y * multiplier);
        this._invalidateVelocity();

        // console.log('current velocity: %s, %s', this._velocity.x, this._velocity.y);  
    },

    _invalidateVelocity: function() {
        var sameX = this._velocity.x == this._lastX;
        var sameY = this._velocity.y == this._lastY;
        if (!sameX || !sameY) {
            var ts = 0;
            var now = Date.now();
            if (this._lastVelStarted !== 0) {
                ts = now - this._lastVelStarted;
            }
            this._onVelocityChange.call(this._velocityContext, this._velocity, ts);
            Facade.queue.addStreamAction(Date.now(), 0, Facade.myId, this._velocity.x, this._velocity.y, ts);
            this._lastX = this._velocity.x;
            this._lastY = this._velocity.y;


            if (this._velocity.isZero()) {
                this._lastVelStarted = 0;
                this._lastVelEnded = now;
            } else {
                this._lastVelStarted = this._myVelocityUpdated = now;
            }
        }
    }
};

Object.defineProperty(Input.prototype, "velocity", {
    get: function() {
        return this._velocity;
    }
});