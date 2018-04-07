const { queryReplayData, TOO_MANY_REQUESTS, UNKNOWN_ERROR } = require('./api')
const asleep = require('./helpers/asleep').asleep
const restTime = 10000
const sleepTime = 60000

let startIndex = process.argv[2] || 1

const start = async(startIndex) => {
  if (isNaN(startIndex)) throw new Error(`Start index of ${startIndex} is not a number`)
  else startIndex = parseInt(startIndex)
  let result
  // infinite loop to update and stuff
  while (true) {
    try {
      result = await queryReplayData(startIndex)
      console.log(`Got ${result.length} datas!`)
    } catch (e) {
      const message = e.message
      if (message.includes(TOO_MANY_REQUESTS)) {
        console.log(`${TOO_MANY_REQUESTS}, sleeping for ${restTime}ms`)
        await asleep(restTime)
        continue
      } else {
        console.log({e, message:e.message})
        console.log(`${UNKNOWN_ERROR}, sleeping for ${sleepTime}ms`)
      }
    }
  }
}

start(startIndex)
