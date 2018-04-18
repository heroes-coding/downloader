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

module.exports = {
  asleep,
  starlog
}
