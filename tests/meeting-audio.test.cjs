const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const Module = require('node:module');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/lib/meetingAudio.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = new Module(__filename); mod._compile(compiled, __filename);
const { uploadRecording, recordingPath, MAX_AUDIO_BYTES } = mod.exports;
function mock(uploadError = null, data = [], readError = null) {
  const calls = [];
  return { calls, client: { storage: { from(bucket) {
    assert.equal(bucket, 'meeting-audio');
    return {
      async upload(...args) { calls.push(args); return { error: uploadError }; },
      async list() { return { data, error: readError }; },
    };
  } } } };
}
const file = new Blob(['recording'], { type: 'audio/webm;codecs=opus' });
test('successful upload is private-bucket, immutable and strips codec suffix', async () => {
  const m = mock(); await uploadRecording(m.client, 'meeting/segment.webm', file);
  assert.equal(m.calls.length, 1);
  assert.deepEqual(m.calls[0][2], { contentType: 'audio/webm', upsert: false });
});
test('unsupported size and empty files never upload', async () => {
  const m = mock();
  await assert.rejects(uploadRecording(m.client,'x',new Blob([])), /빈/);
  await assert.rejects(uploadRecording(m.client,'x',{ size: MAX_AUDIO_BYTES + 1 }), /50MB/);
  assert.equal(m.calls.length,0);
});
test('network failure remains a visible retryable failure', async () => {
  await assert.rejects(uploadRecording(mock({message:'Network error'}).client,'m/f.webm',file), /Network error/);
});
test('retry after lost success response accepts only matching existing object', async () => {
  const m = mock({statusCode:409,message:'Duplicate'},[{name:'f.webm',metadata:{size:file.size}}]);
  await uploadRecording(m.client,'m/f.webm',file);
  assert.equal(m.calls[0][0],'m/f.webm');
});
test('duplicate response with different size is not marked saved', async () => {
  await assert.rejects(uploadRecording(mock({statusCode:409,message:'Duplicate'},[{name:'f.webm',metadata:{size:1}}]).client,'m/f.webm',file));
});
test('duplicate response without readable object is not marked saved', async () => {
  await assert.rejects(uploadRecording(mock({statusCode:409,message:'Duplicate'},[],{message:'denied'}).client,'m/f.webm',file));
});
test('access denied cannot be disguised as successful retry', async () => {
  await assert.rejects(uploadRecording(mock({statusCode:403,message:'denied'},[{name:'f.webm',metadata:{size:file.size}}]).client,'m/f.webm',file), /denied/);
});
test('Safari MP4 and WebM recordings retain distinct file extensions', () => {
  assert.equal(recordingPath('m','s','audio/mp4'),'m/s.m4a');
  assert.equal(recordingPath('m','s','audio/webm;codecs=opus'),'m/s.webm');
});
