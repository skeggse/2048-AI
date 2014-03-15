importScripts('vector.js');
importScripts('grid.js');
importScripts('tile.js');
importScripts('ai.js');

self.addEventListener('message', function(event) {
  var data = event.data;
  if (data.grid && data.time) {
    var grid = Grid.unserialize(data.grid);
    var ai = new AI(grid);
    var best = ai.getBest(data.time);
    self.postMessage({
      move: best.move,
      id: data.id
    });
  } else {
    self.close();
  }
}, false);
