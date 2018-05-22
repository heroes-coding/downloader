const { FRONTEND_KEYPAIR_PATH, FRONTEND_SERVER } = require('../config')
const { executeCommand } = require('../helpers/shell')

const transferReplays = (zipPath) => {
  const command = `scp -i ${FRONTEND_KEYPAIR_PATH} ${zipPath} ubuntu@${FRONTEND_SERVER}:/replays`
  return executeCommand(command)
}

const transferPlayerData = (zipPath) => {
  const command = `scp -i ${FRONTEND_KEYPAIR_PATH} ${zipPath} ubuntu@${FRONTEND_SERVER}:/playerzips`
  return executeCommand(command)
}

module.exports = {
  transferReplays,
  transferPlayerData
}
