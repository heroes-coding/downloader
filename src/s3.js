const MemoryStream = require('memorystream')
const AWS = require('aws-sdk')
const s3 = new AWS.S3({ apiVersion: 'latest' })
s3.config.region = 'eu-west-1'

const getFile = async (filename) =>
	// gets an s3 file via a memory stream resolved as a file
	new Promise(async (resolve, reject) => {
		const Key = `${filename}.StormReplay`
		const mem = new MemoryStream()
		const data = []
		let bytes = 0
		mem.on('data', function (chunk) {
			bytes += chunk.length
			data.push(Buffer.from(chunk))
		})
		s3
			.getObject({ ...params, Key })
			.createReadStream()
			.on('error', function (err) {
				reject(err)
			})
			.pipe(mem)
			.on('finish', async () => {
				const file = Buffer.concat(data, bytes)
				return resolve(file)
			})
	})
// /usr/local/bin/aws s3 cp s3://hotsapi/e76865e9-8fd8-8b9d-51f1-2488e2079bd1.StormReplay test.StormReplay --request-payer=requester

// /usr/local/bin/aws s3 cp http://hotsapi.s3-website-eu-west-1.amazonaws.com/7548c3e4-347b-af84-5b29-042611eab3b6.StormReplay test.StormReplay --request-payer=requester

// http:\/\/hotsapi.s3-website-eu-west-1.amazonaws.com\/7548c3e4-347b-af84-5b29-042611eab3b6.StormReplay

module.exports = {
	getFile
}
