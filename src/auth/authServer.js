'use strict'
const express = require('express')
const app = express()
const { genPassword } = require('../helpers/tiny_helpers')
const getProto = require('/local/servers/getProto')
const { createDatabase } = require('../helpers/postgresql')
const { user,host,database: db,password } = require('/local/downloads_db_config.json')
const database = createDatabase(user,host,db,password)
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')

app.use(bodyParser.json()) // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cookieParser())
app.enable('trust proxy')

app.get('/getProto/:proto', async function(req, res) {
  const proto = req.params.proto
  let protoCompressed = await getProto(proto)
  return res.send(protoCompressed)
})

app.put('/getProto', async function(req, res) {
  let protoCompressed = await getProto(req.body.proto)
  return res.send(protoCompressed)
})

app.listen(3000, () => console.log('Auth server listening on port 3000!'))
