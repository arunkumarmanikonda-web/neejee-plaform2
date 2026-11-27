import test from 'node:test';
import assert from 'node:assert/strict';
import { cronAuthorized } from '../../lib/cron/authorize';

test('cron jobs require a configured nonblank secret in every environment', () => {
  const request = new Request('https://example.test/job?key=', {headers:{authorization:'Bearer '}});
  assert.equal(cronAuthorized(request,false,''), false);
  assert.equal(cronAuthorized(request,true,'  '), false);
});

test('a bearer credential works on every route and legacy query permission is explicit', () => {
  const valid='sample-credential';
  const withHeader=new Request('https://example.test/job',{headers:{authorization:'Bearer '+valid}});
  const withQuery=new Request('https://example.test/job?key=sample-credential');
  assert.equal(cronAuthorized(withHeader,false,valid),true);
  assert.equal(cronAuthorized(withQuery,false,valid),false);
  assert.equal(cronAuthorized(withQuery,true,valid),true);
  assert.equal(cronAuthorized(withHeader,true,'another-credential'),false);
});
