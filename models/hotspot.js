import mongoose from 'mongoose'

const HotspotSchema = new mongoose.Schema({
  latitude:    { type: Number, required: true },
  longitude:   { type: Number, required: true },
  brightness:  { type: Number },
  acq_date:    { type: String, required: true },
  acq_time:    { type: String, required: true },
  satellite:   { type: String, required: true },
  instrument:  { type: String, required: true },
  confidence:  { type: Number },
  frp:         { type: Number },
  daynight:    { type: String, enum: ['D', 'N'] },
  source:      { type: String, required: true, enum: ['VIIRS_SNPP', 'MODIS'] },
  scan:        { type: Number },
  track:       { type: Number },
  bright_ti5:  { type: Number },
  version:     { type: String },
  acquired_at: { type: Date, required: true }
}, { timestamps: true })

HotspotSchema.index({ source: 1, acquired_at: -1 })
HotspotSchema.index({ acquired_at: -1 })
HotspotSchema.index({ daynight: 1 })
HotspotSchema.index({ latitude: 1, longitude: 1 })

export const Hotspot = mongoose.model('Hotspot', HotspotSchema)
