'use strict';
var proxy = require('../_lib/proxy');

module.exports = async function (context, req) {
  var out = await proxy.handle({
    op: context.bindingData.op,
    method: req.method,
    headers: req.headers || {},
    query: req.query || {},
    rawBody: req.rawBody
  }, process.env, fetch);
  context.res = {
    status: out.status,
    headers: out.headers,
    body: out.body,
    isRaw: true
  };
};
