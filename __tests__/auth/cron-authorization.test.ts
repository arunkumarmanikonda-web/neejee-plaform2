import test from 'node:test';
import assert from 'node:assert/strict';
import { cronAuthorized } from '../../lib/cron/authorize';

test('cron jobs require a configured nonblank secret in every environment', () => {
  const request = new Request('https://example.test/job?key=', {headers:{authorization:'Bearer '}});
  assert.equal(cronAuthorized(request,''), false);
  assert.equal(cronAuthorized(request,'  '), false);
});

test('scheduled jobs accept credentials only in the authorization header', () => {
  const valid='sample-credential';
  const withHeader=new Request('https://example.test/job',{headers:{authorization:'Bearer '+valid}});
  const withQuery=new Request('https://example.test/job?key=sample-credential');
  assert.equal(cronAuthorized(withHeader,valid),true);
  assert.equal(cronAuthorized(withQuery,valid),false);
  assert.equal(cronAuthorized(withHeader,'another-credential'),false);
});
