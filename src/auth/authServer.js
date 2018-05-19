'use strict'
const express = require('express')
const app = express()
const { genPassword } = require('../helpers/tiny_helpers')
const getProto = require('/local/server/getProto')
const { createDatabase } = require('../helpers/postgresql')
const { user,host,database: db,password } = require('/local/downloads_db_config.json')
const postgresDB = createDatabase(user,host,db,password)
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const { oauth, patreon } = require('patreon')
const { format: formatUrl } = require('url')
const { PATREON_KEYS_PATH } = require('../config')
const { clientId, clientSecret, exemptVIPS } = require(PATREON_KEYS_PATH)
const redirect = 'https://heroes.report/redirect'
const oauthClient = oauth(clientId, clientSecret)

// mimic a database
let database = {}

const loginUrl = formatUrl({
  protocol: 'https',
  host: 'patreon.com',
  pathname: '/oauth2/authorize',
  query: {
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirect,
    state: genPassword()
  }
})
console.log({loginUrl})

app.get('/auth', (req, res) => {
  res.send(`<a href="${loginUrl}">Login with Patreon</a>`)
})

app.get('/redirect', (req, res) => {
  const { code } = req.query
  let token
  return oauthClient.getTokens(code, redirect)
    .then((TOKEN) => { // eslint-disable-line camelcase
      token = TOKEN.access_token
      const apiClient = patreon(token)
      return apiClient(`/current_user`)
    })
    .then(({ store, rawJson }) => {
      const { id } = rawJson.data
      database[id] = { ...rawJson.data, token }
      console.log(`Saved user ${store.find('user', id).full_name} to the database`)
      return res.redirect(`/protected/${id}`)
    })
    .catch((err) => {
      console.log(err)
      console.log('Redirecting to login')
      res.redirect('/')
    })
})

app.get('/protected/:id', (req, res) => {
  const { id } = req.params
  // load the user from the database
  const user = database[id]
  if (!user || !user.token) {
    return res.redirect('/')
  }
  const apiClient = patreon(user.token)
  // make api requests concurrently
  return apiClient(`/current_user`)
    .then(({ rawJson }) => {
      // should save this baby to disk to review later
      let VIP = false
      if (rawJson.hasOwnProperty('included')) {
        try {
          const pledges = rawJson.included.filter(x => x.type === 'pledge')
          if (pledges.map(x => x.attributes.amount_cents).reduce((a,b) => a+b) > 250) VIP = true
        } catch (e) {
          //
        }
      } else if (rawJson.hasOwnProperty('data') && exemptVIPS.includes(rawJson.data.id)) VIP = true
      const tempPassword = genPassword()
      return res.redirect(`/done.html?VIP=${VIP}&id=${id}&tempPassword=${tempPassword}`)
    }).catch((err) => {
      const { status, statusText } = err
      console.log(err)
      return res.json({ status, statusText })
    })
})

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
