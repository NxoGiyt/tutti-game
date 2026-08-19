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

let players: Player[] = []

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
      if (!validateName()) return

      roomCode = generateRoomCode()

      startGame()
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

      startGame()
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
  createFakePlayers()

  drawerId = playerId
  round = 1

  renderGame()

  showWordChoice()
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

            <div class="canvas-tools">

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

        <div id="word-options" class="word-options"></div>

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
}

function showWordChoice() {
  clearInterval(timer)

  timeLeft = 60

  const modal =
    document.querySelector<HTMLDivElement>(
      '#word-choice',
    )

  const options =
    document.querySelector<HTMLDivElement>(
      '#word-options',
    )

  if (!modal || !options) return

  const words = getThreeWords()

  options.innerHTML = words
    .map(
      (word) => `
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
    .querySelectorAll<HTMLButtonElement>('.word-option')
    .forEach((button) => {
      button.addEventListener('click', () => {
        const word = button.dataset.word

        if (!word) return

        selectWord(word)
      })
    })

  modal.classList.remove('hidden')
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

  const timerElement =
    document.querySelector<HTMLDivElement>('#timer')

  if (timerElement) {
    timerElement.textContent = '60'
  }

  clearCanvas()

  startRound()
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
    if (!currentWord || roundFinished) return

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

    ctx.beginPath()
    ctx.moveTo(state.lastX, state.lastY)
    ctx.lineTo(point.x, point.y)

    ctx.strokeStyle = state.brushColor
    ctx.lineWidth = state.brushSize

    ctx.stroke()

    state.lastX = point.x
    state.lastY = point.y
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
    .addEventListener('click', clearCanvas)
}

function setupChat() {
  const form =
    document.querySelector<HTMLFormElement>(
      '#guess-form',
    )!

  const input =
    document.querySelector<HTMLInputElement>(
      '#guess',
    )!

  form.addEventListener('submit', (event) => {
  event.preventDefault()

  // Der Zeichner darf während seiner Runde nicht raten.
  if (drawerId === playerId) {
    showToast('Du zeichnest gerade! 🎨')
    return
  }

  if (!currentWord || roundFinished) return

  const guess = input.value.trim()

  if (!guess) return

  addMessage(playerName, guess)

  if (
    normalize(guess) ===
    normalize(currentWord)
  ) {
    addCorrectAnswer()
  }

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

function addMessage(name: string, text: string) {
  const messages =
    document.querySelector<HTMLDivElement>(
      '#messages',
    )!

  const item = document.createElement('div')

  item.className = 'message'

  item.innerHTML = `
    <strong>${escapeHtml(name)}:</strong>
    <span>${escapeHtml(text)}</span>
  `

  messages.appendChild(item)

  messages.scrollTop =
    messages.scrollHeight
}

function addCorrectAnswer() {
  if (roundFinished) return

  const player = players.find(
    (item) => item.id === playerId,
  )

  if (!player) return

  if (correctGuesses.includes(player.id)) {
    showToast('Du hast das bereits erraten!')
    return
  }

  /*
   * Platz 1 = 1000
   * Platz 2 = 800
   * Platz 3 = 600
   * Platz 4 = 400
   * usw.
   *
   * Damit ist die Reihenfolge direkt relevant.
   */
  const placement = correctGuesses.length

  const points = Math.max(
    200,
    1000 - placement * 200,
  )

  correctGuesses.push(player.id)

  player.score += points

  const messages =
    document.querySelector<HTMLDivElement>(
      '#messages',
    )!

  const item = document.createElement('div')

  item.className = 'correct-message'

  item.textContent =
    `🎉 ${playerName} ist Platz ${placement + 1}! +${points} Punkte`

  messages.appendChild(item)

  messages.scrollTop =
    messages.scrollHeight

  renderPlayers()

  showToast(
    `Richtig! Platz ${placement + 1} · +${points}`,
  )

  /*
   * Im echten Multiplayer beendet der Server
   * die Runde erst, wenn alle möglichen Spieler
   * geraten haben oder die Zeit abgelaufen ist.
   *
   * Für die jetzige Version lassen wir den Timer
   * weiterlaufen.
   */
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

function startRound() {
  clearInterval(timer)

  timeLeft = 60

  const timerElement =
    document.querySelector<HTMLDivElement>(
      '#timer',
    )

  if (timerElement) {
    timerElement.textContent = '60'
  }

  timer = window.setInterval(() => {
    timeLeft--

    if (timerElement) {
      timerElement.textContent =
        String(Math.max(0, timeLeft))
    }

    if (timeLeft <= 0) {
      finishRound()
    }
  }, 1000)
}

function finishRound() {
  if (roundFinished) return

  roundFinished = true

  clearInterval(timer)

  const timerElement =
    document.querySelector<HTMLDivElement>(
      '#timer',
    )

  if (timerElement) {
    timerElement.textContent = '0'
  }

  showRoundResults()
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
        nextRound()
      }
    }, 1000)
}

function nextRound() {
  round++

  currentWord = ''

  correctGuesses = []

  roundFinished = false

  clearCanvas()

  renderGame()

  showWordChoice()
}

function clearCanvas() {
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