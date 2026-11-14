import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const endpoint = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9533';
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function tab(width, height) {
  const target = await fetch(endpoint + '/json/new?about:blank', { method: 'PUT' }).then(r => r.json());
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map(), errors = [], requests = new Map(), failed = [];
  let id = 0;
  socket.addEventListener('message', ({data}) => {
    const { id, result, error, method, params } = JSON.parse(data);
    if (id) {
      const job = pending.get(id);
      pending.delete(id);
      error ? job.reject(new Error(error.message)) : job.resolve(result);
    }
    if (method === 'Runtime.exceptionThrown') errors.push(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text);
    if (method === 'Network.requestWillBeSent') requests.set(params.requestId, params.request.url);
    if (method === 'Network.loadingFailed' && !params.canceled) failed.push([requests.get(params.requestId), params.errorText]);
    if (method === 'Network.responseReceived' && params.response.status >= 400) failed.push([params.response.url, params.response.status]);
  });
  await new Promise(resolve => socket.addEventListener('open', resolve, {once:true}));
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id,{resolve,reject});
    socket.send(JSON.stringify({id,method,params}));
  });
  const ev = async expression => {
    const {result, exceptionDetails} = await call('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true});
    assert.ok(!exceptionDetails, exceptionDetails?.exception?.description ?? exceptionDetails?.text);
    return result.value;
  };
  const until = async (expression, timeout = 18000) => {
    const end = Date.now() + timeout;
    do { if (await ev(expression)) return; await sleep(125); } while (Date.now() < end);
    throw new Error('Timed out: ' + expression + '\n' + JSON.stringify({errors,failed}));
  };
  await Promise.all([call('Page.enable'), call('Network.enable'), call('Runtime.enable')]);
  await call('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:1,mobile:false});
  return {
    call, ev, until, errors, failed,
    go: url => call('Page.navigate',{url}),
    front: () => call('Page.bringToFront'),
    capture: async (file, format = 'png') => {
      const {data} = await call('Page.captureScreenshot', {format, ...(format === 'jpeg' && {quality:90})});
      await fs.writeFile(file, Buffer.from(data,'base64'));
    },
    click: async selector => {
      const {x,y} = await ev(`(() => {const el = document.querySelector(${JSON.stringify(selector)}); el.scrollIntoView({block:'nearest'}); const r = el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      await call('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
      await call('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
    },
    close: async () => { socket.close(); await fetch(endpoint + '/json/close/' + target.id); },
  };
}
