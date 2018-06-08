const fs = require('fs')
const w = fs.existsSync("C:/")
const AWS_KEYS_PATH = '/local/keys.json'
const DOWNLOADS_DB_CONFIG_PATH = w ? 'F:/apiFiles/dbConfig.json' : '/local/downloads_db_config.json'
const PATREON_KEYS_PATH = w ? 'F:/apiFiles/patreonKeys.json' : '/local/patreonKeys.json'
const PROTO_PATH = w ? 'F:/apiFiles/stats/protoDic.json' : '/local/protoZips/protoDic.json'
const FRONTEND_KEYPAIR_PATH = '/local/Tiny.pem'
const FRONTEND_SERVER = '34.251.86.191'
const STATS_PATH = w ? 'F:/apiFiles/stats' : '/stats'

module.exports = {
  AWS_KEYS_PATH,
  DOWNLOADS_DB_CONFIG_PATH,
  PATREON_KEYS_PATH,
  FRONTEND_KEYPAIR_PATH,
  FRONTEND_SERVER,
  PROTO_PATH,
  STATS_PATH
}
