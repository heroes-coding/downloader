const { getMMR } = require('./mmrFetcher')
const { asleep } = require('../helpers/tinyHelpers')

const addMMRs = async(replays) => {
  let promise = new Promise(async(resolve, reject) => {
    let openMMRs = 0
    let replayKeys = Object.keys(replays)
    for (let r=0;r<replayKeys.length;r++) {
      openMMRs++
      const key = replayKeys[r]
      const replay = replays[key]
      const [minSinceLaunch, build, region, gameLength, mapName, gameMode, firstTo10, firstTo20, firstFort,winners] = replay.r
      getMMR(replay.bnetIDs,winners,gameMode,region, replay).then((result) => {
        if (result !== true) console.log(result)
        if (!replay.mmrs) {
          console.log({result,replay})
          process.exit(1)
        }
        openMMRs--
      })
    }
    while (openMMRs > 0) await asleep(20)
    resolve(replays)
  })
  return promise
}

module.exports = {
  addMMRs
}
