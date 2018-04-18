const axios = require('axios')
const fs = require('fs')
const path = require('path')
const LZString = require('lz-string')
const protoPath = './src/parser/protos'
let protocolPromises = {}

function getProto(protoNumber,getFromServer) {
  if (protocolPromises[protoNumber]) return protocolPromises[protoNumber]
  let promise = new Promise(async function(resolve, reject) {
    const thisProtoPath = path.join(protoPath,`${protoNumber}.json`)
    if (fs.existsSync(thisProtoPath) && !getFromServer) {
      return resolve(JSON.parse(fs.readFileSync(thisProtoPath)))
    }
    let proto
    try {
      proto = await axios.get(`https://heroes.report/getProto/${protoNumber}`)
    } catch (e) {
      console.log(e)
      return reject(e)
    }
    let protoString = LZString.decompressFromUTF16(proto.data)
    fs.writeFileSync(thisProtoPath,protoString, 'utf8', (err) => { if (err) console.log(err) })
    proto = JSON.parse(protoString)
    return resolve(proto)
  })
  protocolPromises[protoNumber] = promise
  return promise
}

module.exports = getProto
