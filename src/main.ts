import './style.css'

type Player = {
  id: string
  name: string
  score: number
  ready: boolean
  color: string
}

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

const COLORS = [
  '#ff4f8b',
  '#6c63ff',
  '#00c2ff',
  '#ffb020',
  '#35d07f',
  '#ff6b4a',
]

const app = document.querySelector<HTMLDivElement>('#app')!

const playerId =
  localStorage.getItem('stumblesketch-player-id') ??
  crypto.randomUUID()

localStorage.setItem('stumblesketch-player-id', playerId)

let playerName =
  localStorage.getItem('stumblesketch-player-name') ?? ''

let roomCode = ''
let currentWord = ''
let drawerId = ''
let round = 1
let timeLeft = 60
let timer: number | undefined
let gamePhase = 'lobby'

let players: Player[] = []

let socket: WebSocket | null = null

const IS_DISCORD = window.location.hostname.includes('discordsays.com')

const SERVER_URL = IS_DISCORD
  ? `wss://${window.location.hostname}/.proxy/ws/ws`
  : 'wss://stumblesketch-server.onrender.com/ws'

function sendToServer(
  type: string,
  data: Record<string, unknown> = {},
) {
  if (
    !socket ||
    socket.readyState !== WebSocket.OPEN
  ) {
    return
  }
console.log('SENDE AN SERVER:', type, data)
  socket.send(
    JSON.stringify({
      type,
      ...data,
    }),
  )
}

function connectToServer() {
  if (socket) return

  socket = new WebSocket(SERVER_URL)

  socket.addEventListener('open', () => {
    console.log('Mit Multiplayer-Server verbunden.')
  })

  socket.addEventListener('message', (event) => {
  try {
    const message = JSON.parse(event.data)

    if (message.type === 'close-guess') {
  addSystemMessage(
    `${message.text} ist sehr nah dran am gesuchten Wort!`,
    'close-guess',
  )
  return
}

    // 🟢 SPIELER BEIGETRETEN
    if (message.type === 'player-joined') {
      addSystemMessage(
        `${message.playerName} ist dem Raum beigetreten.`,
        'join',
      )
      return
    }

    // 🔴 SPIELER VERLASSEN
    if (message.type === 'player-left') {
      addSystemMessage(
        `${message.playerName} hat den Raum verlassen.`,
        'leave',
      )
      return
    }

    // 🟡 SPIELER GESKIPPED
    if (message.type === 'player-skipped') {
      addSystemMessage(
        `${message.playerName} wurde geskipped, da kein Wort ausgewählt wurde.`,
        'skip',
      )
      return
    }

    // ⬇️ AB HIER DEIN KOMPLETTER ALTER CODE

    if (message.type === 'room-created') {
      roomCode = String(message.roomCode ?? '')

      const button =
        document.querySelector<HTMLButtonElement>('#create-room')

      if (button) {
        button.disabled = false
        button.textContent = '🎮 Raum erstellen'
      }

      console.log('RAUM ERHALTEN:', roomCode)
      renderGame()
      showToast(`Raum ${roomCode} erstellt.`)
      return
    }

    if (message.type === 'joined') {
      roomCode = String(message.roomCode ?? '')

      console.log('RAUM BEIGETRETEN:', roomCode)

      renderGame()
      return
    }

    // ⚠️ ALLES, WAS BEI DIR NACH "joined" KAM,
    // MUSS HIER WEITERHIN STEHEN.

      if (message.type === 'players') {
        players = message.players.map(
          (player: Player & { isDrawer?: boolean }) => ({
            id: player.id,
            name: player.name,
            score: player.score,
            ready: player.ready,
            color: player.color,
          }),
        )

        const drawer =
          message.players.find(
            (player: Player & { isDrawer?: boolean }) =>
              player.isDrawer,
          )

        if (drawer) {
          drawerId = drawer.id
        }

        renderPlayers()
        return
      }

      if (message.type === 'draw') {
        if (message.playerId === playerId) {
          return
        }

        drawRemoteStroke(message.data)
        return
      }


if (message.type === 'draw-history') {
  if (!Array.isArray(message.strokes)) return

  const drawHistory = message.strokes

  requestAnimationFrame(() => {
    for (const stroke of drawHistory) {
      drawRemoteStroke(stroke)
    }
  })

  return
}

      if (message.type === 'clear-canvas') {
        clearCanvas(false)
        return
      }

      if (message.type === 'chat') {
        addMessage(
          message.playerName,
          message.text,
        )
        return
      }

      if (message.type === 'correct-guess') {
  const player =
    players.find(
      (item) =>
        item.id === message.playerId,
    )

  if (player) {
    player.score += message.points
  }

  correctGuesses.push(
    message.playerId,
  )

  renderPlayers()

  const messages =
    document.querySelector<HTMLDivElement>(
      '#messages',
    )

  if (messages) {
    const item =
      document.createElement('div')

    item.className =
      'correct-message'

    item.textContent =
      `🎉 ${message.playerName} ist Platz ${message.position}! +${message.points} Punkte`

    messages.appendChild(item)

    messages.scrollTop =
      messages.scrollHeight
  }

  if (message.playerId === playerId) {
    showToast(
      `Richtig! Platz ${message.position} · +${message.points}`,
    )
  }

  return
}

      if (message.type === 'round-started') {
  drawerId = message.drawerId
  roundFinished = false
  correctGuesses = []
  timeLeft = message.timeLeft

  clearCanvas(false)

  const timerElement =
    document.querySelector<HTMLDivElement>(
      '#timer',
    )

  if (timerElement) {
    timerElement.textContent =
      String(timeLeft)
  }

  const wordElement =
    document.querySelector<HTMLElement>(
      '#word',
    )

  if (wordElement) {
    wordElement.textContent =
      drawerId === playerId
        ? currentWord
        : '???'
  }

  return
}

      if (message.type === 'round-finished') {
  currentWord = message.word
  roundFinished = true

  clearInterval(timer)

  const modal =
    document.querySelector<HTMLDivElement>(
      '#round-result',
    )

  const word =
    document.querySelector<HTMLElement>(
      '#result-word',
    )

  const resultPlayers =
    document.querySelector<HTMLDivElement>(
      '#result-players',
    )

  if (word) {
    word.textContent = message.word
  }

  if (resultPlayers) {
    resultPlayers.innerHTML =
      message.rankings
        .map(
          (ranking: {
            playerId: string
            playerName: string
            points: number
            position: number
          }) => `
            <div class="result-player">

              <div class="result-rank">
                #${ranking.position}
              </div>

              <div class="result-avatar">
                ${escapeHtml(
                  ranking.playerName
                    .charAt(0)
                    .toUpperCase(),
                )}
              </div>

              <div class="result-name">
                <strong>
                  ${escapeHtml(
                    ranking.playerName,
                  )}
                </strong>

                <span>
                  +${ranking.points} Punkte
                </span>
              </div>

            </div>
          `,
        )
        .join('')
  }

  modal?.classList.remove('hidden')

  return
}

      if (message.type === 'state') {
  roomCode = String(message.roomCode ?? '')
  round = Number(message.round ?? 1)
  drawerId = message.drawerId
  timeLeft = Number(message.timeLeft ?? 0)
  gamePhase = message.phase

    updateDrawingTools()

  const timerElement =
    document.querySelector<HTMLDivElement>(
      '#timer',
    )

  if (timerElement) {
    timerElement.textContent =
      String(Math.max(0, timeLeft))
  }

  const roundElement =
    document.querySelector<HTMLElement>(
      '.round-info strong',
    )

  if (roundElement) {
    roundElement.textContent =
      String(round)
  }


const waitingModal =
  document.querySelector<HTMLDivElement>(
    '#word-waiting',
  )

const waitingPlayer =
  document.querySelector<HTMLElement>(
    '#word-waiting-player',
  )

const choosingPlayer =
  players.find(
    (player) => player.id === drawerId,
  )

if (
  message.phase === 'choosing' &&
  drawerId !== playerId
) {
  if (waitingModal) {
    waitingModal.classList.remove('hidden')
  }

  if (waitingPlayer) {
    waitingPlayer.textContent =
      choosingPlayer?.name ?? 'Spieler'
  }
} else {
  waitingModal?.classList.add('hidden')
}

  // WORTAUSWAHL
  if (
    message.phase === 'choosing' &&
    drawerId === playerId &&
    Array.isArray(message.wordChoices)
  ) {
    const modal =
      document.querySelector<HTMLDivElement>(
        '#word-choice',
      )

    const options =
      document.querySelector<HTMLDivElement>(
        '#word-options',
      )

    const choiceTimer =
      document.querySelector<HTMLElement>(
        '#word-choice-timer',
      )

    if (!modal || !options) {
      return
    }

    modal.classList.remove('hidden')

    if (choiceTimer) {
      choiceTimer.textContent =
        String(
          Math.max(
            0,
            message.timeLeft ?? 8,
          ),
        )
    }

    options.innerHTML =
      message.wordChoices
        .map(
          (word: string) => `
            <button
              class="word-option"
              data-word="${escapeHtml(word)}"
            >
              <span>🎨</span>
              <strong>${escapeHtml(word)}</strong>
            </button>
          `,
        )
        .join('')

    options
      .querySelectorAll<HTMLButtonElement>(
        '.word-option',
      )
      .forEach((button) => {
        button.addEventListener(
          'click',
          () => {
            const word =
              button.dataset.word

            if (!word) {
              return
            }

            currentWord = word

            sendToServer(
              'choose-word',
              {
                word,
              },
            )

            modal.classList.add('hidden')

            const wordElement =
              document.querySelector<HTMLElement>(
                '#word',
              )

            if (wordElement) {
              wordElement.textContent =
                currentWord
            }
          },
        )
      })
  } else {
    const modal =
      document.querySelector<HTMLDivElement>(
        '#word-choice',
      )

    modal?.classList.add('hidden')
  }

  // ZEICHNEN
  if (message.phase === 'drawing') {
    roundFinished = false

    const wordChoiceModal =
      document.querySelector<HTMLDivElement>(
        '#word-choice',
      )

    wordChoiceModal?.classList.add('hidden')

    const resultModal =
      document.querySelector<HTMLDivElement>(
        '#round-result',
      )

    resultModal?.classList.add('hidden')

    const wordElement =
      document.querySelector<HTMLElement>(
        '#word',
      )

    if (wordElement) {
      wordElement.textContent =
        drawerId === playerId
          ? currentWord
          : '???'
    }

    const drawerName =
      document.querySelector<HTMLElement>(
        '#drawer-name',
      )

    const drawer =
      players.find(
        (player) =>
          player.id === drawerId,
      )

    if (drawerName && drawer) {
      drawerName.textContent =
        drawer.name
    }

    if (timerElement) {
      timerElement.textContent =
        String(
          Math.max(
            0,
            message.timeLeft ?? 60,
          ),
        )
    }

    renderPlayers()
  }

  if (message.phase === 'choosing') {
  const resultModal =
    document.querySelector<HTMLDivElement>(
      '#round-result',
    )

  resultModal?.classList.add('hidden')

  const wordChoiceModal =
    document.querySelector<HTMLDivElement>(
      '#word-choice',
    )

  if (
    drawerId === playerId &&
    Array.isArray(message.wordChoices)
  ) {
    wordChoiceModal?.classList.remove('hidden')

    const options =
      document.querySelector<HTMLDivElement>(
        '#word-options',
      )

    const choiceTimer =
      document.querySelector<HTMLElement>(
        '#word-choice-timer',
      )

      if (choiceTimer) {
  choiceTimer.textContent =
    String(
      Math.max(
        0,
        message.timeLeft ?? 8,
      ),
    )
}

    if (choiceTimer) {
      choiceTimer.textContent =
        String(Math.max(0, message.timeLeft ?? 8))
    }

    if (options) {
      options.innerHTML =
        message.wordChoices
          .map(
            (word: string) => `
              <button
                class="word-option"
                data-word="${escapeHtml(word)}"
              >
                <span>🎨</span>
                <strong>${escapeHtml(word)}</strong>
              </button>
            `,
          )
          .join('')

      options
        .querySelectorAll<HTMLButtonElement>(
          '.word-option',
        )
        .forEach((button) => {
          button.addEventListener('click', () => {
            const word = button.dataset.word

            if (!word) return

            currentWord = word

            sendToServer('choose-word', {
              word,
            })

            wordChoiceModal?.classList.add('hidden')
          })
        })
    }
  } else {
    wordChoiceModal?.classList.add('hidden')
  }

  return
}

  if (message.phase === 'reveal') {
  roundFinished = true

  const resultModal =
    document.querySelector<HTMLDivElement>(
      '#round-result',
    )

  resultModal?.classList.remove('hidden')

  const countdown =
    document.querySelector<HTMLElement>(
      '#result-countdown',
    )

  if (countdown) {
    countdown.textContent =
      String(Math.max(0, message.timeLeft ?? 6))
  }

  return
}
return
}

if (message.type === 'player-skipped') {
  const messages =
    document.querySelector<HTMLDivElement>(
      '#messages',
    )

  if (messages) {
    const item =
      document.createElement('div')

    item.className = 'skip-message'

    item.textContent =
      `${message.playerName} wurde geskipped, da kein Wort ausgewählt wurde.`

    messages.appendChild(item)

    messages.scrollTop =
      messages.scrollHeight
  }

  return
}

if (message.type === 'error') {
  showToast(message.message)
  return
}


    } catch (error) {
      console.error(
        'Fehler beim Verarbeiten der Server-Nachricht:',
        error,
      )
    }
  })

  socket.addEventListener('close', () => {
    socket = null

    showToast(
      'Verbindung zum Multiplayer-Server verloren.',
    )
  })

  socket.addEventListener('error', () => {
    showToast(
      'Verbindung zum Multiplayer-Server fehlgeschlagen.',
    )
  })
}

function handleServerMessage(
  message: {
    type?: string
    [key: string]: unknown
  },
) {
  console.log('SERVER:', message)

  switch (message.type) {
    case 'room-created': {
      roomCode = String(message.roomCode ?? '')
      renderGame()
      showToast(`Raum ${roomCode} erstellt.`)
      break
    }

    case 'joined': {
      roomCode = String(message.roomCode ?? '')
      break
    }

    case 'players': {
      const serverPlayers = message.players

      if (!Array.isArray(serverPlayers)) return

      players = serverPlayers.map((player) => {
        const data = player as {
          id?: unknown
          name?: unknown
          score?: unknown
          color?: unknown
          ready?: unknown
        }

        return {
          id: String(data.id ?? ''),
          name: String(data.name ?? 'Spieler'),
          score: Number(data.score ?? 0),
          color: String(data.color ?? '#6c63ff'),
          ready: Boolean(data.ready),
        }
      })

      renderPlayers()
      break
    }

    case 'draw': {
      const data = message.data as {
        x1?: number
        y1?: number
        x2?: number
        y2?: number
        color?: string
        size?: number
      } | undefined

      if (!data) return

      drawRemoteStroke(data)
      break
    }

    case 'clear-canvas': {
      clearCanvas()
      break
    }

    case 'chat': {
      const name = String(
        message.playerName ?? 'Spieler',
      )

      const text = String(
        message.text ?? '',
      )

      addMessage(name, text)
      break
    }

    case 'error': {
      showToast(
        String(
          message.message ?? 'Serverfehler.',
        ),
      )
      break
    }
  }
}


/*
 * Spieler, die diese Runde richtig geraten haben.
 * Die Reihenfolge ist gleichzeitig die Platzierung.
 */
let correctGuesses: string[] = []

let roundFinished = false

const state = {
  brushColor: '#171721',
  brushSize: 7,
  drawing: false,
  lastX: 0,
  lastY: 0,
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function randomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)]
}

function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)]
}

function getThreeWords() {
  const result: string[] = []

  while (result.length < 3) {
    const word = randomWord()

    if (!result.includes(word)) {
      result.push(word)
    }
  }

  return result
}

function createFakePlayers() {
  players = [
    {
      id: playerId,
      name: playerName || 'Du',
      score: 0,
      ready: false,
      color: randomColor(),
    },
  ]
}

function renderLobby() {
  app.innerHTML = `
    <main class="screen lobby-screen">
      <div class="lobby-card">
        <div class="brand">
          <div class="brand-icon">✏️</div>

          <div>
            <h1>STUMBLE<span>SKETCH</span></h1>
            <p>Zeichnen. Raten. Stolpern.</p>
          </div>
        </div>

        <div class="lobby-section">
          <label for="name">Dein Name</label>

          <input
            id="name"
            class="big-input"
            maxlength="16"
            placeholder="z. B. Nico"
            value="${escapeHtml(playerName)}"
            autocomplete="off"
          />
        </div>

        <div class="room-actions">
          <button id="create-room" class="primary-button">
            🎮 Raum erstellen
          </button>

          <div class="divider">
            <span>ODER</span>
          </div>

          <div class="join-row">
            <input
              id="room"
              class="big-input"
              maxlength="6"
              placeholder="ROOM CODE"
              autocomplete="off"
            />

            <button id="join-room" class="secondary-button">
              Beitreten
            </button>
          </div>
        </div>

        <div class="feature-row">
          <div>
            <strong>🎨 Zeichnen</strong>
            <span>Live-Canvas</span>
          </div>

          <div>
            <strong>💬 Raten</strong>
            <span>Chat & Punkte</span>
          </div>

          <div>
            <strong>🏆 Gewinnen</strong>
            <span>Mehr Punkte</span>
          </div>
        </div>
      </div>
    </main>
  `

  const nameInput =
    document.querySelector<HTMLInputElement>('#name')!

  nameInput.addEventListener('input', () => {
    playerName = nameInput.value.trim()

    localStorage.setItem(
      'stumblesketch-player-name',
      playerName,
    )
  })

 document
  .querySelector<HTMLButtonElement>('#create-room')!
  .addEventListener('click', () => {
    console.log('CREATE ROOM BUTTON GEDRÜCKT')

    if (!validateName()) return

    const button =
      document.querySelector<HTMLButtonElement>('#create-room')

    if (!button) return

    // Sofort deaktivieren
    button.disabled = true
    button.textContent = '⏳ Server wird gestartet...'

    connectToServer()

    const waitForConnection = window.setInterval(() => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return
      }

      clearInterval(waitForConnection)

      console.log('SENDE CREATE-ROOM JETZT')

      sendToServer('create-room', {
        playerId,
        name: playerName,
      })
    }, 50)
  })

  document
    .querySelector<HTMLButtonElement>('#join-room')!
    .addEventListener('click', () => {
      if (!validateName()) return

      const code =
  document
    .querySelector<HTMLInputElement>('#room')!
    .value
    .trim()
    .toUpperCase()

if (code.length !== 6) {
  showToast('Der Raum-Code muss 6 Zeichen haben.')
  return
}

roomCode = code

connectToServer()

const waitForConnection = window.setInterval(() => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return
  }

  clearInterval(waitForConnection)

  sendToServer('join-room', {
    roomCode,
    playerId,
    name: playerName,
  })
}, 50)
    })
}

function validateName() {
  if (!playerName.trim()) {
    showToast('Gib zuerst deinen Namen ein.')
    return false
  }

  if (playerName.length > 16) {
    showToast('Der Name darf maximal 16 Zeichen haben.')
    return false
  }

  return true
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

  let code = ''

  do {
    code = Array.from(
      { length: 6 },
      () =>
        chars[
          Math.floor(
            Math.random() * chars.length,
          )
        ],
    ).join('')
  } while (code === roomCode)

  return code
}

function startGame() {
  round = 1
  roundFinished = false
  currentWord = ''
  correctGuesses = []

  renderGame()
}

function renderGame() {
  app.innerHTML = `
    <main class="game">
      <header class="topbar">
        <div class="brand small">
          <div class="brand-icon">✏️</div>

          <div>
            <h1>STUMBLE<span>SKETCH</span></h1>
          </div>
        </div>

        <div class="room-badge">
  RAUM
  <strong>${escapeHtml(roomCode)}</strong>

  <button
  id="copy-room-code"
  type="button"
  title="Raumcode kopieren"
>
  📋
</button>
</div>


        <div class="round-info">
          <span>RUNDE</span>
          <strong>${round}</strong>
        </div>
      </header>

      <section class="game-layout">

        <div class="main-column">

          <div class="game-status">
            <div>
              <span class="eyebrow">JETZT ZEICHNET</span>

              <strong id="drawer-name">
                ${escapeHtml(playerName)}
              </strong>
            </div>

            <div class="timer" id="timer">
              60
            </div>

            <div class="word-box">
              <span>DEIN WORT</span>

              <strong id="word">
                ${currentWord
                  ? escapeHtml(currentWord)
                  : 'Wort auswählen'}
              </strong>
            </div>
          </div>

          <div class="canvas-card">
            <canvas id="canvas"></canvas>

            <div
  class="canvas-tools"
  id="canvas-tools"
  ${drawerId === playerId && gamePhase === 'drawing' ? '' : 'hidden'}
>

              <div class="colors">

                <input
                  id="custom-color"
                  class="color-picker"
                  type="color"
                  value="${state.brushColor}"
                  title="Eigene Farbe auswählen"
                />

                <button
                  class="color active"
                  data-color="#171721"
                  style="background:#171721"
                  title="Schwarz"
                ></button>

                <button
                  class="color"
                  data-color="#ffffff"
                  style="background:#ffffff"
                  title="Weiß"
                ></button>

                <button
                  class="color"
                  data-color="#ff4f8b"
                  style="background:#ff4f8b"
                  title="Pink"
                ></button>

                <button
                  class="color"
                  data-color="#6c63ff"
                  style="background:#6c63ff"
                  title="Lila"
                ></button>

                <button
                  class="color"
                  data-color="#00c2ff"
                  style="background:#00c2ff"
                  title="Blau"
                ></button>

                <button
                  class="color"
                  data-color="#35d07f"
                  style="background:#35d07f"
                  title="Grün"
                ></button>

                <button
                  class="color"
                  data-color="#ffb020"
                  style="background:#ffb020"
                  title="Gelb"
                ></button>

              </div>

              <label class="brush">
                Größe

                <input
                  id="brush-size"
                  type="range"
                  min="2"
                  max="30"
                  value="${state.brushSize}"
                />
              </label>

              <button id="clear" class="tool-button">
                🗑️ Löschen
              </button>
            </div>
          </div>
        </div>

        <aside class="sidebar">

          <section class="panel players-panel">
            <div class="panel-title">
              <span>SPIELER</span>

              <strong id="player-count">
                ${players.length}
              </strong>
            </div>

            <div id="players"></div>
          </section>

          <section class="panel chat-panel">

            <div class="panel-title">
              <span>RATEN</span>

              <span class="online-dot">
                ● LIVE
              </span>
            </div>

            <div id="messages" class="messages"></div>

            <form id="guess-form" class="guess">

  <input
    id="guess"
    maxlength="60"
    placeholder="${
      drawerId === playerId
        ? 'Du zeichnest gerade'
        : 'Was ist das?'
    }"
    autocomplete="off"
    ${drawerId === playerId ? 'disabled' : ''}
  />

  <button
    type="submit"
    ${drawerId === playerId ? 'disabled' : ''}
  >
    ➤
  </button>

</form>

          </section>
        </aside>
      </section>
    </main>

    <div id="toast" class="toast"></div>

    <div id="word-choice" class="modal-backdrop">
      <div class="word-choice-card">

        <div class="choice-icon">✏️</div>

        <span class="eyebrow">
          RUNDE ${round}
        </span>

        <h2>Wähle dein Wort</h2>

        <p>
          Du hast drei Möglichkeiten.
          Die anderen Spieler dürfen dein Wort nicht sehen.
        </p>

        <div id="word-choice-timer">8</div>

<div id="word-options" class="word-options"></div>

      </div>
    </div>

    <div
  id="word-waiting"
  class="modal-backdrop hidden"
>
  <div class="word-choice-card">
    <div class="choice-icon">✏️</div>

    <span class="eyebrow">
      WORTAUSWAHL
    </span>

    <h2>
      <span id="word-waiting-player">
        Spieler
      </span>
      wählt gerade ein Wort aus.
    </h2>

    <p>
      Bitte warte einen Moment, bis das Wort ausgewählt wurde.
    </p>

    <div class="word-waiting-loader">
      <span></span>
      <span></span>
      <span></span>
    </div>
  </div>
</div>

    <div id="round-result" class="modal-backdrop hidden">
      <div class="result-card">

        <div class="choice-icon">🏆</div>

        <span class="eyebrow">
          RUNDE ${round} BEENDET
        </span>

        <h2>Das war's!</h2>

        <div class="revealed-word">
          Das Wort war:
          <strong id="result-word"></strong>
        </div>

        <div id="result-players" class="result-players"></div>

        <div class="next-round-countdown">
          Nächste Runde in
          <strong id="result-countdown">6</strong>
        </div>

      </div>
    </div>
  `

setupCanvas()
setupTools()
setupChat()
renderPlayers()
setupCopyRoomCode()
updateDrawingTools()

}

function updateDrawingTools() {
  const tools =
    document.querySelector<HTMLDivElement>(
      '#canvas-tools',
    )

  if (!tools) return

  console.log(
    'DRAWING TOOLS:',
    {
      playerId,
      drawerId,
      gamePhase,
      amDrawer:
        drawerId === playerId &&
        gamePhase === 'drawing',
    },
  )

  const amDrawer =
    drawerId === playerId &&
    gamePhase === 'drawing'

  if (amDrawer) {
    tools.removeAttribute('hidden')
  } else {
    tools.setAttribute('hidden', 'true')
  }
}

function setupCopyRoomCode() {
  const button =
    document.querySelector<HTMLButtonElement>(
      '#copy-room-code',
    )

  if (!button) return

  button.addEventListener('click', async () => {
    const code = String(roomCode ?? '').trim()

    if (!code) {
      showToast('Kein Raumcode vorhanden.')
      return
    }

    try {
      await navigator.clipboard.writeText(code)

      showToast('Raumcode kopiert!')
    } catch (error) {
      console.error(
        'Raumcode konnte nicht kopiert werden:',
        error,
      )

      // Fallback für Browser, bei denen
      // navigator.clipboard blockiert wird.
      const textarea =
        document.createElement('textarea')

      textarea.value = code
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'

      document.body.appendChild(textarea)

      textarea.focus()
      textarea.select()

      try {
        document.execCommand('copy')
        showToast('Raumcode kopiert!')
      } catch {
        showToast('Kopieren fehlgeschlagen.')
      }

      textarea.remove()
    }
  })
}



function showWordChoice() {
  clearInterval(timer)

  const modal =
    document.querySelector<HTMLDivElement>('#word-choice')

  if (!modal) return

  if (drawerId !== playerId) {
    modal.classList.add('hidden')
    return
  }

  modal.classList.remove('hidden')

  const options =
    document.querySelector<HTMLDivElement>('#word-options')

  if (!options) return

  options.innerHTML = ''

  sendToServer('start-game')
}

function selectWord(word: string) {
  currentWord = word
  roundFinished = false
  correctGuesses = []

  const modal =
    document.querySelector<HTMLDivElement>(
      '#word-choice',
    )

  modal?.classList.add('hidden')

  const wordElement =
    document.querySelector<HTMLElement>('#word')

  if (wordElement) {
    wordElement.textContent = currentWord
  }

  sendToServer('choose-word', {
    word,
  })
}

function drawRemoteStroke(data: {
  x1?: number
  y1?: number
  x2?: number
  y2?: number
  color?: string
  size?: number
}) {
  const canvas =
    document.querySelector<HTMLCanvasElement>('#canvas')

  if (!canvas) return

  const ctx = canvas.getContext('2d')

  if (!ctx) return

  if (
    typeof data.x1 !== 'number' ||
    typeof data.y1 !== 'number' ||
    typeof data.x2 !== 'number' ||
    typeof data.y2 !== 'number'
  ) {
    return
  }

  ctx.save()

  ctx.setTransform(
    devicePixelRatio,
    0,
    0,
    devicePixelRatio,
    0,
    0,
  )

  ctx.beginPath()
  ctx.moveTo(data.x1, data.y1)
  ctx.lineTo(data.x2, data.y2)

  ctx.strokeStyle = data.color ?? '#171721'
  ctx.lineWidth = data.size ?? 7
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.stroke()

  ctx.restore()
}


function setupCanvas() {
  const canvas =
    document.querySelector<HTMLCanvasElement>('#canvas')!

  const ctx = canvas.getContext('2d')!

  function resize() {
    const rect = canvas.getBoundingClientRect()

    const oldCanvas = document.createElement('canvas')

    oldCanvas.width = canvas.width
    oldCanvas.height = canvas.height

    const oldCtx = oldCanvas.getContext('2d')

    if (oldCtx) {
      oldCtx.drawImage(canvas, 0, 0)
    }

    canvas.width = Math.max(
      1,
      Math.floor(rect.width * devicePixelRatio),
    )

    canvas.height = Math.max(
      1,
      Math.floor(rect.height * devicePixelRatio),
    )

    ctx.setTransform(
      devicePixelRatio,
      0,
      0,
      devicePixelRatio,
      0,
      0,
    )

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (oldCanvas.width && oldCanvas.height) {
      ctx.drawImage(
        oldCanvas,
        0,
        0,
        oldCanvas.width,
        oldCanvas.height,
        0,
        0,
        rect.width,
        rect.height,
      )
    }
  }

  resize()

  window.addEventListener('resize', resize)

  function position(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect()

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  canvas.addEventListener('pointerdown', (event) => {
  if (
    drawerId !== playerId ||
    !currentWord ||
    roundFinished
  ) {
    return
  }

    state.drawing = true

    const point = position(event)

    state.lastX = point.x
    state.lastY = point.y

    canvas.setPointerCapture(event.pointerId)

    drawDot(ctx, point.x, point.y)
  })

  canvas.addEventListener('pointermove', (event) => {
  if (!state.drawing || roundFinished) return

  const point = position(event)

  const x1 = state.lastX
  const y1 = state.lastY
  const x2 = point.x
  const y2 = point.y

  ctx.beginPath()

  ctx.moveTo(
    x1,
    y1,
  )

  ctx.lineTo(
    x2,
    y2,
  )

  ctx.strokeStyle =
    state.brushColor

  ctx.lineWidth =
    state.brushSize

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.stroke()

  sendToServer('draw', {
  data: {
    x1,
    y1,
    x2,
    y2,
    color: state.brushColor,
    size: state.brushSize,
  },
})

  state.lastX = x2
  state.lastY = y2
})

  const stop = () => {
    state.drawing = false
  }

  canvas.addEventListener('pointerup', stop)
  canvas.addEventListener('pointercancel', stop)
  canvas.addEventListener('pointerleave', stop)

  function drawDot(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
  ) {
    context.beginPath()

    context.arc(
      x,
      y,
      state.brushSize / 2,
      0,
      Math.PI * 2,
    )

    context.fillStyle = state.brushColor
    context.fill()
  }
}

function setupTools() {
  document
    .querySelectorAll<HTMLButtonElement>('.color')
    .forEach((button) => {
      button.addEventListener('click', () => {
        document
          .querySelectorAll('.color')
          .forEach((item) =>
            item.classList.remove('active'),
          )

        button.classList.add('active')

        state.brushColor =
          button.dataset.color ?? '#171721'

        const picker =
          document.querySelector<HTMLInputElement>(
            '#custom-color',
          )

        if (picker) {
          picker.value = state.brushColor
        }
      })
    })

  const customColor =
    document.querySelector<HTMLInputElement>(
      '#custom-color',
    )

  customColor?.addEventListener('input', () => {
    state.brushColor = customColor.value

    document
      .querySelectorAll('.color')
      .forEach((item) =>
        item.classList.remove('active'),
      )
  })

  document
    .querySelector<HTMLInputElement>('#brush-size')!
    .addEventListener('input', (event) => {
      state.brushSize = Number(
        (event.target as HTMLInputElement).value,
      )
    })

  document
    .querySelector<HTMLButtonElement>('#clear')!
    .addEventListener('click', () => clearCanvas())
}

function setupChat() {
  const form =
    document.querySelector<HTMLFormElement>(
      '#guess-form',
    )

  const input =
    document.querySelector<HTMLInputElement>(
      '#guess',
    )

  if (!form || !input) return

  form.addEventListener('submit', (event) => {
    event.preventDefault()

    if (drawerId === playerId) {
      showToast('Du zeichnest gerade! 🎨')
      return
    }

    if (roundFinished) return

    const guess = input.value.trim()

    if (!guess) return

    sendToServer('chat', {
      text: guess,
    })

    input.value = ''
    input.focus()
  })
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
}

function addMessage(
  name: string,
  text: string,
) {
  const messages =
    document.querySelector<HTMLDivElement>(
      '#messages',
    )

  if (!messages) return

  const wasAtBottom =
    messages.scrollHeight -
      messages.scrollTop -
      messages.clientHeight <
    40

  const item =
    document.createElement('div')

  item.className = 'message'

  item.innerHTML = `
    <strong>${escapeHtml(name)}:</strong>
    <span>${escapeHtml(text)}</span>
  `

  messages.appendChild(item)

  if (wasAtBottom) {
    messages.scrollTop =
      messages.scrollHeight
  }
}

function addSystemMessage(
  text: string,
  type: 'join' | 'leave' | 'skip' | 'close-guess',
) {
  const messages =
    document.querySelector<HTMLDivElement>(
      '#messages',
    )

  if (!messages) return

  const wasAtBottom =
    messages.scrollHeight -
      messages.scrollTop -
      messages.clientHeight <
    40

  const item =
    document.createElement('div')

  item.className =
    `message system-message ${type}`

  item.innerHTML = `
    <strong>${escapeHtml(text)}</strong>
  `

  messages.appendChild(item)

  if (wasAtBottom) {
    messages.scrollTop =
      messages.scrollHeight
  }
}

function renderPlayers() {
  const container =
    document.querySelector<HTMLDivElement>(
      '#players',
    )

  if (!container) return

  const count =
    document.querySelector<HTMLSpanElement>(
      '#player-count',
    )

  if (count) {
    count.textContent =
      String(players.length)
  }

  container.innerHTML = [...players]
    .sort((a, b) => b.score - a.score)
    .map(
      (player, index) => `
        <div class="player">

          <div
            class="avatar"
            style="background:${player.color}"
          >
            ${escapeHtml(
              player.name.charAt(0).toUpperCase(),
            )}
          </div>

          <div class="player-info">

            <strong>
              ${escapeHtml(player.name)}

              ${
                player.id === playerId
                  ? '<small>DU</small>'
                  : ''
              }
            </strong>

            <span>
              ${
                player.id === drawerId
                  ? '✏️ zeichnet'
                  : '🎯 rät'
              }
            </span>

          </div>

          <div class="score">
            ${player.score}
          </div>

          ${
            index === 0
              ? '<div class="rank">👑</div>'
              : ''
          }

        </div>
      `,
    )
    .join('')
}


function showRoundResults() {
  const modal =
    document.querySelector<HTMLDivElement>(
      '#round-result',
    )

  const word =
    document.querySelector<HTMLElement>(
      '#result-word',
    )

  const resultPlayers =
    document.querySelector<HTMLDivElement>(
      '#result-players',
    )

  const countdown =
    document.querySelector<HTMLElement>(
      '#result-countdown',
    )

  if (!modal || !word || !resultPlayers || !countdown) {
    return
  }

  word.textContent = currentWord

  const rankedPlayers = [...players].sort(
    (a, b) => b.score - a.score,
  )

  resultPlayers.innerHTML =
    rankedPlayers
      .map((player) => {
        const guessedIndex =
          correctGuesses.indexOf(player.id)

        let roundPoints = 0

        if (guessedIndex >= 0) {
          roundPoints = Math.max(
            200,
            1000 - guessedIndex * 200,
          )
        }

        return `
          <div class="result-player">

            <div class="result-rank">
              ${
                guessedIndex >= 0
                  ? `#${guessedIndex + 1}`
                  : '—'
              }
            </div>

            <div class="result-avatar">
              ${escapeHtml(
                player.name.charAt(0).toUpperCase(),
              )}
            </div>

            <div class="result-name">
              <strong>
                ${escapeHtml(player.name)}
              </strong>

              <span>
                ${
                  roundPoints > 0
                    ? `+${roundPoints} Punkte`
                    : 'Nicht erraten'
                }
              </span>
            </div>

            <div class="result-score">
              ${player.score}
            </div>

          </div>
        `
      })
      .join('')

  modal.classList.remove('hidden')

  let seconds = 6

  countdown.textContent =
    String(seconds)

  const resultTimer =
    window.setInterval(() => {
      seconds--

      countdown.textContent =
        String(Math.max(0, seconds))

      if (seconds <= 0) {
  clearInterval(resultTimer)
}
    }, 1000)
}



function clearCanvas(notifyServer = true) {
  const canvas =
    document.querySelector<HTMLCanvasElement>(
      '#canvas',
    )

  if (!canvas) return

  const ctx =
    canvas.getContext('2d')

  if (!ctx) return

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height,
  )

  if (notifyServer) {
  sendToServer('clear-canvas')
}
}

function showToast(text: string) {
  const toast =
    document.querySelector<HTMLDivElement>(
      '#toast',
    )

  if (!toast) return

  toast.textContent = text

  toast.classList.add('visible')

  window.setTimeout(() => {
    toast.classList.remove('visible')
  }, 2500)
}

renderLobby()