const { convertReplayAndSave } = require('./binaryConverter')

const extractCompressedData = (replays, HOTS) => {
  const replayKeys = Object.keys(replays)
  const nReps = replayKeys.length
  for (let r=0;r<nReps;r++) { convertReplayAndSave(replays[replayKeys[r]], HOTS, true, false, false) }
}

module.exports = {
  extractCompressedData
}
