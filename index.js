const R = require('ramda');
const { EventEmitter } = require('events');

const emitter = new EventEmitter();

let emitATime = 0;
let emitBTime = 0;

const CLOCKS = {
  S: 0,
  A: 0,
  B: 0,
};

const counters = {
  a: 0,
  b: 0,
  sa: 0,
  sb: 0,
}

const sleepRand = R.curry((min, max, dataTap) => new Promise(resolve =>
  setTimeout(() => resolve(dataTap), Math.floor(Math.random() * (max - min + 1) + min))));

const emit = (node, key, wrap = {}) => {
  ++CLOCKS[node];

  const k = key.toLowerCase();
  ++counters[k];

  emitter.emit(key, {
    type: `${k}_${counters[k]}`,
    ts: Date.now(),
    lc: CLOCKS[node],
    wrap,
  });
}

const logRec = (data, node) => new Promise((resolve) => {
  const auxInfo = {
    now: Date.now(),
  };
  //console.log(`${node} got: `, data.type);
  return resolve(data);
});

const simulateCommander = (node) => (data) => 
  logRec(data, node)
    .then(sleepRand(0, 100))
    .then(() => emit(node, node, data));

let buffer = [];
let lastLc = 0;
const handleConsumer = data => {
  //console.log(data.type, 'lastLc: ', lastLc, 'lc: ', data.wrap.lc);

  const lc = data.wrap.lc;
  // a packet missing. buffer it
  if (lc - lastLc > 1) {
    buffer.push(data);
    lastLc = lc;
  // packet that was missing. emit
  }  else if (lc < lastLc) {
    const oldData = buffer.pop();
    emit('C', 'C', data);
    emit('C', 'C', oldData);
  } else {
    lastLc = lc;
    emit('C', 'C', data);
  }
}

// A now delay
emitter.on('SA', data => sleepRand(0, 0, data).then(simulateCommander('A')));

// B random slight delay
emitter.on('SB', data => sleepRand(0, 50, data).then(simulateCommander('B')));

// slight network delay then handle consumer
emitter.on('A', data => sleepRand(0, 100, data).then(handleConsumer));
emitter.on('B', data => sleepRand(0, 100, data).then(handleConsumer));

let LAST_SEQ=0;

let CHECK_MAP = {}

let errors = 0;
let nPackets = 0;

const handleFinal = data => {
  const [type, seq] = data.wrap && data.wrap.type ? data.wrap.type.split('_') : ['unknown', 0];

  if (!CHECK_MAP[seq]) {
    CHECK_MAP[seq] = {};
  }
  if ((type === 'a' && 'b' in CHECK_MAP[seq]) || (seq - LAST_SEQ > 1)) {
    ++errors;
    console.error("WHOOOOOOOOOOOOOOOOOOOOOOP");
  }
  CHECK_MAP[seq][type] = true;
  LAST_SEQ = seq;
  ++nPackets;
  console.log(type, seq, `e/n: ${errors}/${nPackets}`);
}

emitter.on('C', handleFinal);

setInterval(() => {
  emit('S', 'SA');
  emit('S', 'SB');
}, 50);
