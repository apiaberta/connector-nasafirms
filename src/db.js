import mongoose from 'mongoose'

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/nasafirms'

export async function connectDB () {
  await mongoose.connect(MONGO_URI)
  console.log('[db] Connected to MongoDB:', MONGO_URI)
}

export default mongoose
