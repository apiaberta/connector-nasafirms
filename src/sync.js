import { Hotspot } from '../models/hotspot.js'

const MAP_KEY = '054ea3cea6afafcd1eff377c69ff8b8f'
const PORTUGAL_BBOX = '-9.5,36.9,-6.2,42.2'
const KEEP_DAYS = 7

const BASE_URL = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv'

const SOURCES = [
  { id: 'VIIRS_SNPP', source: 'VIIRS_SNPP_NRT' },
  { id: 'MODIS',      source: 'MODIS_NRT' }
]

function parseCSV (csv) {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim())
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',')
    if (values.length < headers.length) continue

    const row = {}
    headers.forEach((h, idx) => {
      row[h.trim()] = values[idx]?.trim() ?? ''
    })
    rows.push(row)
  }
  return rows
}

function safeNum (val) {
  if (!val || val === '' || val === 'NA' || val === 'NaN') return undefined
  const n = parseFloat(val)
  return isNaN(n) ? undefined : n
}

function normalizeRow (row, sourceId) {
  const acqDate = row.acq_date
  const acqTime = row.acq_time

  let acquiredAt = undefined
  if (acqDate && acqTime && acqDate.length === 10 && acqTime.length >= 4) {
    const hours = acqTime.slice(0, 2)
    const mins  = acqTime.slice(2, 4)
    const parsed = new Date(`${acqDate}T${hours}:${mins}:00.000Z`)
    if (!isNaN(parsed.getTime())) {
      acquiredAt = parsed
    }
  }

  const brightness = safeNum(row.bright_ti4) || safeNum(row.brightness) || undefined

  return {
    latitude:    safeNum(row.latitude),
    longitude:   safeNum(row.longitude),
    brightness,
    acq_date:    acqDate || undefined,
    acq_time:    acqTime || undefined,
    satellite:   row.satellite?.trim() || undefined,
    instrument:  row.instrument?.trim() || undefined,
    confidence:  safeNum(row.confidence),
    frp:         safeNum(row.frp),
    daynight:    (row.daynight?.trim() === 'D' || row.daynight?.trim() === 'N')
                  ? row.daynight.trim()
                  : undefined,
    source:      sourceId,
    scan:        safeNum(row.scan),
    track:       safeNum(row.track),
    bright_ti5:  safeNum(row.bright_ti5),
    version:     row.version?.trim() || undefined,
    acquired_at: acquiredAt
  }
}

async function fetchAndUpsert (url, sourceId) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    headers: { 'User-Agent': 'apiaberta-connector-nasafirms/1.0' }
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const csv = await res.text()
  const rows = parseCSV(csv)

  if (rows.length === 0) return { source: sourceId, upserted: 0, total: 0 }

  let upserted = 0
  let skipped = 0
  for (const row of rows) {
    try {
      const doc = normalizeRow(row, sourceId)
      if (!doc.latitude || !doc.longitude || !doc.acq_date || !doc.acquired_at) {
        skipped++
        continue
      }

      await Hotspot.updateOne(
        {
          source:     doc.source,
          latitude:   doc.latitude,
          longitude:  doc.longitude,
          acq_date:   doc.acq_date,
          acq_time:   doc.acq_time
        },
        { $set: doc },
        { upsert: true }
      )
      upserted++
    } catch (err) {
      console.warn(`[sync] Skip row (${sourceId}):`, err.message)
      skipped++
    }
  }

  return { source: sourceId, upserted, skipped, total: rows.length }
}

function buildSourceUrls (sourceId) {
  const MAX_CHUNK = 5

  if (KEEP_DAYS <= MAX_CHUNK) {
    return [`${BASE_URL}/${MAP_KEY}/${sourceId}/${PORTUGAL_BBOX}/${KEEP_DAYS}/`]
  }

  // Chunk 1: last 5 days
  // Chunk 2: remaining KEEP_DAYS - MAX_CHUNK with explicit start date
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const beforeDate = new Date(today)
  beforeDate.setDate(beforeDate.getDate() - KEEP_DAYS)
  const dateStr = beforeDate.toISOString().split('T')[0]
  const remaining = KEEP_DAYS - MAX_CHUNK

  return [
    `${BASE_URL}/${MAP_KEY}/${sourceId}/${PORTUGAL_BBOX}/${MAX_CHUNK}/`,
    `${BASE_URL}/${MAP_KEY}/${sourceId}/${PORTUGAL_BBOX}/${remaining}/${dateStr}`
  ]
}

async function syncSource (source) {
  console.log(`[sync] Syncing ${source.id}...`)

  const urls = buildSourceUrls(source.source)
  let totalUpserted = 0
  let totalSkipped = 0
  let totalRecords = 0

  for (const url of urls) {
    try {
      const r = await fetchAndUpsert(url, source.id)
      totalUpserted += r.upserted
      totalSkipped += r.skipped
      totalRecords += r.total
      if (r.total > 0) {
        console.log(`[sync] ${source.id} chunk: ${r.upserted}/${r.total} upserted, ${r.skipped} skipped`)
      }
    } catch (err) {
      console.error(`[sync] ${source.id} chunk failed:`, err.message)
    }
  }

  console.log(`[sync] ${source.id} done: ${totalUpserted} upserted, ${totalSkipped} skipped out of ${totalRecords}`)
  return { source: source.id, upserted: totalUpserted, skipped: totalSkipped, total: totalRecords }
}

export async function cleanupOld (days = KEEP_DAYS) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const result = await Hotspot.deleteMany({ acquired_at: { $lt: cutoff } })
  console.log(`[sync] Cleanup: deleted ${result.deletedCount} records older than ${days} days`)
  return { deleted: result.deletedCount }
}

export async function syncAll () {
  const results = []

  for (const source of SOURCES) {
    try {
      const r = await syncSource(source)
      results.push(r)
    } catch (err) {
      console.error(`[sync] ${source.id} failed:`, err.message)
      results.push({ source: source.id, error: err.message })
    }
  }

  try {
    const cleanup = await cleanupOld(KEEP_DAYS)
    results.push({ cleanup })
  } catch (err) {
    console.error('[sync] Cleanup failed:', err.message)
  }

  return results
}
