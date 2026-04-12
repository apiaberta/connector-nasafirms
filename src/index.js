import Fastify from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import cron from 'node-cron'
import mongoose from 'mongoose'
import { dataRoutes } from './routes.js'
import { syncAll } from './sync.js'
import { connectDB } from './db.js'
import { Hotspot } from '../models/hotspot.js'

const SERVICE_NAME = 'connector-nasafirms'
const PORT      = parseInt(process.env.PORT || '3012')
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/nasafirms'

const app = Fastify({
  logger: {
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty' }
      : undefined
  }
})

// ─── Swagger ─────────────────────────────────────────────────────────────────

await app.register(swagger, {
  openapi: {
    info: {
      title:   'NASA FIRMS Connector',
      version: '1.0.0',
      description: 'VIIRS and MODIS satellite fire detection hotspots for Portugal'
    },
    servers: [{ url: `http://localhost:${PORT}` }]
  }
})

await app.register(swaggerUi, { routePrefix: '/docs' })

app.get('/swagger', async () => app.swagger())

// ─── Gateway proxy redirects ───────────────────────────────────────────────────

// The gateway strips /v1 and proxies /nasafirms/* → localhost:3012/nasafirms/*
// But swagger is at /docs (root), so redirect /nasafirms/docs → /docs
app.get('/nasafirms/docs', { schema: { hide: true } }, async (req, reply) => {
  return reply.redirect('/docs')
})
app.get('/nasafirms/swagger', { schema: { hide: true } }, async (req, reply) => {
  return reply.redirect('/swagger')
})

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', async () => ({
  status:    'ok',
  service:   SERVICE_NAME,
  version:   '1.0.0',
  timestamp: new Date().toISOString()
}))

app.get('/meta', async () => {
  const total   = await Hotspot.countDocuments()
  const viirs   = await Hotspot.countDocuments({ source: 'VIIRS_SNPP' })
  const modis   = await Hotspot.countDocuments({ source: 'MODIS' })

  return {
    service:         SERVICE_NAME,
    version:         '1.0.0',
    source:           'NASA FIRMS (EOSDIS)',
    description:      'VIIRS and MODIS satellite fire detection hotspots for Portugal',
    bbox:             'west=-9.5, south=36.9, east=-6.2, north=42.2',
    total_hotspots:   total,
    by_source:        { VIIRS_SNPP: viirs, MODIS: modis },
    update_frequency: 'every 30 minutes',
    docs:             'https://github.com/apiaberta/connector-nasafirms'
  }
})

// ─── Data routes ─────────────────────────────────────────────────────────────

await app.register(dataRoutes)

// ─── Cron: sync every 30 minutes ─────────────────────────────────────────────

cron.schedule('*/30 * * * *', async () => {
  try {
    const results = await syncAll()
    app.log.info({ results }, 'NASA FIRMS sync complete')
  } catch (err) {
    app.log.error({ err }, 'NASA FIRMS sync failed')
  }
})

// ─── Startup ─────────────────────────────────────────────────────────────────

async function start () {
  await mongoose.connect(MONGO_URI)
  app.log.info('Connected to MongoDB:', MONGO_URI)

  app.log.info('Running initial NASA FIRMS sync...')
  try {
    const results = await syncAll()
    app.log.info({ results }, 'Initial sync complete')
  } catch (err) {
    app.log.error({ err }, 'Initial sync failed')
  }

  await app.listen({ port: PORT, host: '0.0.0.0' })
  app.log.info(`Server listening on port ${PORT}`)
}

start().catch(err => {
  console.error('Startup error:', err)
  process.exit(1)
})
