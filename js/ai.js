var AI_SMOOTH_WEIGHT = 0.1;
var AI_MONO2_WEIGHT = 1.0;
var AI_EMPTY_WEIGHT = 2.7;
var AI_MAX_WEIGHT = 1.0;

function SearchResult(move, score, positions, cutoffs) {
  this.move = move;
  this.score = score;
  this.positions = positions;
  this.cutoffs = cutoffs;
}

function AI(grid) {
  this.grid = grid;
}

// static evaluation function
AI.prototype.eval = function() {
  var emptyCells = this.grid.availableCells().length;

  return this.grid.smoothness() * AI_SMOOTH_WEIGHT
    //+ this.grid.monotonicity() * AI_MONO_WEIGHT
    //- this.grid.islands() * AI_ISLAND_WEIGHT
    + this.grid.monotonicity2() * AI_MONO2_WEIGHT
    + Math.log(emptyCells) * AI_EMPTY_WEIGHT
    + this.grid.maxValue() * AI_MAX_WEIGHT;
};

//AI.prototype.cache = {}

// alpha-beta depth first search
AI.prototype.search = function(depth, alpha, beta, positions, cutoffs) {
  var bestScore, bestMove = -1;
  var newAI, result;

  // the maxing player
  if (this.grid.playerTurn) {
    bestScore = alpha;
    for (var direction = 0; direction < 4; direction++) {
      var newGrid = this.grid.clone();
      if (newGrid.move(direction).moved) {
        positions++;
        if (newGrid.isWin()) {
          return new SearchResult(direction, 10000, positions, cutoffs);
        }

        newAI = new AI(newGrid);
        if (depth === 0) {
          result = {move: direction, score: newAI.eval()};
        } else {
          result = newAI.search(depth-1, bestScore, beta, positions, cutoffs);
          if (result.score > 9900) { // win
            result.score--; // to slightly penalize higher depth from win
          }
          positions = result.positions;
          cutoffs = result.cutoffs;
        }

        if (result.score > bestScore) {
          bestScore = result.score;
          bestMove = direction;
        }
        if (bestScore > beta) {
          return new SearchResult(bestMove, beta, positions, cutoffs + 1);
        }
      }
    }
  } else { // computer's turn, we'll do heavy pruning to keep the branching factor low
    bestScore = beta;

    // try a 2 and 4 in each cell and measure how annoying it is
    // with metrics from eval
    var candidates = [];
    var cells = this.grid.availableCells(), ncell = cells.length;
    var scores = {2: [], 4: []};
    for (var value in scores) {
      value = +value;
      for (var i = 0; i < ncell; i++) {
        scores[value].push(null);
        var cell = cells[i];
        var tile = new Tile(cell, value);
        this.grid.insertTile(tile);
        scores[value][i] = -this.grid.smoothness() + this.grid.islands();
        this.grid.removeTile(cell);
      }
    }

    /*
    var candidates = [];
    var cells = this.grid.availableCells();
    var scores = {2:[], 4:[]};
    var i = 0;
    for (var value in scores) {
      for (var i=0; i<cells.length; i++) {
        scores[value].push(0);
        var cell = cells[i];
        for (var direction in [0,1,2,3]) {
          var vector = this.grid.getVector(direction);
          var target = this.grid.findFarthestPosition(cell, vector);
          if (this.grid.cellOccupied(target.next.x, target.next.y)) {
            var targetValue = this.grid.cells[target.next.x][target.next.y].value;
            if (targetValue === value) {
              scores[value][i] -= 4;
            } else {
              scores[value][i] += Math.log(value) / Math.log(2);
            }
          }
        }
      }
    }
    //*/

    // now just pick out the most annoying moves
    var maxScore = Math.max(Math.max.apply(null, scores[2]), Math.max.apply(null, scores[4]));
    for (var value in scores) { // 2 and 4
      value = +value;
      for (var i = 0, nscores = scores[value].length; i < nscores; i++) {
        if (scores[value][i] === maxScore) {
          candidates.push({position: cells[i], value: value});
        }
      }
    }

    // search on each candidate
    for (var i = 0; i < candidates.length; i++) {
      var position = candidates[i].position;
      var value = candidates[i].value;
      var newGrid = this.grid.clone();
      var tile = new Tile(position, value);
      newGrid.insertTile(tile);
      newGrid.playerTurn = true;
      positions++;
      newAI = new AI(newGrid);
      result = newAI.search(depth, alpha, bestScore, positions, cutoffs);
      positions = result.positions;
      cutoffs = result.cutoffs;

      if (result.score < bestScore) {
        bestScore = result.score;
      }
      if (bestScore < alpha) {
        return new SearchResult(null, alpha, positions, cutoffs + 1);
      }
    }

    /*
    for (var samples=0; samples<4; samples++) {
      var newGrid = this.grid.clone();
      newGrid.computerMove();
      newAI = new AI(newGrid);
      result = newAI.search(depth, alpha, bestScore, positions, cutoffs);
      positions = result.positions;
      cutoffs = result.cutoffs;

      if (result.score < bestScore) {
        bestScore = result.score;
      }
      if (bestScore < alpha) {
        //console.log('cutoff')
        cutoffs++;
        return { move: bestMove, score: bestScore, positions: positions, cutoffs: cutoffs };
      }

    }
    //*/
    /*
    for (var x=0; x<4; x++) {
      for (var y=0; y<4; y++) {
        if (this.grid.cellAvailable(x, y)) {
          for (var value in [2, 4]) {
          //for (var value in [2]) {
            var newGrid = this.grid.clone();
            var tile = new Tile(new Vector(x, y), value);
            newGrid.insertTile(tile);
            newGrid.playerTurn = true;
            positions++;
            newAI = new AI(newGrid);
            //console.log('inserted tile, players turn is', newGrid.playerTurn);
            result = newAI.search(depth, alpha, bestScore, positions, cutoffs);
            positions = result.positions;
            cutoffs = result.cutoffs;

            if (result.score < bestScore) {
              bestScore = result.score;
            }
            if (bestScore < alpha) {
              //console.log('cutoff')
              cutoffs++;
              return { move: bestMove, score: bestScore, positions: positions, cutoffs: cutoffs };
            }
          }
        }
      }
    }
    //*/
  }

  return new SearchResult(bestMove, bestScore, positions, cutoffs);
};

// performs a search and returns the best move
AI.prototype.getBest = function(time) {
  return this.iterativeDeep(time);
};

// performs iterative deepening over the alpha-beta search
AI.prototype.iterativeDeep = function(time) {
  var start = Date.now(), depth = 0;
  var best, newBest;
  do {
    newBest = this.search(depth, -10000, 10000, 0 ,0);
    if (newBest.move === -1) {
      //console.log('BREAKING EARLY');
      break;
    } else {
      best = newBest;
    }
    depth++;
  } while (Date.now() - start < time);
  //console.log('depth', --depth);
  //console.log(this.translate(best.move));
  //console.log(best);
  return best;
};

var table = {
  0: 'up',
  1: 'right',
  2: 'down',
  3: 'left'
};

AI.prototype.translate = function(move) {
  return table[move];
};
