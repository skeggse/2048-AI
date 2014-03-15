function GameManager(size, InputManager, Actuator) {
  this.size = size; // Size of the grid
  this.inputManager = new InputManager;
  this.actuator = new Actuator;

  this.running = false;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));

  this.inputManager.on('think', function () {
    this.think(function (best) {
      this.actuator.showHint(best.move);
    }.bind(this));
  }.bind(this));

  this.inputManager.on('run', function () {
    if (this.running) {
      this.running = false;
      this.actuator.setRunButton('Auto-run');
    } else {
      this.running = true;
      this.run()
      this.actuator.setRunButton('Stop');
    }
  }.bind(this));

  this.setup();
}

// Restart the game
GameManager.prototype.restart = function () {
  this.actuator.restart();
  this.running = false;
  this.actuator.setRunButton('Auto-run');
  this.setup();
};

// Set up the game
GameManager.prototype.setup = function () {
  this.grid = new Grid(this.size);
  this.grid.addStartTiles();

  this.worker = new Worker('js/worker.js');

  this.score = 0;
  this.over = false;
  this.won = false;

  // Update the actuator
  this.actuate();
};


// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  this.actuator.actuate(this.grid, {
    score: this.score,
    over: this.over,
    won: this.won
  });
};

// makes a given move and updates state
GameManager.prototype.move = function (direction) {
  var result = this.grid.move(direction);
  this.score += result.score;

  if (!result.won) {
    if (result.moved) {
      this.grid.computerMove();
    }
  } else {
    this.won = true;
  }

  //console.log(this.grid.valueSum());

  if (!this.grid.movesAvailable()) {
    this.over = true; // Game over!
  }

  this.actuate();
};

GameManager.prototype.think = function (callback) {
  var id = Math.random();

  this.worker.postMessage({
    id: id,
    grid: this.grid.serialize(),
    time: minSearchTime
  });

  this.worker.addEventListener('message', function onmessage (event) {
    var data = event.data;
    if (data.id === id) {
      this.worker.removeEventListener('message', onmessage);
      callback({
        move: data.move
      });
    }
  }.bind(this), false);
};

// moves continuously until game is over
GameManager.prototype.run = function () {
  this.think(function (best) {
    this.move(best.move);
    if (this.running && !this.over && !this.won) {
      setTimeout(this.run.bind(this), animationDelay);
    }
  }.bind(this));
};
