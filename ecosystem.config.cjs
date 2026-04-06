module.exports = {
  apps: [{
    name: 'apiaberta-nasafirms',
    script: 'src/index.js',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: 3012,
      MONGO_URI: 'mongodb://localhost:27017/nasafirms'
    }
  }]
}
