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
  return res.redirect(loginUrl)
})

const resolveData = async(rawJson, res, token, idChecked) => {
  // need to create temp password, save to database, and return said data
  let promise = new Promise(async(resolve, reject) => {
    try {
      let VIP = false
      if (rawJson.hasOwnProperty('included')) {
        try {
          const pledges = rawJson.included.filter(x => x.type === 'pledge')
          if (pledges.map(x => x.attributes.amount_cents).reduce((a,b) => a+b) > 250) VIP = true
        } catch (e) {
          //
        }
      } else if (rawJson.hasOwnProperty('data') && exemptVIPS.includes(rawJson.data.id)) VIP = true
      const { id } = rawJson.data
      const tempPassword = genPassword()
      let exists = true
      if (!idChecked) {
        const result = await postgresDB.simpleQuery(`SELECT * FROM users WHERE patreon_id = ${parseInt(id)}`)
        if (result.rowCount === 0) exists = false
      }
      const { access_token, refresh_token, expirationTime } = token
      if (exists) await postgresDB.simpleQuery(`UPDATE users SET temp_password = ($1), access_token = ($2), refresh_token = ($3), credential_expiration = ($4), vip = ($5) WHERE patreon_id = ($6)`, [tempPassword, access_token, refresh_token, expirationTime, VIP, id ])
      else await postgresDB.simpleQuery(`INSERT INTO users (patreon_id, temp_password, access_token, refresh_token, credential_expiration, vip) VALUES ($1, $2, $3, $4, $5, $6)`, [id, tempPassword, access_token, refresh_token, expirationTime, VIP ])
      resolve({VIP, id, tempPassword})
    } catch (e) {
      console.log(e)
      res.status(400)
      resolve({VIP:false, id:"", tempPassword:""})
    }
  })
  return promise
}

app.get('/redirect', async(req, res) => {
  // this is for manual logins
  try {
    const { code } = req.query
    let token = await oauthClient.getTokens(code, redirect)
    token.expirationTime = new Date().getTime() + 2592000000 // 30 days, just short of 31
    const apiClient = patreon(token.access_token)
    const { rawJson } = await apiClient(`/current_user`)
    const data = await resolveData(rawJson, res, token)
    return res.redirect(`/done.html?VIP=${data.VIP}&id=${data.id}&tempPassword=${data.tempPassword}`)
  } catch (err) {
    console.log(err)
    res.status(400)
    return res.redirect(`/done.html?VIP=${false}&id=&tempPassword=`)
  }
})

app.get('/protected/:idpw', async (req, res) => {
  // TO DO : get id and password, query for user, if exists check if expires, if expires refresh token if not exists return doesn't exist otherwise return id and password in JSON format
  // this is for automatic logins
  let { idpw } = req.params
  let result
  try {
    let [id, pw] = idpw.split("|")
    id = parseInt(id)
    result = await postgresDB.simpleQuery("SELECT * FROM users WHERE patreon_id = ($1) and temp_password = ($2)", [id, pw])
    if (!result.rowCount) throw new Error(`Couldn't find User: ${id} & Password: ${pw}`) // note the user could exist but password is wrong, from another browser for instance.  Keeping error case to one to keep this simple
    // I'm leaving all of the token stuff the same to perhaps insert the refresh token logic here (which is currently buggy)
    const { access_token, refresh_token, credential_expiration: expirationTime } = result.rows[0]
    console.log({ access_token, refresh_token, expirationTime })
    const apiClient = patreon(access_token)
    const { rawJson } = await apiClient(`/current_user`)
    const token = { access_token, refresh_token, expirationTime }
    const data = await resolveData(rawJson, res, token)

    return res.json({...data, status: 200})
  } catch (e) {
    console.log(e.message)
    res.status(400)
    return res.json({status: 400})
  }
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
