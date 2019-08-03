const AWS = require('aws-sdk')
const sqs = new AWS.SQS({ apiVersion: '2012-11-05' })
sqs.config.region = 'eu-west-1'

var params = {
	QueueUrl: 'https://sqs.eu-west-1.amazonaws.com/441215765077/replays', /* required */
	MaxNumberOfMessages: 10
}

// const getSQSReplays = ()

sqs.receiveMessage(params, function (err, data) {
	if (err) console.log(err, err.stack); // an error occurred
	else console.log(len(data.Messages));           // successful respons
})


