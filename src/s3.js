const MemoryStream = require('memorystream')

const { AWS_KEYS_PATH } = require('./config')
const AWS = require('aws-sdk')
AWS.config.loadFromPath(AWS_KEYS_PATH)
const s3 = new AWS.S3({ apiVersion: 'latest' })
s3.config.region = 'eu-west-1'

const getFile = async(fileData) => {
  let promise = new Promise(async(resolve, reject) => {
    const { filename, id } = fileData
    const params = {Bucket: 'hotsapi', Key: `${filename}.StormReplay`,RequestPayer: 'requester'}
    let mem = new MemoryStream()
    let data = []
    let lengths = 0
    mem.on('data', function(chunk) {
      lengths += chunk.length
      data.push(Buffer.from(chunk))
    })
    s3.getObject(params).createReadStream()
      .on('error', function(err) { reject(err) })
      .pipe(mem).on('finish', async() => {
        let file = Buffer.concat(data,lengths)
        return resolve({id, filename, file})
      })
  })
  return promise
}

module.exports = {
  getFile
}
