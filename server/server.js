import http from 'node:http'
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.PORT) || 10000

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')

  if (req.url === '/health') {
    res.writeHead(200)
    res.end(
      JSON.stringify({
        ok: true,
        service: 'StumbleSketch Multiplayer',
        rooms: rooms.size,
      }),
    )
    return
  }

  res.writeHead(200)
  res.end(
    JSON.stringify({
      ok: true,
      service: 'StumbleSketch Multiplayer Server',
    }),
  )
})

const wss = new WebSocketServer({
  server,
  path: '/ws',
})

const rooms = new Map()

const WORDS = [
  'Fall Guys',
  'Hex-A-Gone',
  'Block Dash',
  'Lily Leapers',
  'Door Dash',
  'Slime Climb',
  'Jump Club',
  'Perfect Match',
  'Tip Toe',
  'Blast Ball',
  'Big Fans',
  'Roll Out',
  'Fruit Chute',
  'See Saw',
  'The Whirlygig',
  'Rope Swing',
  'Snowball Survival',
  'Volleyfall',
  'Pipe Dream',
  'Party Promenade',
]

const PLAYER_COLORS = [
  '#ff4f8b',
  '#6c63ff',
  '#00c2ff',
  '#ffb020',
  '#35d07f',
  '#ff6b4a',
  '#a855f7',
  '#22d3ee',
  '#f43f5e',
  '#84cc16',
]

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

  let code

  do {
    code = ''

    for (let i = 0; i < 6; i++) {
      code += chars[
        Math.floor(Math.random() * chars.length)
      ]
    }
  } while (rooms.has(code))

  return code
}

function randomColor() {
  return PLAYER_COLORS[
    Math.floor(Math.random() * PLAYER_COLORS.length)
  ]
}

function randomWords(amount = 3) {
  const copy = [...WORDS]

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))

    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }

  return copy.slice(0, amount)
}

function send(ws, type, data = {}) {
  if (ws.readyState !== ws.OPEN) return

  ws.send(
    JSON.stringify({
      type,
      ...data,
    }),
  )
}

function broadcast(room, type, data = {}) {
  for (const player of room.players.values()) {
    send(player.ws, type, data)
  }
}

function broadcastPlayers(room) {
  const players = [...room.players.values()].map(
    (player) => ({
      id: player.id,
      name: player.name,
      score: player.score,
      color: player.color,
      ready: player.ready,
      isDrawer:
        player.id === room.drawerId,
      isHost:
        player.id === room.hostId,
    }),
  )

  broadcast(room, 'players', {
    players,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    roundTime: room.roundTime,
    maxRounds: room.maxRounds,
  })
}

function getRoomState(room) {
  return {
    roomCode: room.code,
    phase: room.phase,
    round: room.round,
    drawerId: room.drawerId,
    timeLeft: room.timeLeft,
    word: room.phase === 'drawing'
      ? null
      : room.word,
    wordChoices:
      room.phase === 'choosing' &&
      room.drawerId
        ? room.wordChoices
        : [],
  }
}

function broadcastState(room) {
  for (const player of room.players.values()) {
    const state = {
      ...getRoomState(room),
      isDrawer:
        player.id === room.drawerId,
    }

    send(player.ws, 'state', state)
  }
}

function createRoom() {
  const code = generateRoomCode()

  const room = {
    code,
    players: new Map(),

    phase: 'lobby',

    round: 0,
    drawerId: null,

    word: null,
    wordChoices: [],

    timeLeft: 60,

    timer: null,
    revealTimer: null,

    guessed: new Set(),
    guessOrder: [],
    guessPoints: new Map(),
    drawHistory: [],
  }

  rooms.set(code, room)

  return room
}

function clearRoomTimers(room) {
  if (room.timer) {
    clearInterval(room.timer)
    room.timer = null
  }

  if (room.revealTimer) {
    clearInterval(room.revealTimer)
    room.revealTimer = null
  }
}

function deleteRoomIfEmpty(room) {
  if (room.players.size !== 0) return

  clearRoomTimers(room)
  rooms.delete(room.code)
}

function startGame(room) {
  if (room.players.size < 1) return

  room.round = 1

  room.drawerId =
    [...room.players.keys()][0]

  startChoosing(room)
}

function startChoosing(room) {
  clearRoomTimers(room)

  room.phase = 'choosing'
  room.word = null
  room.drawHistory = []
  room.wordChoices = randomWords(3)
  room.timeLeft = 8
  room.guessed.clear()
  room.guessOrder = []
  room.guessPoints.clear()

  broadcastState(room)
  broadcastPlayers(room)

  room.timer = setInterval(() => {
  room.timeLeft = Math.max(0, room.timeLeft - 1)

  broadcastState(room)

  if (room.timeLeft <= 0) {
    clearRoomTimers(room)

    const skippedPlayer =
      room.players.get(room.drawerId)

    const skippedName =
      skippedPlayer?.name ?? 'Spieler'

    broadcast(room, 'player-skipped', {
      playerName: skippedName,
    })

    nextRound(room)
  }
}, 1000)
}

function chooseWord(room, playerId, word) {
  if (room.phase !== 'choosing') return
  if (playerId !== room.drawerId) return

  if (!room.wordChoices.includes(word)) {
    return
  }

  clearRoomTimers(room)

  room.word = word
  room.phase = 'drawing'
  room.timeLeft = 60
  room.guessed.clear()
  room.guessOrder = []

  broadcast(room, 'round-started', {
    drawerId: room.drawerId,
    timeLeft: room.timeLeft,
  })

  broadcastState(room)
  broadcastPlayers(room)

  room.timer = setInterval(() => {
    room.timeLeft--

    broadcastState(room)

    if (room.timeLeft <= 0) {
      finishRound(room)
    }
  }, 1000)
}

function calculatePoints(room, playerId) {
  return room.guessPoints.get(playerId) ?? 0
}

function handleCorrectGuess(room, player) {
  if (room.guessed.has(player.id)) {
    return
  }

  // 60 Sekunden Startzeit - aktuelle Restzeit
  // = tatsächlich vergangene Sekunden
  const elapsedSeconds =
    60 - room.timeLeft

  // 1000 Punkte Startwert,
  // pro vergangener Sekunde 5 Punkte weniger.
  const points = Math.max(
    0,
    1000 - elapsedSeconds * 5,
  )

  room.guessed.add(player.id)
  room.guessOrder.push(player.id)

  // EXAKT DIESE PUNKTZAHL SPEICHERN
  room.guessPoints.set(
    player.id,
    points,
  )

  // EXAKT DIESE PUNKTZAHL aufs Konto
  player.score += points

  console.log(
    `[PUNKTE] ${player.name}:`,
    `${points} Punkte`,
    `(${elapsedSeconds}s vergangen)`,
  )

  broadcast(room, 'correct-guess', {
    playerId: player.id,
    playerName: player.name,
    points,
    position: room.guessOrder.length,
  })

  broadcastPlayers(room)

  const guessers =
    room.players.size - 1

  if (
    room.guessed.size >=
    Math.max(0, guessers)
  ) {
    finishRound(room)
  }
}

function finishRound(room) {
  if (room.phase !== 'drawing') return

  clearRoomTimers(room)

  room.phase = 'reveal'
  room.timeLeft = 6

  broadcast(room, 'round-finished', {
    word: room.word,
    rankings: room.guessOrder.map(
      (playerId, index) => {
        const player = room.players.get(playerId)

        return {
          playerId,
          playerName: player?.name ?? 'Spieler',
          points: calculatePoints(room, playerId),
          position: index + 1,
        }
      },
    ),
  })

  broadcastState(room)
  broadcastPlayers(room)

  room.revealTimer = setInterval(() => {
    room.timeLeft = Math.max(0, room.timeLeft - 1)

    broadcastState(room)

    if (room.timeLeft <= 0) {
      clearRoomTimers(room)
      nextRound(room)
    }
  }, 1000)
}

function nextRound(room) {
  clearRoomTimers(room)

  const playerIds = [
    ...room.players.keys(),
  ]

  if (!playerIds.length) {
    deleteRoomIfEmpty(room)
    return
  }

  const currentIndex =
    playerIds.indexOf(room.drawerId)

  const nextIndex =
    currentIndex >= 0
      ? (currentIndex + 1) % playerIds.length
      : 0

  // Nächster Zeichner
  room.drawerId =
    playerIds[nextIndex]

  // EXAKT EINMAL neue Runde
  room.round += 1

  // Alte Rundendaten löschen
  room.word = null
  room.wordChoices = []
  room.drawHistory = []
  room.timeLeft = 8
  room.guessed.clear()
  room.guessOrder = []
  room.guessPoints.clear()

  // Neue Runde starten
  startChoosing(room)
}

function handleJoin(ws, message) {
  const {
    roomCode,
    playerId,
    name,
  } = message

  if (
    typeof roomCode !== 'string' ||
    typeof playerId !== 'string' ||
    typeof name !== 'string'
  ) {
    send(ws, 'error', {
      message: 'Ungültige Beitrittsdaten.',
    })

    return
  }

  const code =
    roomCode.trim().toUpperCase()

  const room = rooms.get(code)

  if (!room) {
    send(ws, 'error', {
      message:
        'Dieser Raum existiert nicht.',
    })

    return
  }

  if (room.players.size >= 12) {
    send(ws, 'error', {
      message:
        'Der Raum ist bereits voll.',
    })

    return
  }

  const cleanName =
    name.trim().slice(0, 16)

  if (!cleanName) {
    send(ws, 'error', {
      message:
        'Bitte gib einen Namen ein.',
    })

    return
  }

  if (
    room.players.has(playerId)
  ) {
    const oldPlayer =
      room.players.get(playerId)

    oldPlayer.ws = ws

    ws.roomCode = code
    ws.playerId = playerId

    send(ws, 'joined', {
  roomCode: code,
  playerId,
})

broadcastPlayers(room)
broadcastState(room)

if (
  room.phase === 'drawing' &&
  room.drawerId &&
  room.drawHistory.length > 0
) {
  send(ws, 'draw-history', {
    strokes: room.drawHistory,
  })
}

    return
  }

  const player = {
    id: playerId,
    name: cleanName,
    score: 0,
    ready: false,
    color: randomColor(),
    ws,
  }

  room.players.set(
  playerId,
  player,
)

ws.roomCode = code
ws.playerId = playerId

send(ws, 'joined', {
  roomCode: code,
  playerId,
})

broadcast(room, 'player-joined', {
  playerName: cleanName,
})

broadcastPlayers(room)
broadcastState(room)

if (
  room.phase === 'drawing' &&
  room.drawerId &&
  room.drawHistory.length > 0
) {
  send(ws, 'draw-history', {
    strokes: room.drawHistory,
  })
}
}

function handleCreate(ws, message) {
  console.log(
    'CREATE-ROOM VOM CLIENT:',
    message,
  )

  const {
    playerId,
    name,
    maxPlayers,
    roundTime,
    maxRounds,
  } = message

  const cleanName =
    typeof name === 'string'
      ? name.trim().slice(0, 16)
      : ''

  if (
    typeof playerId !== 'string' ||
    !cleanName
  ) {
    send(ws, 'error', {
      message:
        'Name und Spieler-ID sind erforderlich.',
    })

    return
  }

  const room = createRoom()

  room.maxPlayers =
    Number(maxPlayers) || 8

  room.roundTime =
    Number(roundTime) || 60

  room.maxRounds =
    Number(maxRounds) || 5

  const player = {
    id: playerId,
    name: cleanName,
    score: 0,
    ready: false,
    color: randomColor(),
    ws,
  }

  room.players.set(
    playerId,
    player,
  )

  // Der Ersteller ist automatisch Host.
  room.hostId = playerId

  ws.roomCode = room.code
  ws.playerId = playerId

  send(ws, 'room-created', {
    roomCode: room.code,
    playerId,
  })

  broadcastPlayers(room)
  broadcastState(room)
}

function handleMessage(ws, message) {
  if (!message?.type) return

  if (
    message.type === 'create-room'
  ) {
    handleCreate(ws, message)
    return
  }

  if (
    message.type === 'join-room'
  ) {
    handleJoin(ws, message)
    return
  }

  const room =
    rooms.get(ws.roomCode)

  if (!room) {
    send(ws, 'error', {
      message:
        'Du bist keinem Raum beigetreten.',
    })

    return
  }

  const player =
    room.players.get(ws.playerId)

  if (!player) return

  if (
  message.type === 'start-game'
) {
  if (
    room.players.size >= 2 &&
    player.id === room.hostId &&
    room.phase === 'lobby'
  ) {
    startGame(room)
  }

  return
}

  if (
    message.type === 'choose-word'
  ) {
    chooseWord(
      room,
      player.id,
      message.word,
    )

    return
  }

  if (
    message.type === 'chat'
  ) {
    if (
      typeof message.text !== 'string'
    ) {
      return
    }

    const text =
      message.text
        .trim()
        .slice(0, 100)

    if (!text) return

    if (
  room.phase === 'drawing' &&
  player.id !== room.drawerId &&
  !room.guessed.has(player.id)
) {
  // EXAKT RICHTIG
  if (
    normalize(text) ===
    normalize(room.word)
  ) {
    handleCorrectGuess(
      room,
      player,
    )
    return
  }

  // SEHR NAH DRAN
  if (
    isVeryCloseGuess(
      text,
      room.word,
    )
  ) {
    send(player.ws, 'close-guess', {
      text,
    })

    return
  }
}

    broadcast(room, 'chat', {
      playerId: player.id,
      playerName: player.name,
      text,
    })

    return
  }

  if (message.type === 'draw') {
  if (
    room.phase !== 'drawing' ||
    player.id !== room.drawerId
  ) {
    return
  }

  room.drawHistory.push(message.data)

  broadcast(room, 'draw', {
    playerId: player.id,
    data: message.data,
  })

  return
}

  if (message.type === 'clear-canvas') {
  if (
    room.phase !== 'drawing' ||
    player.id !== room.drawerId
  ) {
    return
  }

  room.drawHistory = []

  broadcast(room, 'clear-canvas')

  return
}
}

function normalize(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      '',
    )
    .replace(
      /[^\p{L}\p{N}]/gu,
      '',
    )
}

function isVeryCloseGuess(guess, word) {
  const a = normalize(guess)
  const b = normalize(word)

  if (!a || !b) return false

  // Exakt richtig -> KEIN "sehr nah"
  if (a === b) return false

  // Wenn die Länge sich um mehr als 1 unterscheidet,
  // kann es nicht nur 1 Buchstabe zu viel/zu wenig sein.
  if (Math.abs(a.length - b.length) > 1) {
    return false
  }

  // Levenshtein-Distanz berechnen
  const matrix = Array.from(
    { length: a.length + 1 },
    () => Array(b.length + 1).fill(0),
  )

  for (let i = 0; i <= a.length; i++) {
    matrix[i][0] = i
  }

  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }

  return matrix[a.length][b.length] === 1
}

wss.on('connection', (ws) => {
  ws.isAlive = true

  ws.on('pong', () => {
    ws.isAlive = true
  })

  ws.on('message', (raw) => {
    try {
      const message =
        JSON.parse(raw.toString())

      handleMessage(
        ws,
        message,
      )
    } catch {
      send(ws, 'error', {
        message:
          'Ungültige Server-Nachricht.',
      })
    }
  })

  ws.on('close', () => {
  const room =
    rooms.get(ws.roomCode)

  if (!room) return

  const player =
    room.players.get(ws.playerId)

  if (!player || player.ws !== ws) {
    return
  }

  const leavingPlayerId =
    ws.playerId

  const leavingPlayerName =
    player.name

  // Position des Spielers merken,
  // BEVOR er gelöscht wird.
  const playerIds =
    [...room.players.keys()]

  const leavingIndex =
    playerIds.indexOf(leavingPlayerId)

  const wasDrawer =
    room.drawerId === leavingPlayerId

  // Spieler entfernen
  room.players.delete(
    leavingPlayerId,
  )

  broadcast(room, 'player-left', {
    playerName:
      leavingPlayerName,
  })

  // Wenn NICHT der Zeichner gegangen ist:
  // alles normal weiterlaufen lassen.
  if (!wasDrawer) {
    broadcastPlayers(room)
    broadcastState(room)
    deleteRoomIfEmpty(room)
    return
  }

  // Der aktuelle Zeichner ist gegangen.
  clearRoomTimers(room)

  room.phase = 'lobby'
  room.drawerId = null
  room.word = null
  room.wordChoices = []
  room.drawHistory = []
  room.timeLeft = 8
  room.guessed.clear()
  room.guessOrder = []
  room.guessPoints.clear()

  // Sind noch Spieler da?
  const remainingPlayers =
    [...room.players.keys()]

  if (remainingPlayers.length === 0) {
    deleteRoomIfEmpty(room)
    return
  }

  // Der Spieler NACH dem verlassenen Spieler
  // wird der nächste Zeichner.
  const nextIndex =
    leavingIndex %
    remainingPlayers.length

  room.drawerId =
    remainingPlayers[nextIndex]

  // Neue Runde
  room.round += 1

  broadcastPlayers(room)
  broadcastState(room)

  // SOFORT neue Wortauswahl für den nächsten Zeichner
  startChoosing(room)

  })
})

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate()
      continue
    }

    ws.isAlive = false
    ws.ping()
  }
}, 30000)

function shutdown() {
  clearInterval(heartbeat)

  for (const room of rooms.values()) {
    clearRoomTimers(room)
  }

  wss.close()
  server.close(() => {
    process.exit(0)
  })
}

process.on(
  'SIGTERM',
  shutdown,
)

process.on(
  'SIGINT',
  shutdown,
)

server.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `StumbleSketch Server online auf Port ${PORT}`,
    )
  },
)