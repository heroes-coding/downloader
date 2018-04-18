/* eslint-env mocha */
const expect = require('chai').expect
const { queryReplayData, TOO_MANY_REQUESTS } = require('../src/api')
const { getFile } = require('../src/s3')
const getProto = require('../src/parser/getProto')
const { parseFile } = require('../src/parser/parser')
const getHOTS = require('../src/parser/HOTS/getHOTS')
const HIGH_NUMBER = 999999999999
const NUMBER = 1000000
const TEST_FILE = { id: 141, filename: '3846d192-d29e-1ddf-a42d-91d1569f15aa' }
const isBuffer = require('is-buffer')
const newestProto = require('../src/parser/protos/newestProto').newestProto

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

describe('Get new protocol', function() {
  it(`Should get the newest protocol (handled server side at heroes.report), ${newestProto}, in condensed form`, async() => {
    const proto = await getProto(newestProto,true)
    expect(true).to.equal(proto.hasOwnProperty('tTypes'))
  })
  it(`Should load another protocol, 61952, from the local file system`, async() => {
    const proto = await getProto(61952,false)
    expect(true).to.equal(proto.hasOwnProperty('tTypes'))
  })
})

describe('Download and Parse File, After getting Newest HOTS Dictionary', function() {
  let file
  let HOTS, replay
  it(`Should get the newest version of the HOTS dictionary from heroes.report`, async() => {
    HOTS = await getHOTS(true)
    expect(true).to.equal(HOTS.hasOwnProperty('unique'))
  })
  it(`Should download a file ${JSON.stringify(TEST_FILE)} from hotsapi's s3 bucket`, async() => {
    file = await getFile(TEST_FILE)
    expect(true).to.equal(isBuffer(file.file))
  })
  it(`Should parse the file into your replay format`, async() => {
    replay = await parseFile(file.file,HOTS)
    expect(true).to.equal(replay.hasOwnProperty('r'))
  })
})

// describe('Check PostgreSQL Functions')

describe('Get API data', function() {
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
