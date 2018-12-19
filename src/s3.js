const MemoryStream = require('memorystream')

const { AWS_KEYS_PATH } = require('./config')
const AWS = require('aws-sdk')
AWS.config.loadFromPath(AWS_KEYS_PATH)
const s3 = new AWS.S3({ apiVersion: 'latest' })
s3.config.region = 'eu-west-1'

const getFile = async(fileData) => {
  let promise = new Promise(async(resolve, reject) => {
    const { filename, id } = fileData
    const Key = `${filename}.StormReplay`
    console.log({Key})
    const params = {Bucket: 'hotsapi', Key, RequestPayer: 'requester'}
    let mem = new MemoryStream()
    let data = []
    let lengths = 0
    mem.on('data', function (chunk) {
      lengths += chunk.length
      data.push(Buffer.from(chunk))
    })
    s3.getObject(params).createReadStream()
      .on('error', function (err) { reject(err) })
      .pipe(mem).on('finish', async() => {
        let file = Buffer.concat(data, lengths)
        return resolve({id, filename, file})
      })
  })
  return promise
}

// aws s3 cp s3://hotsapi/2fcbd06f-61c5-0d0d-66e2-321c805e694a.StormReplay test.StormReplay --request-payer=requester

module.exports = {
  getFile
}
