import { Hotspot } from '../models/hotspot.js'

const SERVICE_NAME = 'connector-nasafirms'

export async function dataRoutes (app) {

  // GET /nasafirms/hotspots — list hotspots with filters
  app.get('/nasafirms/hotspots', {
    schema: {
      description: 'Satellite-detected fire hotspots in Portugal (VIIRS/MODIS)',
      tags: ['NASA FIRMS'],
      querystring: {
        type: 'object',
        properties: {
          days:      { type: 'integer', default: 7, minimum: 1, maximum: 7 },
          source:    { type: 'string', enum: ['VIIRS_SNPP', 'MODIS'] },
          daynight:  { type: 'string', enum: ['D', 'N'] },
          limit:     { type: 'integer', default: 100, minimum: 1, maximum: 1000 },
          page:      { type: 'integer', default: 1, minimum: 1 }
        }
      }
    }
  }, async (req) => {
    const { days = 7, source, daynight, limit = 100, page = 1 } = req.query

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    const query = { acquired_at: { $gte: cutoff } }
    if (source)   query.source   = source
    if (daynight) query.daynight = daynight

    const skip = (page - 1) * limit

    const [hotspots, total] = await Promise.all([
      Hotspot.find(query).sort({ acquired_at: -1 }).skip(skip).limit(limit).lean(),
      Hotspot.countDocuments(query)
    ])

    return {
      meta: {
        service: SERVICE_NAME,
        days,
        source:  source || 'all',
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      data: hotspots.map(formatHotspot)
    }
  })

  // GET /nasafirms/hotspots/count — total count in DB
  app.get('/nasafirms/hotspots/count', {
    schema: {
      description: 'Total hotspot count in DB, optionally filtered by days',
      tags: ['NASA FIRMS'],
      querystring: {
        type: 'object',
        properties: {
          days:   { type: 'integer', default: 7, minimum: 1, maximum: 7 },
          source: { type: 'string', enum: ['VIIRS_SNPP', 'MODIS'] }
        }
      }
    }
  }, async (req) => {
    const { days = 7, source } = req.query

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    const query = { acquired_at: { $gte: cutoff } }
    if (source) query.source = source

    const count = await Hotspot.countDocuments(query)
    return { count, days, source: source || 'all' }
  })

  // GET /nasafirms/sources — available data sources
  app.get('/nasafirms/sources', {
    schema: {
      description: 'Available NASA FIRMS data sources',
      tags: ['NASA FIRMS']
    }
  }, async () => {
    const sources = [
      {
        id:          'VIIRS_SNPP',
        name:        'VIIRS S-NPP',
        satellite:   'SNPP',
        instrument:  'VIIRS',
        resolution:  '375m',
        description: 'Visible Infrared Imaging Radiometer Suite on Suomi NPP satellite'
      },
      {
        id:          'MODIS',
        name:        'MODIS NRT',
        satellite:   'TERRA/AQUA',
        instrument:  'MODIS',
        resolution:  '1km',
        description: 'Moderate Resolution Imaging Spectroradiometer on Terra/Aqua satellites'
      }
    ]

    // Get per-source counts
    const counts = await Hotspot.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ])
    const countMap = Object.fromEntries(counts.map(c => [c._id, c.count]))

    return {
      service:  SERVICE_NAME,
      bbox:     'west=-9.5, south=36.9, east=-6.2, north=42.2 (Portugal)',
      sources:  sources.map(s => ({ ...s, db_count: countMap[s.id] || 0 }))
    }
  })
}

function formatHotspot (h) {
  return {
    latitude:    h.latitude,
    longitude:   h.longitude,
    brightness:  h.brightness,
    acq_date:    h.acq_date,
    acq_time:    h.acq_time,
    satellite:   h.satellite,
    instrument:  h.instrument,
    confidence:  h.confidence,
    frp:         h.frp,
    daynight:    h.daynight,
    source:      h.source,
    location: {
      lat: h.latitude,
      lng: h.longitude
    }
  }
}
