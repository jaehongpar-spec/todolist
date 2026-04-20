const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const fs = require('fs')
const path = require('path')

const PORT = process.env.PORT || 3737
const DATA_FILE = path.join(__dirname, 'todos.json')

function loadTodos() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    }
  } catch (e) {}
  return []
}

function saveTodos(todos) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(todos, null, 2), 'utf8')
  } catch (e) {
    console.error('저장 실패:', e.message)
  }
}

let todos = loadTodos()

const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

app.get('/api/todos', (req, res) => res.json(todos))

app.post('/api/todos', (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'invalid' })
  todos = req.body
  saveTodos(todos)
  broadcast({ type: 'sync', todos })
  res.json({ ok: true })
})

app.get('/health', (req, res) => res.json({ ok: true, count: todos.length }))

const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

function broadcast(data, excludeWs = null) {
  const msg = JSON.stringify(data)
  wss.clients.forEach(client => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(msg)
    }
  })
}

wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'sync', todos }))

  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw)
      if (msg.type === 'sync' && Array.isArray(msg.todos)) {
        todos = msg.todos
        saveTodos(todos)
        broadcast({ type: 'sync', todos }, ws)
      }
    } catch (e) {}
  })

  ws.on('error', () => {})
})

server.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`)
})
