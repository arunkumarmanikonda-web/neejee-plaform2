const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const test = require('node:test')
const source = fs.readFileSync(path.join(__dirname, '../../public/sw.js'), 'utf8')
function worker(network) {
  const listeners = {}, saved = new Map(), offline = new Response('offline')
  const cache = {
    match: async req => req === '/offline' ? offline : saved.get(req.url),
    put: async (req, res) => saved.set(typeof req === 'string' ? req : req.url, res),
  }
  vm.runInNewContext(source, {self:{location:{origin:'https://www.neejee.com'}, addEventListener:(n,fn)=>listeners[n]=fn},
    caches:{open:async()=>cache}, fetch:network, URL, Response})
  function response(pathName, mode) {
    let result
    listeners.fetch({request:{url:new URL(pathName,'https://www.neejee.com').href,mode,method:'GET',headers:new Headers()},respondWith:p=>result=p})
    return result
  }
  return {response,saved}
}
test('private HTML is never retained and an offline order returns the generic fallback', async () => {
  const online=worker(async()=>new Response('private order'))
  assert.equal(await (await online.response('/checkout','navigate')).text(),'private order')
  assert.equal(online.saved.size,0)
  const offline=worker(async()=>{throw Error('offline')})
  assert.equal(await (await offline.response('/order/private-token','navigate')).text(),'offline')
  assert.equal(offline.response('/api/orders','cors'),undefined)
})
test('foreign, arbitrary image paths and non-navigation framework data bypass the cache', () => {
  const w=worker(async()=>{throw Error('unexpected request')})
  for(const url of ['https://external.invalid/brand/image.jpg','/account/team.png','/staff/item.webp','/_next/data/release/account.json'])
    assert.equal(w.response(url,'cors'),undefined)
})
