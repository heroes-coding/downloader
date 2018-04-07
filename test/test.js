/* eslint-env mocha */
const expect = require('chai').expect
const { queryReplayData, TOO_MANY_REQUESTS } = require('../api')
const HIGH_NUMBER = 999999999999
const NUMBER = 1000000

const makeRequests = async function() {
  let returned = false
  let promise = new Promise(async(resolve, reject) => {
    for (let r=0;r<35;r++) {
      queryReplayData(NUMBER+r*100).then(() => { }).catch((e) => {
        if (!returned) {
          returned = true
          return reject(e)
        }
      })
    }
  })
  return promise
}

describe('getAPIData()', function() {
  it('Should return an empty array for a high number', async() => {
    const result = await queryReplayData(HIGH_NUMBER)
    expect(0).to.equal(result.length)
  })
  it('Should return an array with id based replay objects', async() => {
    const result = await queryReplayData(NUMBER)
    const replay = result[0]
    expect(true).to.equal(replay.hasOwnProperty('id'))
  })
  it('Should give too many requests error for too many requests', async() => {
    try {
      let result = await makeRequests()
      console.log({result})
    } catch (e) {
      return expect(true).to.equal(e.message.includes(TOO_MANY_REQUESTS))
    }
  })
})
