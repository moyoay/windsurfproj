import { useEffect, useRef, useState } from 'react'
import './RunnerGame.css'

/*
  Simple Chrome Dino-like runner game using Canvas.
  Controls:
  - Space / ArrowUp / Click / Tap to jump
  Mechanics:
  - Infinite ground scroll, random cactus-like obstacles
  - Score increases over time; on collision, game over
  - High score persisted in localStorage (key: llama_runner_highscore)
*/

const WIDTH = 800
const HEIGHT = 220

const GROUND_Y = HEIGHT - 40

// Llama sprite drawn as simple 8-bit style using rectangles on canvas
function drawLlama(ctx: CanvasRenderingContext2D, x: number, y: number, size = 18, color = '#7a5c3a') {
  // Body blocks (very simple pixel art)
  // Base pixel size
  const p = Math.max(2, Math.floor(size / 6))
  // Body
  ctx.fillStyle = color
  ctx.fillRect(x, y - 4 * p, 4 * p, 3 * p) // torso
  ctx.fillRect(x + 3 * p, y - 6 * p, 2 * p, 2 * p) // neck
  ctx.fillRect(x + 4 * p, y - 7 * p, 2 * p, 2 * p) // head
  ctx.fillRect(x + 5 * p, y - 8 * p, 1 * p, 1 * p) // ear

  // Legs
  ctx.fillRect(x + 0.5 * p, y - 1 * p, 1 * p, 3 * p)
  ctx.fillRect(x + 2.5 * p, y - 1 * p, 1 * p, 3 * p)

  // Eye
  ctx.fillStyle = '#000'
  ctx.fillRect(x + 4.8 * p, y - 6.5 * p, 0.6 * p, 0.6 * p)
}

export default function RunnerGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [running, setRunning] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [high, setHigh] = useState(() => {
    const v = Number(localStorage.getItem('llama_runner_highscore') || 0)
    return Number.isFinite(v) ? v : 0
  })

  // Game state refs for logic
  const llamaRef = useRef<{ x: number; y: number; vy: number; size: number; onGround: boolean }>({ x: 80, y: GROUND_Y, vy: 0, size: 20, onGround: true })
  const groundOffsetRef = useRef(0)
  const obstaclesRef = useRef<Array<{ x: number; y: number; w: number; h: number }>>([])
  const speedRef = useRef(5)
  const lastTimeRef = useRef(0)
  const rafRef = useRef(0 as number)

  function resetGame() {
    setScore(0)
    setGameOver(false)
    llamaRef.current = { x: 80, y: GROUND_Y, vy: 0, size: 20, onGround: true }
    groundOffsetRef.current = 0
    obstaclesRef.current = []
    speedRef.current = 5
    lastTimeRef.current = 0
  }

  function startGame() {
    resetGame()
    setRunning(true)
    // kick off RAF next effect
    lastTimeRef.current = 0
  }

  function endGame() {
    setRunning(false)
    setGameOver(true)
    setHigh((prev) => {
      const newHigh = Math.max(prev, score)
      localStorage.setItem('llama_runner_highscore', String(newHigh))
      return newHigh
    })
  }

  function jump() {
    const llama = llamaRef.current
    if (llama.onGround) {
      llama.vy = -12
      llama.onGround = false
    }
  }

  // Input handlers
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        if (!running && !gameOver) startGame()
        if (gameOver) {
          startGame()
        } else {
          jump()
        }
      }
      if (e.code === 'Enter' && gameOver) startGame()
    }

    function onPointer() {
      if (!running && !gameOver) startGame()
      else if (gameOver) startGame()
      else jump()
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [running, gameOver])

  // Main loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

    function spawnObstacle() {
      const height = 20 + Math.random() * 30
      const width = 12 + Math.random() * 12
      const gap = 300 + Math.random() * 300 // distance from last spawn
      const x = WIDTH + gap
      obstaclesRef.current.push({ x, y: GROUND_Y, w: width, h: height })
    }

    function ensureObstacles() {
      if (obstaclesRef.current.length === 0) spawnObstacle()
      const last = obstaclesRef.current[obstaclesRef.current.length - 1]
      if (last && last.x < WIDTH - (200 + Math.random() * 250)) {
        spawnObstacle()
      }
    }

    function loop(time: number) {
      const dt = Math.min(32, time - (lastTimeRef.current || time))
      lastTimeRef.current = time

      // Clear
      ctx.fillStyle = '#f5f5f5'
      ctx.fillRect(0, 0, WIDTH, HEIGHT)

      // Ground
      const speed = speedRef.current
      groundOffsetRef.current = (groundOffsetRef.current + speed) % 40
      ctx.strokeStyle = '#999'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, GROUND_Y + 2)
      ctx.lineTo(WIDTH, GROUND_Y + 2)
      ctx.stroke()

      // Draw repeating ground dashes for a sense of speed
      ctx.strokeStyle = '#bbb'
      ctx.lineWidth = 2
      for (let x = -groundOffsetRef.current; x < WIDTH; x += 40) {
        ctx.beginPath()
        ctx.moveTo(x, GROUND_Y + 10)
        ctx.lineTo(x + 20, GROUND_Y + 10)
        ctx.stroke()
      }

      // Llama physics
      const llama = llamaRef.current
      llama.vy += 0.7 // gravity
      llama.y += llama.vy
      if (llama.y >= GROUND_Y) {
        llama.y = GROUND_Y
        llama.vy = 0
        llama.onGround = true
      }

      // Obstacles
      ensureObstacles()
      obstaclesRef.current.forEach((ob) => {
        ob.x -= speed
        ctx.fillStyle = '#2b5d34'
        ctx.fillRect(ob.x, ob.y - ob.h, ob.w, ob.h)
      })
      // Remove off-screen
      obstaclesRef.current = obstaclesRef.current.filter((o) => o.x + o.w > -10)

      // Collision (simple AABB)
      const llamaBox = { x: llama.x + 6, y: llama.y - llama.size, w: llama.size, h: llama.size }
      for (const o of obstaclesRef.current) {
        const obBox = { x: o.x, y: o.y - o.h, w: o.w, h: o.h }
        const hit =
          llamaBox.x < obBox.x + obBox.w &&
          llamaBox.x + llamaBox.w > obBox.x &&
          llamaBox.y < obBox.y + obBox.h &&
          llamaBox.y + llamaBox.h > obBox.y
        if (hit) {
          endGame()
          return
        }
      }

      // Draw llama
      drawLlama(ctx, llama.x, llama.y, 22)

      // Score and difficulty
      if (running) {
        setScore((s) => s + Math.floor(dt / 16))
        if (score % 300 === 0 && speedRef.current < 14) {
          speedRef.current += 0.2
        }
      }

      // UI text
      ctx.fillStyle = '#333'
      ctx.font = '16px monospace'
      ctx.fillText(`Score: ${score}`, 12, 20)
      ctx.fillText(`High Score: ${Math.max(high, score)}`, 12, 40)

      if (!running) {
        ctx.fillStyle = '#222'
        ctx.font = 'bold 18px monospace'
        ctx.textAlign = 'center'
        if (gameOver) {
          ctx.fillText('Game Over - Press Space/Click to Restart', WIDTH / 2, HEIGHT / 2)
        } else {
          ctx.fillText('Press Space/Click to Start - Jump with Llama!', WIDTH / 2, HEIGHT / 2)
        }
        ctx.textAlign = 'start'
      }

      if (running) {
        rafRef.current = requestAnimationFrame(loop)
      }
    }

    if (running) {
      rafRef.current = requestAnimationFrame(loop)
    }

    return () => cancelAnimationFrame(rafRef.current)
  }, [running, gameOver, high, score])

  return (
    <div className="runner-container">
      <canvas
        ref={canvasRef}
        className="runner-canvas"
        width={WIDTH}
        height={HEIGHT}
      />
      <div className="hud">
        <div className="title">Llama Runner</div>
        <div className="tips">Space / Click to Jump</div>
      </div>
      {!running && !gameOver && (
        <button className="btn start" onClick={() => setRunning(true)}>Start</button>
      )}
      {gameOver && (
        <button className="btn restart" onClick={() => setRunning(true)}>Restart</button>
      )}
    </div>
  )
}
