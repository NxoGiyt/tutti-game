import './style.css'

type Player = {
  id: string
  name: string
  score: number
  ready: boolean
  color: string
}

type ServerMessage =
  | {
      type: 'connected'
      playerId: string
    }
  | {
      type: 'room-created'
      roomCode: string
      players: Player[]
      drawerId: string
      round: number
      timeLeft: number
      word?: string
    }
  | {
      type: 'room-joined'
      roomCode: string
      players: Player[]
      drawerId: string
      round: number
      timeLeft: number
      word?: string
    }
  | {
      type: 'state'
      roomCode: string
      players: Player[]
      drawerId: string
      round: number
      timeLeft: number
      word?: string
    }
  | {
      type: 'player-joined'
      player: Player
      players: Player[]
    }
  | {
      type: 'player-left'
      playerId: string
      players: Player[]
    }
  | {
      type: 'word-choice'
      words: string[]
      round: number
    }
  | {
      type: 'word-selected'
      drawerId: string
      round: number
      timeLeft: number
      word?: string
    }
  | {
      type: 'draw'
      x: number
      y: number
      lastX: number
      lastY: number
      color: string
      size: number
    }
  | {
      type: 'clear-canvas'
    }
  | {
      type: 'chat'
      playerName: string
      text: string
    }
  | {
      type: 'correct-answer'
      playerId: string
      playerName: string
      placement: number
      points: number
      players: Player[]
    }
  | {
      type: 'round-finished'
      word: string
      players: Player[]
      correctGuesses: string[]
    }
  | {
      type: 'error'
      message: string
    }

type ClientMessage =
  | {
      type: 'create-room'
      playerId: string
      playerName: string
    }
  | {
      type: 'join-room'
      playerId: string
      playerName: string
      roomCode: string
    }
  | {
      type: 'select-word'
      word: string
    }
  | {
      type: 'draw'
      x: number
      y: number
      lastX: number
      lastY: number
      color: string
      size: number
    }
  | {
      type: 'clear-canvas'
    }
  | {
      type: 'guess'
      text: string
    }

const app = document.querySelector<HTMLDivElement>('#app')!

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

let players: Player[] = []
let correctGuesses: string[] = []
let roundFinished = false

let socket: WebSocket | null = null
let connected = false

const state = {
  brushColor: '#171721',
  brushSize: 7,
  drawing: false,
  lastX: 0,
  lastY: 0,
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function randomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)]
}

function send(message: ClientMessage): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    showToast('Keine Verbindung zum Server.')
    return
  }

  socket.send(JSON.stringify(message))
}

function connectToServer(): void {
  if (
    socket &&
    (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    )
  ) {
    return
  }

  const protocol =
    window.location.protocol === 'https:' ? 'wss:' : 'ws:'

  const host = window.location.hostname || 'localhost'

  const port =
    window.location.port === '5173'
      ? '3001'
      : window.location.port || '3001'

  const url =
    `${protocol}//${host}:${port}`

  socket = new WebSocket(url)

  socket.addEventListener('open', () => {
    connected = true
  })

  socket.addEventListener('close', () => {
    connected = false
    showToast('Verbindung zum Server getrennt.')
  })

  socket.addEventListener('error', () => {
    connected = false
    showToast('Server nicht erreichbar.')
  })

  socket.addEventListener('message', (event) => {
    try {
      const message =
        JSON.parse(event.data) as ServerMessage

      handleServerMessage(message)
    } catch {
      showToast('Ungültige Serverantwort.')
    }
  })
}

function handleServerMessage(message: ServerMessage): void {
  switch (message.type) {
    case 'connected':
      return

    case 'room-created':
    case 'room-joined':
    case 'state':
      roomCode = message.roomCode
      players = message.players
      drawerId = message.drawerId
      round = message.round
      timeLeft = message.timeLeft

      if (message.word) {
        currentWord = message.word
      }

      renderGame()

      if (drawerId === playerId) {
        showWordChoice()
      } else {
        startRoundTimer()
      }

      return

    case 'player-joined':
      players = message.players
      renderPlayers()
      addMessage(
        'SYSTEM',
        `${message.player.name} ist beigetreten.`,
      )
      return

    case 'player-left':
      players = message.players
      renderPlayers()
      addMessage(
        'SYSTEM',
        'Ein Spieler hat den Raum verlassen.',
      )
      return

    case 'word-choice':
      round = message.round
      roundFinished = false
      currentWord = ''
      correctGuesses = []

      showWordChoiceWithWords(message.words)

      return

    case 'word-selected':
      drawerId = message.drawerId
      round = message.round
      timeLeft = message.timeLeft
      roundFinished = false

      if (drawerId !== playerId) {
        currentWord = ''
      }

      updateDrawer()
      updateWord()
      clearCanvas()
      startRoundTimer()

      return

    case 'draw':
      drawRemoteLine(message)
      return

    case 'clear-canvas':
      clearCanvas()
      return

    case 'chat':
      addMessage(
        message.playerName,
        message.text,
      )
      return

    case 'correct-answer':
      players = message.players
      correctGuesses.push(message.playerId)

      addCorrectMessage(
        message.playerName,
        message.placement,
        message.points,
      )

      renderPlayers()

      if (message.playerId === playerId) {
        showToast(
          `Richtig! Platz ${message.placement} · +${message.points}`,
        )
      }

      return

    case 'round-finished':
      currentWord =
        message.word

      players =
        message.players

      correctGuesses =
        message.correctGuesses

      roundFinished = true

      clearInterval(timer)

      showRoundResults()

      return

    case 'error':
      showToast(message.message)
      return
  }
}

function renderLobby(): void {
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

          <button
            id="create-room"
            class="primary-button"
          >
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

            <button
              id="join-room"
              class="secondary-button"
            >
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

      <div id="toast" class="toast"></div>
    </main>
  `

  const nameInput =
    document.querySelector<HTMLInputElement>('#name')!

  nameInput.addEventListener('input', () => {
    playerName =
      nameInput.value.trim()

    localStorage.setItem(
      'stumblesketch-player-name',
      playerName,
    )
  })

  document
    .querySelector<HTMLButtonElement>('#create-room')!
    .addEventListener('click', () => {
      if (!validateName()) {
        return
      }

      connectToServer()

      waitForSocket(() => {
        send({
          type: 'create-room',
          playerId,
          playerName,
        })
      })
    })

  document
    .querySelector<HTMLButtonElement>('#join-room')!
    .addEventListener('click', () => {
      if (!validateName()) {
        return
      }

      const code =
        document
          .querySelector<HTMLInputElement>('#room')!
          .value
          .trim()
          .toUpperCase()

      if (!/^[A-Z0-9]{6}$/.test(code)) {
        showToast(
          'Der Raum-Code muss 6 Zeichen haben.',
        )
        return
      }

      connectToServer()

      waitForSocket(() => {
        send({
          type: 'join-room',
          playerId,
          playerName,
          roomCode: code,
        })
      })
    })
}

function waitForSocket(
  callback: () => void,
): void {
  if (
    socket &&
    socket.readyState === WebSocket.OPEN
  ) {
    callback()
    return
  }

  const start =
    Date.now()

  const interval =
    window.setInterval(() => {
      if (
        socket &&
        socket.readyState === WebSocket.OPEN
      ) {
        clearInterval(interval)
        callback()
        return
      }

      if (Date.now() - start > 5000) {
        clearInterval(interval)
        showToast(
          'Server konnte nicht erreicht werden.',
        )
      }
    }, 50)
}

function validateName(): boolean {
  playerName =
    playerName.trim()

  if (!playerName) {
    showToast(
      'Gib zuerst deinen Namen ein.',
    )
    return false
  }

  if (playerName.length > 16) {
    showToast(
      'Der Name darf maximal 16 Zeichen haben.',
    )
    return false
  }

  return true
}

function renderGame(): void {
  clearInterval(timer)

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
              <span class="eyebrow">
                JETZT ZEICHNET
              </span>

              <strong id="drawer-name"></strong>
            </div>

            <div
              class="timer"
              id="timer"
            >
              ${timeLeft}
            </div>

            <div class="word-box">

              <span>
                ${drawerId === playerId
                  ? 'DEIN WORT'
                  : 'GESUCHTES WORT'}
              </span>

              <strong id="word">
                ${drawerId === playerId && currentWord
                  ? escapeHtml(currentWord)
                  : '???'}
              </strong>

            </div>

          </div>

          <div class="canvas-card">

            <canvas id="canvas"></canvas>

            <div class="canvas-tools">

              <div class="colors">

                <input
                  id="custom-color"
                  class="color-picker"
                  type="color"
                  value="${state.brushColor}"
                />

                <button
                  class="color active"
                  data-color="#171721"
                  style="background:#171721"
                ></button>

                <button
                  class="color"
                  data-color="#ffffff"
                  style="background:#ffffff"
                ></button>

                <button
                  class="color"
                  data-color="#ff4f8b"
                  style="background:#ff4f8b"
                ></button>

                <button
                  class="color"
                  data-color="#6c63ff"
                  style="background:#6c63ff"
                ></button>

                <button
                  class="color"
                  data-color="#00c2ff"
                  style="background:#00c2ff"
                ></button>

                <button
                  class="color"
                  data-color="#35d07f"
                  style="background:#35d07f"
                ></button>

                <button
                  class="color"
                  data-color="#ffb020"
                  style="background:#ffb020"
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

              <button
                id="clear"
                class="tool-button"
              >
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

            <div
              id="messages"
              class="messages"
            ></div>

            <form
              id="guess-form"
              class="guess"
            >

              <input
                id="guess"
                maxlength="60"
                placeholder="${
                  drawerId === playerId
                    ? 'Du zeichnest gerade'
                    : 'Was ist das?'
                }"
                autocomplete="off"
                ${
                  drawerId === playerId
                    ? 'disabled'
                    : ''
                }
              />

              <button
                type="submit"
                ${
                  drawerId === playerId
                    ? 'disabled'
                    : ''
                }
              >
                ➤
              </button>

            </form>

          </section>

        </aside>

      </section>

    </main>

    <div
      id="toast"
      class="toast"
    ></div>

    <div
      id="word-choice"
      class="modal-backdrop hidden"
    >
      <div class="word-choice-card">

        <div class="choice-icon">
          ✏️
        </div>

        <span class="eyebrow">
          RUNDE ${round}
        </span>

        <h2>
          Wähle dein Wort
        </h2>

        <p>
          Die anderen Spieler dürfen dein Wort
          nicht sehen.
        </p>

        <div
          id="word-options"
          class="word-options"
        ></div>

      </div>
    </div>

    <div
      id="round-result"
      class="modal-backdrop hidden"
    >
      <div class="result-card">

        <div class="choice-icon">
          🏆
        </div>

        <span class="eyebrow">
          RUNDE ${round} BEENDET
        </span>

        <h2>
          Das war's!
        </h2>

        <div class="revealed-word">
          Das Wort war:
          <strong id="result-word"></strong>
        </div>

        <div
          id="result-players"
          class="result-players"
        ></div>

        <div class="next-round-countdown">
          Nächste Runde wird vom Server gestartet.
        </div>

      </div>
    </div>
  `

  setupCanvas()
  setupTools()
  setupChat()
  renderPlayers()
  updateDrawer()
  updateWord()
}

function showWordChoice(): void {
  send({
    type: 'clear-canvas',
  })
}

function showWordChoiceWithWords(
  words: string[],
): void {
  const modal =
    document.querySelector<HTMLDivElement>(
      '#word-choice',
    )

  const options =
    document.querySelector<HTMLDivElement>(
      '#word-options',
    )

  if (!modal || !options) {
    return
  }

  options.innerHTML =
    words
      .map(
        (word) => `
          <button
            class="word-option"
            data-word="${escapeHtml(word)}"
          >
            <span>🎨</span>
            <strong>
              ${escapeHtml(word)}
            </strong>
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

          send({
            type: 'select-word',
            word,
          })

          modal.classList.add('hidden')
        },
      )
    })

  modal.classList.remove('hidden')
}

function setupCanvas(): void {
  const canvas =
    document.querySelector<HTMLCanvasElement>(
      '#canvas',
    )!

  const ctx =
    canvas.getContext('2d')!

  const resize = () => {
    const rect =
      canvas.getBoundingClientRect()

    const oldCanvas =
      document.createElement('canvas')

    oldCanvas.width =
      canvas.width

    oldCanvas.height =
      canvas.height

    const oldCtx =
      oldCanvas.getContext('2d')

    if (
      oldCtx &&
      oldCanvas.width &&
      oldCanvas.height
    ) {
      oldCtx.drawImage(
        canvas,
        0,
        0,
      )
    }

    canvas.width =
      Math.max(
        1,
        Math.floor(
          rect.width *
            window.devicePixelRatio,
        ),
      )

    canvas.height =
      Math.max(
        1,
        Math.floor(
          rect.height *
            window.devicePixelRatio,
        ),
      )

    ctx.setTransform(
      window.devicePixelRatio,
      0,
      0,
      window.devicePixelRatio,
      0,
      0,
    )

    ctx.lineCap =
      'round'

    ctx.lineJoin =
      'round'

    if (
      oldCanvas.width &&
      oldCanvas.height
    ) {
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

  window.addEventListener(
    'resize',
    resize,
  )

  const position = (
    event: PointerEvent,
  ) => {
    const rect =
      canvas.getBoundingClientRect()

    return {
      x:
        event.clientX -
        rect.left,

      y:
        event.clientY -
        rect.top,
    }
  }

  canvas.addEventListener(
    'pointerdown',
    (event) => {
      if (
        drawerId !== playerId ||
        roundFinished
      ) {
        return
      }

      state.drawing = true

      const point =
        position(event)

      state.lastX =
        point.x

      state.lastY =
        point.y

      canvas.setPointerCapture(
        event.pointerId,
      )

      drawDot(
        ctx,
        point.x,
        point.y,
      )
    },
  )

  canvas.addEventListener(
    'pointermove',
    (event) => {
      if (
        !state.drawing ||
        drawerId !== playerId ||
        roundFinished
      ) {
        return
      }

      const point =
        position(event)

      drawLine(
        ctx,
        state.lastX,
        state.lastY,
        point.x,
        point.y,
        state.brushColor,
        state.brushSize,
      )

      send({
        type: 'draw',
        x: point.x,
        y: point.y,
        lastX: state.lastX,
        lastY: state.lastY,
        color: state.brushColor,
        size: state.brushSize,
      })

      state.lastX =
        point.x

      state.lastY =
        point.y
    },
  )

  const stop = () => {
    state.drawing = false
  }

  canvas.addEventListener(
    'pointerup',
    stop,
  )

  canvas.addEventListener(
    'pointercancel',
    stop,
  )

  canvas.addEventListener(
    'pointerleave',
    stop,
  )

  function drawDot(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
  ): void {
    context.beginPath()

    context.arc(
      x,
      y,
      state.brushSize / 2,
      0,
      Math.PI * 2,
    )

    context.fillStyle =
      state.brushColor

    context.fill()
  }
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  lastX: number,
  lastY: number,
  x: number,
  y: number,
  color: string,
  size: number,
): void {
  ctx.beginPath()

  ctx.moveTo(
    lastX,
    lastY,
  )

  ctx.lineTo(
    x,
    y,
  )

  ctx.strokeStyle =
    color

  ctx.lineWidth =
    size

  ctx.lineCap =
    'round'

  ctx.lineJoin =
    'round'

  ctx.stroke()
}

function drawRemoteLine(
  message: Extract<
    ServerMessage,
    { type: 'draw' }
  >,
): void {
  const canvas =
    document.querySelector<HTMLCanvasElement>(
      '#canvas',
    )

  if (!canvas) {
    return
  }

  const ctx =
    canvas.getContext('2d')

  if (!ctx) {
    return
  }

  drawLine(
    ctx,
    message.lastX,
    message.lastY,
    message.x,
    message.y,
    message.color,
    message.size,
  )
}

function setupTools(): void {
  document
    .querySelectorAll<HTMLButtonElement>(
      '.color',
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          document
            .querySelectorAll('.color')
            .forEach((item) => {
              item.classList.remove(
                'active',
              )
            })

          button.classList.add(
            'active',
          )

          state.brushColor =
            button.dataset.color ??
            '#171721'

          const picker =
            document.querySelector<HTMLInputElement>(
              '#custom-color',
            )

          if (picker) {
            picker.value =
              state.brushColor
          }
        },
      )
    })

  const customColor =
    document.querySelector<HTMLInputElement>(
      '#custom-color',
    )

  customColor?.addEventListener(
    'input',
    () => {
      state.brushColor =
        customColor.value

      document
        .querySelectorAll('.color')
        .forEach((item) => {
          item.classList.remove(
            'active',
          )
        })
    },
  )

  document
    .querySelector<HTMLInputElement>(
      '#brush-size',
    )!
    .addEventListener(
      'input',
      (event) => {
        state.brushSize =
          Number(
            (
              event.target as
                HTMLInputElement
            ).value,
          )
      },
    )

  document
    .querySelector<HTMLButtonElement>(
      '#clear',
    )!
    .addEventListener(
      'click',
      () => {
        if (
          drawerId !== playerId
        ) {
          return
        }

        clearCanvas()

        send({
          type: 'clear-canvas',
        })
      },
    )
}

function setupChat(): void {
  const form =
    document.querySelector<HTMLFormElement>(
      '#guess-form',
    )!

  const input =
    document.querySelector<HTMLInputElement>(
      '#guess',
    )!

  form.addEventListener(
    'submit',
    (event) => {
      event.preventDefault()

      if (
        drawerId === playerId
      ) {
        showToast(
          'Du zeichnest gerade! 🎨',
        )
        return
      }

      const guess =
        input.value.trim()

      if (!guess) {
        return
      }

      send({
        type: 'guess',
        text: guess,
      })

      input.value = ''
      input.focus()
    },
  )
}

function normalize(
  value: string,
): string {
  return value
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

function addMessage(
  name: string,
  text: string,
): void {
  const messages =
    document.querySelector<HTMLDivElement>(
      '#messages',
    )

  if (!messages) {
    return
  }

  const item =
    document.createElement('div')

  item.className =
    'message'

  item.innerHTML = `
    <strong>
      ${escapeHtml(name)}:
    </strong>

    <span>
      ${escapeHtml(text)}
    </span>
  `

  messages.appendChild(item)

  messages.scrollTop =
    messages.scrollHeight
}

function addCorrectMessage(
  name: string,
  placement: number,
  points: number,
): void {
  const messages =
    document.querySelector<HTMLDivElement>(
      '#messages',
    )

  if (!messages) {
    return
  }

  const item =
    document.createElement('div')

  item.className =
    'correct-message'

  item.textContent =
    `🎉 ${name} ist Platz ${placement}! +${points} Punkte`

  messages.appendChild(item)

  messages.scrollTop =
    messages.scrollHeight
}

function renderPlayers(): void {
  const container =
    document.querySelector<HTMLDivElement>(
      '#players',
    )

  if (!container) {
    return
  }

  const count =
    document.querySelector<HTMLSpanElement>(
      '#player-count',
    )

  if (count) {
    count.textContent =
      String(players.length)
  }

  container.innerHTML =
    [...players]
      .sort(
        (a, b) =>
          b.score - a.score,
      )
      .map(
        (player, index) => `
          <div class="player">

            <div
              class="avatar"
              style="background:${escapeHtml(player.color)}"
            >
              ${escapeHtml(
                player.name
                  .charAt(0)
                  .toUpperCase(),
              )}
            </div>

            <div class="player-info">

              <strong>
                ${escapeHtml(
                  player.name,
                )}

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

function updateDrawer(): void {
  const drawer =
    players.find(
      (player) =>
        player.id === drawerId,
    )

  const element =
    document.querySelector<HTMLElement>(
      '#drawer-name',
    )

  if (element) {
    element.textContent =
      drawer?.name ??
      'Unbekannt'
  }

  const input =
    document.querySelector<HTMLInputElement>(
      '#guess',
    )

  const button =
    document.querySelector<HTMLButtonElement>(
      '#guess-form button',
    )

  const isDrawer =
    drawerId === playerId

  if (input) {
    input.disabled =
      isDrawer

    input.placeholder =
      isDrawer
        ? 'Du zeichnest gerade'
        : 'Was ist das?'
  }

  if (button) {
    button.disabled =
      isDrawer
  }
}

function updateWord(): void {
  const element =
    document.querySelector<HTMLElement>(
      '#word',
    )

  if (!element) {
    return
  }

  if (
    drawerId === playerId &&
    currentWord
  ) {
    element.textContent =
      currentWord
  } else {
    element.textContent =
      '???'
  }
}

function startRoundTimer(): void {
  clearInterval(timer)

  const timerElement =
    document.querySelector<HTMLDivElement>(
      '#timer',
    )

  if (timerElement) {
    timerElement.textContent =
      String(timeLeft)
  }

  timer =
    window.setInterval(() => {
      timeLeft =
        Math.max(
          0,
          timeLeft - 1,
        )

      if (timerElement) {
        timerElement.textContent =
          String(timeLeft)
      }
    }, 1000)
}

function clearCanvas(): void {
  const canvas =
    document.querySelector<HTMLCanvasElement>(
      '#canvas',
    )

  if (!canvas) {
    return
  }

  const ctx =
    canvas.getContext('2d')

  if (!ctx) {
    return
  }

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height,
  )
}

function showRoundResults(): void {
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

  if (
    !modal ||
    !word ||
    !resultPlayers
  ) {
    return
  }

  word.textContent =
    currentWord

  const rankedPlayers =
    [...players].sort(
      (a, b) =>
        b.score - a.score,
    )

  resultPlayers.innerHTML =
    rankedPlayers
      .map((player) => {
        const guessedIndex =
          correctGuesses.indexOf(
            player.id,
          )

        const roundPoints =
          guessedIndex >= 0
            ? Math.max(
                200,
                1000 -
                  guessedIndex *
                    200,
              )
            : 0

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
                player.name
                  .charAt(0)
                  .toUpperCase(),
              )}
            </div>

            <div class="result-name">

              <strong>
                ${escapeHtml(
                  player.name,
                )}
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

  modal.classList.remove(
    'hidden',
  )
}

function showToast(
  text: string,
): void {
  let toast =
    document.querySelector<HTMLDivElement>(
      '#toast',
    )

  if (!toast) {
    toast =
      document.createElement('div')

    toast.id =
      'toast'

    toast.className =
      'toast'

    document.body.appendChild(
      toast,
    )
  }

  toast.textContent =
    text

  toast.classList.add(
    'visible',
  )

  window.setTimeout(() => {
    toast?.classList.remove(
      'visible',
    )
  }, 2500)
}

renderLobby()