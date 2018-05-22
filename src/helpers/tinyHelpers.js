const asleep = (sleepTime) => {
  let promise = new Promise(async(resolve, reject) => {
    setTimeout(() => { resolve(true) }, sleepTime)
  })
  return promise
}

const starlog = (m) => {
  const l = m.length
  const s = Array(l+9).join("*")
  console.log(`\n${s}\n*** ${m} ***\n${s}\n`)
}

const NS_PER_SEC = 1e9
const addTiming = (timings,startTime,type) => {
  const diff = process.hrtime(startTime)
  const microseconds = Math.round((diff[0] * NS_PER_SEC + diff[1])/1000)
  timings[type] = microseconds
}

const genPassword = function() {
  let chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let size = Math.floor(Math.random() *30) + 10
  let password = []
  for (let i = 0; i < size; i++) password.push(chars[Math.floor(Math.random() * chars.length)])
  password = password.join("")
  return password
}

module.exports = {
  asleep,
  starlog,
  addTiming,
  genPassword
}
