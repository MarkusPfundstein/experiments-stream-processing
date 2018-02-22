const R = require('ramda');
const { EventEmitter } = require('events');

const emitter = new EventEmitter();

const CLOCKS = {
};

const counters = {
}

const sleepRand = R.curry((min, max, dataTap) => new Promise(resolve =>
  setTimeout(() => resolve(dataTap), Math.floor(Math.random() * (max - min + 1) + min))));

const emit = (node, key, wrap = {}) => {
  if (!(node in CLOCKS)) {
    CLOCKS[node] = 0;
  }
  ++CLOCKS[node];

  const k = key.toLowerCase();
  if (!(k in counters)) {
    counters[k] = 0;
  }
  ++counters[k];

  //console.log(`real emit: ${k}, ${counters[k]}, ${wrap.lc}`);
  emitter.emit(key, {
    type: `${k}_${counters[k]}`,
    ts: Date.now(),
    lc: CLOCKS[node],
    wrap,
  });
}

const logRec = (data, node) => new Promise((resolve) => {
  //console.log(`${node} got: `, data.type, data.lc);
  return resolve(data);
});

const simulateCommander = (node) => (data) => 
  logRec(data, node)
    .then(sleepRand(0, 100))
    .then(() => emit(node, node, data));

let buffer = [];
let lastLcEmitted = 0;

const emit2 = (key, type, wLc, pType, lc) => {
  setTimeout(() => {
    emitter.emit(key, {
      type,
      pType,
      wLc,
      lc,
    });
  }, 10);
};

const handleConsumer = data => {
    
  const lc = data.wrap.lc;
  // we can emit immediately
  if (lc - lastLcEmitted === 1) {
    emit2('FINAL', data.wrap.type, data.wrap.lc, data.type, data.lc);
    lastLcEmitted = lc;
  }
  // one or more packets missing. buffer current one
  else if (lc - lastLcEmitted > 1) {
    buffer.push(data);
  }  
  
  let oneMore = true;
  while (oneMore) {
    oneMore = false;
    let atLeastOne = false;
    for (let i = 0; i < buffer.length; ++i) {
      if (buffer[i].wrap.lc - lastLcEmitted === 1) {
        emit2('FINAL', buffer[i].wrap.type, buffer[i].wrap.lc, buffer[i].type, buffer[i].lc);
        lastLcEmitted = buffer[i].wrap.lc;
        buffer[i] = null;
        atLeastOne = true;
      }
    }
    if (atLeastOne) {
      buffer = R.filter(x => x != null, buffer);
    }
  }
  if (buffer.length > 50) {
    console.log('---- buffer overflow');
  }
}


let LAST_SEQ=0;

let CHECK_MAP = {}

let orderErrors = 0;
let missErrors = 0;
let nPackets = 0;

const handleFinal = data => {
  const [ type, seq] = data.type.split('_');
  const { pType, lc, wLc } = data;

  if (!CHECK_MAP[seq]) {
    CHECK_MAP[seq] = {};
  }
  if (type === 'sb' && !('sa' in CHECK_MAP[seq])) {
    ++orderErrors;
    console.error("WHOOOOOOOOOOOOOOOOOOOOOOP");
  }
  if (seq - LAST_SEQ > 1) {
    ++missErrors;
    console.error("MISS MISS MISS MISS MISS");
  }
  CHECK_MAP[seq][type] = true;
  LAST_SEQ = Math.max(seq, LAST_SEQ);
  ++nPackets;
  console.log(pType.split('_')[0].toUpperCase(), type, seq, `- lc: ${lc} wLc: ${wLc} \t\t\torderErrors/missErrors/n: ${orderErrors}/${missErrors}/${nPackets}`);
}

const VALS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'
];

const startShift = (ms) => {
  setTimeout(() => {
    VALS.forEach(val => emit('S', 'S' + val));
    startShift(((min, max) => Math.floor(Math.random() * (max - min + 1) + min))(50, 250));
  }, ms);
};

VALS.forEach(commander => {
  const command = 'S' + commander;
  console.log('hook up', commander, command);
  emitter.on(command, data => sleepRand(1, 1000, data).then(simulateCommander(commander)));
  emitter.on(commander, handleConsumer);
});

emitter.on('FINAL', handleFinal);

/*
// A now delay
emitter.on('SA', data => sleepRand(1, 20, data).then(simulateCommander('A')));

// B random slight delay
emitter.on('SB', data => sleepRand(1, 250, data).then(simulateCommander('B')));

// slight network delay then handle consumer
emitter.on('A', data => handleConsumer(data));
emitter.on('B', data => handleConsumer(data));
*/


startShift(0);
