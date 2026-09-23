import { createServer } from 'vite'

const server = await createServer({
  root: process.cwd(),
  server: { host: '127.0.0.1', port: 43999, strictPort: true },
})
await server.listen()
await new Promise(() => {})
