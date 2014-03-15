function Grid(size) {
  this.size = size;
  this.startTiles = 2;

  this.cells = [];

  this.build();
  this.playerTurn = true;
}

Grid.unserialize = function (obj) {
  var grid = new Grid(obj.size), cells = obj.cells, cell;
  grid.playerTurn = obj.playerTurn;
  for (var i = 0, n = cells.length; i < n; i++) {
    cell = cells[i];
    grid.insertTile(new Tile(new Vector(cell.x, cell.y), cell.value));
  }
  return grid;
};

Grid.prototype.serialize = function() {
  var cells = [], x = 0, y, s = this.size, c = this.cells;
  for (; x < s; x++) {
    for (y = 0; y < s; y++) {
      c[x][y] && cells.push({
        x: x,
        y: y,
        value: c[x][y].value
      });
    }
  }
  return {
    size: s,
    playerTurn: this.playerTurn,
    cells: cells
  };
};

// pre-allocate these objects (for speed)
Grid.prototype.indexes = [];
for (var x = 0; x < 4; x++) {
  Grid.prototype.indexes.push([]);
  for (var y = 0; y < 4; y++) {
    Grid.prototype.indexes[x].push(new Vector(x, y));
  }
}

// Build a grid of the specified size
Grid.prototype.build = function () {
  for (var x = 0; x < this.size; x++) {
    var row = this.cells[x] = [];

    for (var y = 0; y < this.size; y++) {
      row.push(null);
    }
  }
};

// Find the first available random position
Grid.prototype.randomAvailableCell = function () {
  var cells = this.availableCells();

  if (cells.length) {
    return cells[(Math.random() * cells.length) | 0];
  }
};

Grid.prototype.availableCells = function () {
  var cells = [];
  var x = 0, y, s = this.size, c = this.cells;

  for (; x < s; x++) {
    for (y = 0; y < s; y++) {
      if (!c[x][y]) {
        cells.push(new Vector(x, y));
      }
    }
  }

  /*var self = this;

  this.eachCell(function (x, y, tile) {
    if (!tile) {
      //cells.push(self.indexes[x][y]);
      cells.push(new Vector(x, y));
    }
  });*/

  return cells;
};

// Call callback for every cell
Grid.prototype.eachCell = function (callback) {
  var x = 0, y, s = this.size, c = this.cells;
  for (; x < s; x++) {
    for (y = 0; y < s; y++) {
      callback(x, y, c[x][y]);
    }
  }
};

// Check if there are any cells available
Grid.prototype.cellsAvailable = function () {
  var x = 0, y, s = this.size, c = this.cells;
  for (; x < s; x++) {
    for (y = 0; y < s; y++) {
      if (!c[x][y]) {
        return true;
      }
    }
  }
  return false;
};

// Check if the specified cell is taken
Grid.prototype.cellAvailable = function (x, y) {
  return !this.cellOccupied(x, y);
};

Grid.prototype.cellOccupied = function (x, y) {
  return !!this.cellContent(x, y);
};

Grid.prototype.cellContent = function (x, y) {
  // if (this.withinBounds(x, y)) {
  if (x >= 0 && x < this.size &&
      y >= 0 && y < this.size) {
    return this.cells[x][y];
  } else {
    return null;
  }
};

// Inserts a tile at its position
Grid.prototype.insertTile = function (tile) {
  this.cells[tile.x][tile.y] = tile;
};

Grid.prototype.removeTile = function (tile) {
  this.cells[tile.x][tile.y] = null;
};

Grid.prototype.withinBounds = function (x, y) {
  return x >= 0 && x < this.size &&
         y >= 0 && y < this.size;
};

Grid.prototype.clone = function() {
  var x = 0, y, s = this.size, c = this.cells;
  newGrid = new Grid(s);
  newGrid.playerTurn = this.playerTurn;
  for (; x < s; x++) {
    for (y = 0; y < s; y++) {
      c[x][y] && newGrid.insertTile(c[x][y].clone());
    }
  }
  return newGrid;
};

// Set up the initial tiles to start the game with
Grid.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

// Adds a tile in a random position
Grid.prototype.addRandomTile = function () {
  if (this.cellsAvailable()) {
    var value = Math.random() < 0.9 ? 2 : 4;
    //var value = Math.random() < 0.9 ? 256 : 512;
    var tile = new Tile(this.randomAvailableCell(), value);

    this.insertTile(tile);
  }
};

// Save all tile positions and remove merger info
Grid.prototype.prepareTiles = function () {
  this.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
Grid.prototype.moveTile = function (tile, cell) {
  this.cells[tile.x][tile.y] = null;
  this.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};


Grid.prototype.vectors = [
  new Vector(0, -1), // up
  new Vector(1, 0), // right
  new Vector(0, 1), // down
  new Vector(-1, 0) // left
];

// Move tiles on the grid in the specified direction
// returns true if move was successful
Grid.prototype.move = function (direction) {
  // 0: up, 1: right, 2:down, 3: left
  var self = this;

  var cell, tile, next;
  var positions;

  var vector = this.vectors[direction];
  var traversals = this.buildTraversals(vector);
  var moved = false;
  var score = 0;
  var won = false;

  // xl and yl should be the same
  var xi = 0, yi, xl = traversals.x.length, yl = traversals.y.length;
  var x, y;

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  for (; xi < xl; xi++) {
    x = traversals.x[xi];
    for (yi = 0; yi < yl; yi++) {
      y = traversals.y[yi];
      tile = self.cellContent(x, y);

      if (tile) {
        cell = self.indexes[x][y];
        positions = self.findFarthestPosition(cell, vector);
        next = positions.next;
        next = self.cellContent(next.x, next.y);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          self.insertTile(merged);
          self.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          score += merged.value;

          // The mighty 2048 tile
          if (merged.value === 2048) {
            won = true;
          }
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          self.playerTurn = false;
          //console.log('setting player turn to ', self.playerTurn);
          moved = true; // The tile moved from its original cell!
        }
      }
    }
  }

  return {
    moved: moved,
    score: score,
    won: won
  };
};

Grid.prototype.computerMove = function() {
  this.addRandomTile();
  this.playerTurn = true;
};

// Build a list of positions to traverse in the right order
Grid.prototype.buildTraversals = function (vector) {
  var traversals = {x: [], y: []}, pos, s = this.size;

  for (pos = 0; pos < s; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }
  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

Grid.prototype.findFarthestPosition = function (cell, vector) {
  var vx = vector.x, vy = vector.y, cx = cell.x, cy = cell.y, px, py;

  // Progress towards the vector direction until an obstacle is found
  do {
    px = cx;
    py = cy;
    cx += vx;
    cy += vy;
  } while (this.withinBounds(cx, cy) && !this.cells[cx][cy]);

  return {
    farthest: new Vector(px, py),
    next: new Vector(cx, cy) // Used to check if a merge is required
  };
};

Grid.prototype.movesAvailable = function () {
  return this.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
// returns the number of matches
Grid.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile, x = 0, y, s = this.size;

  for (; x < s; x++) {
    for (y = 0; y < s; y++) {
      if (tile = this.cellContent(x, y)) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.vectors[direction];

          var other = self.cellContent(x + vector.x, y + vector.y);

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

Grid.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};

Grid.prototype.toString = function() {
  string = '';
  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < 4; j++) {
      if (this.cells[j][i]) {
        string += this.cells[j][i].value + ' ';
      } else {
        string += '_ ';
      }
    }
    string += '\n';
  }
  return string;
};

// counts the number of isolated groups.
Grid.prototype.islands = function() {
  var cells = this.cells;
  function mark(x, y, value) {
    if (x >= 0 && x < 4 && y >= 0 && y < 4 &&
      cells[x][y] && cells[x][y].value === value && !cells[x][y].marked) {
      cells[x][y].marked = true;

      mark(x, y - 1, value);
      mark(x + 1, y, value);
      mark(x, y + 1, value);
      mark(x - 1, y, value);
    }
  }

  var x, y, islands = 0;

  for (x = 0; x < 4; x++) {
    for (y = 0; y < 4; y++) {
      if (cells[x][y]) {
        cells[x][y].marked = false
      }
    }
  }

  for (x = 0; x < 4; x++) {
    for (y = 0; y < 4; y++) {
      if (cells[x][y] &&
          !cells[x][y].marked) {
        islands++;
        mark(x, y, cells[x][y].value);
      }
    }
  }

  return islands;
};


// measures how smooth the grid is (as if the values of the pieces
// were interpreted as elevations). Sums of the pairwise difference
// between neighboring tiles (in log space, so it represents the
// number of merges that need to happen before they can merge).
// Note that the pieces can be distant
Grid.prototype.smoothness = function() {
  var smoothness = 0, x = 0, y, cell, value, direction, vector, targetCell, target;
  for (; x < 4; x++) {
    for (y = 0; y < 4; y++) {
      if (cell = this.cellContent(x, y)) {
        // not DRY but no loop...effectively same except the vector index changes
        value = Math.log(cell.value) / Math.LN2;
        targetCell = this.findFarthestPosition(this.indexes[x][y], this.vectors[1]).next;
        target = this.cellContent(targetCell.x, targetCell.y);
        if (target)
          smoothness -= Math.abs(value - Math.log(target.value) / Math.LN2);
        targetCell = this.findFarthestPosition(this.indexes[x][y], this.vectors[2]).next;
        target = this.cellContent(targetCell.x, targetCell.y);
        if (target)
          smoothness -= Math.abs(value - Math.log(target.value) / Math.LN2);
      }
    }
  }
  return smoothness;
};

Grid.prototype.monotonicity = function() {
  var self = this, cells = this.cells;
  var marked = new Array(4), queued = new Array(4);
  var highestValue = 0;
  var highestCell = new Vector(0, 0);
  var a, b, x = 0, y;
  for (; x < 4; x++) {
    marked[x] = a = new Array(4);
    queued[y] = b = new Array(4);
    for (y = 0; y < 4; y++) {
      a[y] = false;
      b[y] = false;
      if (cells[x][y] && cells[x][y].value > highestValue) {
        highestValue = cells[x][y].value;
        highestCell.x = x;
        highestCell.y = y;
      }
    }
  }

  increases = 0;
  cellQueue = [highestCell];
  queued[highestCell.x][highestCell.y] = true;
  markList = [highestCell];
  markAfter = 1; // only mark after all queued moves are done, as if searching in parallel

  function markAndScore(cell) {
    markList.push(cell);
    var value, tile, x = cell.x, y = cell.y;
    if (tile = self.cellContent(x, y)) {
      value = Math.log(tile.value) / Math.LN2;
    } else {
      value = 0;
    }
    for (var direction = 0; direction < 4; direction++) {
      var vector = self.vectors[direction];
      var x = x + vector.x, y = y + vector.y;
      if (self.withinBounds(x, y) && !marked[x][y]) {
        if (tile = self.cells[x][y]) {
          targetValue = Math.log(tile.value) / Math.LN2;
          if (targetValue > value) {
            increases += targetValue - value;
          }
        }
        if (!queued[x][y]) {
          cellQueue.push(new Vector(x, y));
          queued[x][y] = true;
        }
      }
    }
    if (markAfter === 0) {
      while (markList.length > 0) {
        var cel = markList.pop();
        marked[cel.x][cel.y] = true;
      }
      markAfter = cellQueue.length;
    }
  }

  while (cellQueue.length > 0) {
    markAfter--;
    markAndScore(cellQueue.shift())
  }

  return -increases;
};

// measures how monotonic the grid is. This means the values of the tiles are strictly increasing
// or decreasing in both the left/right and up/down directions
Grid.prototype.monotonicity2 = function() {
  // scores for all four directions
  var totals = [0, 0, 0, 0], x = 0, y = 0;
  var current, next, currentValue, nextValue;

  // up/down direction
  for (; x < 4; x++) {
    current = 0;
    next = current + 1;
    while (next < 4) {
      // while (next < 4 && !this.cellOccupied(x, next)) {
      while (next < 4 && !this.cellContent(x, next)) {
        next++;
      }
      if (next >= 4) next--;
      // TODO: optimize
      // currentValue = this.cellOccupied(x, current) ?
      currentValue = this.cellContent(x, current) ?
        Math.log(this.cellContent(x, current).value) / Math.LN2 :
        0;
      // nextValue = this.cellOccupied(x, next) ?
      nextValue = this.cellContent(x, next) ?
        Math.log(this.cellContent(x, next).value) / Math.LN2 :
        0;
      if (currentValue > nextValue) {
        totals[0] += nextValue - currentValue;
      } else if (nextValue > currentValue) {
        totals[1] += currentValue - nextValue;
      }
      current = next;
      next++;
    }
  }

  // left/right direction
  for (; y < 4; y++) {
    current = 0;
    next = current+1;
    while (next < 4) {
      // while (next < 4 && !this.cellOccupied(next, y)) {
      while (next < 4 && !this.cellContent(next, y)) {
        next++;
      }
      if (next >= 4) next--;
      // TODO: optimize
      // currentValue = this.cellOccupied(current, y) ?
      currentValue = this.cellContent(current, y) ?
        Math.log(this.cellContent(current, y).value) / Math.LN2 :
        0;
      // nextValue = this.cellOccupied(next, y) ?
      nextValue = this.cellContent(next, y) ?
        Math.log(this.cellContent(next, y).value) / Math.LN2 :
        0;
      if (currentValue > nextValue) {
        totals[2] += nextValue - currentValue;
      } else if (nextValue > currentValue) {
        totals[3] += currentValue - nextValue;
      }
      current = next;
      next++;
    }
  }

  return Math.max(totals[0], totals[1]) + Math.max(totals[2], totals[3]);
};

Grid.prototype.maxValue = function() {
  var max = 0, x = 0, y, cell;
  for (; x < 4; x++) {
    for (y = 0; y < 4; y++) {
      var cell = this.cellContent(x, y);
      if (cell && cell.value > max) {
        max = cell.value;
      }
    }
  }

  return Math.log(max) / Math.LN2;
};

// WIP. trying to favor top-heavy distributions (force consolidation of higher value tiles)
/*
Grid.prototype.valueSum = function() {
  var valueCount = [];
  for (var i = 0; i < 11; i++) {
    valueCount.push(0);
  }

  for (var x = 0; x < 4; x++) {
    for (var y = 0; y < 4; y++) {
      if (this.cellOccupied(x, y)) {
        valueCount[Math.log(this.cellContent(x, y).value) / Math.LN2]++;
      }
    }
  }

  var sum = 0;
  for (var i = 1; i < 11; i++) {
    sum += valueCount[i] * Math.pow(2, i) + i;
  }

  return sum;
};
*/

// check for win
Grid.prototype.isWin = function() {
  var self = this, cell, x = 0, y;
  for (; x < 4; x++) {
    for (y = 0; y < 4; y++) {
      var cell = self.cellContent(x, y);
      if (cell && cell.value === 2048) {
        return true;
      }
    }
  }
  return false;
};

//Grid.prototype.zobristTable = {}
//for
//Grid.prototype.hash = function() {
//};
