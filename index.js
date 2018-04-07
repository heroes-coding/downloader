const { queryReplayData, TOO_MANY_REQUESTS, UNKNOWN_ERROR } = require('./api')
const { getCurrentIndex } = require('./database')
const { asleep, starlog } = require('./helpers/tiny_helpers')
const restTime = 10000
const sleepTime = 60000
const DOWNLOAD_ERROR = 'download error'

let startIndex = process.argv[2] || getCurrentIndex() // need logic to get most recent

const downloadReplays = async(results) => {
  // downloads replays and returns them or an error

}

const start = async(startIndex) => {
  // starts process and loops through api requests endlessly
  if (isNaN(startIndex)) throw new Error(`Start index of ${startIndex} is not a number`)
  else startIndex = parseInt(startIndex)

  starlog(`Starting to query hotsapi with index ${startIndex}`)
  let results
  // infinite loop
  while (true) {
    // initial api query
    try {
      results = await queryReplayData(startIndex)
    } catch (e) {
      const message = e.message
      if (message.includes(TOO_MANY_REQUESTS)) {
        console.log(`${TOO_MANY_REQUESTS}, sleeping for ${restTime}ms`)
        await asleep(restTime)
        continue
      } else {
        console.log({e, message:e.message})
        console.log(`${UNKNOWN_ERROR}, sleeping for ${sleepTime}ms`)
        continue
      }
    }
    // extra checks for empty result or strange result
    if (results.length === 0) {
      console.log(`No results, sleeping for ${sleepTime}ms`)
      continue
    } else if (!results[0].hasOwnProperty('id')) {
      console.log("\n\n",results[0])
      console.log("\n\n^^^ Something wrong with api response that's not an error, full first result ^^^\n\n")
      continue
    }
    const nResults = results.length
    console.log(`Got ${nResults} results from hotsapi`)
  } // end of forever loop
}

start(startIndex)
