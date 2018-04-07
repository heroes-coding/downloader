const axios = require('axios')
const TOO_MANY_REQUESTS = 'Too Many Requests'
const UNKNOWN_ERROR = 'Unknown Error'

const queryReplayData = (startingIndex) => {
  let promise = new Promise(async(resolve, reject) => {
    const requestURL = `http://hotsapi.net/api/v1/replays?with_players=true&min_id=${startingIndex}`
    startingIndex += 100
    let response
    try {
      response = await axios.get(requestURL)
      if (!response.status) return reject(new Error(response))
    } catch (e) {
      if (e.message && e.message.includes('429')) return reject(new Error(TOO_MANY_REQUESTS))
      return reject(new Error(`${UNKNOWN_ERROR}: From queryReplayData: ${e.message}`))
    }
    const { status, statusText, data } = response
    if (status === 200) return resolve(data)
    else if (status === 429) return reject(new Error(TOO_MANY_REQUESTS))
    else return reject(new Error(`${UNKNOWN_ERROR}: status and statusText: ${status}, ${statusText}`))
  })
  return promise
}

module.exports = {
  queryReplayData,
  TOO_MANY_REQUESTS,
  UNKNOWN_ERROR
}
