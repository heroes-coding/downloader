const MemoryStream = require('memorystream')

const { AWS_KEYS_PATH } = require('./config')
const AWS = require('aws-sdk')
// AWS.config.loadFromPath(AWS_KEYS_PATH)
const s3 = new AWS.S3({ apiVersion: 'latest' })
s3.config.region = 'eu-west-1'

const getFile = async (fileData) => {
	let promise = new Promise(async (resolve, reject) => {
		const { filename, id } = fileData
		const Key = `${filename}.StormReplay`
		const params = { Bucket: 'hotsapi', Key, RequestPayer: 'requester' }
		let mem = new MemoryStream()
		let data = []
		let lengths = 0
		mem.on('data', function (chunk) {
			lengths += chunk.length
			data.push(Buffer.from(chunk))
		})
		s3.getObject(params).createReadStream()
			.on('error', function (err) { reject(err) })
			.pipe(mem).on('finish', async () => {
				let file = Buffer.concat(data, lengths)
				return resolve({ id, filename, file })
			})
	})
	return promise
}

// /usr/local/bin/aws s3 cp s3://hotsapi/e76865e9-8fd8-8b9d-51f1-2488e2079bd1.StormReplay test.StormReplay --request-payer=requester

// /usr/local/bin/aws s3 cp http://hotsapi.s3-website-eu-west-1.amazonaws.com/7548c3e4-347b-af84-5b29-042611eab3b6.StormReplay test.StormReplay --request-payer=requester

// http:\/\/hotsapi.s3-website-eu-west-1.amazonaws.com\/7548c3e4-347b-af84-5b29-042611eab3b6.StormReplay

module.exports = {
	getFile
}
