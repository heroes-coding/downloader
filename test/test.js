/* eslint-env mocha */
const expect = require('chai').expect
const { queryReplayData, TOO_MANY_REQUESTS } = require('../api')
const HIGH_NUMBER = 999999999999
const NUMBER = 1000000

const makeRequests = async function() {
  let returned = false
  let promise = new Promise(async(resolve, reject) => {
    for (let r=0;r<30;r++) {
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
  it('Should return an empty array for a high number', async function() {
    const result = await queryReplayData(HIGH_NUMBER)
    expect(result === [])
  })
  it('Should return an array with api_id replay objects', async function() {
    const result = await queryReplayData(NUMBER)
    expect(result[0].hasOwnProperty('api_id'))
  })
  it('Should give too many requests error for too many requests', async function() {
    try {
      await makeRequests
    } catch (e) {
      return expect(e.message.includes(TOO_MANY_REQUESTS))
    }
  })
})
