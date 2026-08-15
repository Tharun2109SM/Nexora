import { createApp } from './app.js'
import { environment } from './lib/env.js'

const app = createApp()
const server = app.listen(environment.PORT, '0.0.0.0', () => {
  console.info(`NEXORA API listening on port ${environment.PORT.toString()}`)
})

function shutdown(signal: string) {
  console.info(`${signal} received; closing HTTP server`)
  server.close((error) => {
    if (error) {
      console.error(error)
      process.exitCode = 1
    }
  })
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM')
})
process.on('SIGINT', () => {
  shutdown('SIGINT')
})
