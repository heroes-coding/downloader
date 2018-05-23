const axios = require('axios')
const protoDic = require('/local/protoZips/protoDic.json')
const LZString = require('lz-string')
const fs = require('fs')

function getProto(protoNumber) {
  let promise = new Promise(async function(resolve, reject) {
    if (protoDic.hasOwnProperty(protoNumber)) {
      console.log('protodic has it!')
      return resolve(protoDic[protoNumber])
    }
    let protoData
    try {
      let url = `https://raw.githubusercontent.com/Blizzard/heroprotocol/master/protocol${protoNumber}.py`
      console.log(url)
      protoData = await axios.get(url)
      protoData = protoData.data
      fs.writeFileSync('/downloads/protoData.json',protoData)
    } catch (err) { return reject(err) }
    let spawn = require("child_process").spawn
    let protoProcess = spawn('python3',["src/auth/protocolParser.py", protoData], {stdio : "inherit"})
    let spawnResults = []
    protoProcess.stdout.on('data', function(data) { spawnResults.push(data) })
    protoProcess.stdout.on('end', function() {
      let spawnData = spawnResults.join('')
      let proto = LZString.compressToUTF16(JSON.stringify(JSON.parse(spawnData)))
      protoDic[protoNumber] = proto
      fs.writeFileSync(`/local/protoZips/${protoNumber}.json`, JSON.stringify(JSON.parse(spawnData)), 'utf8')
      const toSave = JSON.stringify(protoDic)
      fs.writeFileSync('/local/protoZips/protoDic.json', toSave, 'utf8')
      return resolve(proto)
    })
    protoProcess.stdout.on('error', err => { reject(err) })
  })
  return promise
}

module.exports = getProto
