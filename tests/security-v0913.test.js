import test from 'node:test';
import assert from 'node:assert/strict';
import {sealSpeechKey,unlockSpeech,validVault} from '../speech-vault.js';
import {defaultState,makeBackup,parseBackup} from '../storage.js';
import {prepareVerifiedBackup} from '../backup-integrity.js';
import {readFileSync} from 'node:fs';
test('legacy PINs and v2 passphrases survive backup restore; rotation does not alter old backup',async()=>{
 const state=defaultState(),pin=await sealSpeechKey('1234','dummy-key');state.speechVault=pin.speechVault;assert.equal(pin.speechVault.version,1);
 const old=makeBackup(state);const phrase='correct horse battery lantern';const next=await sealSpeechKey(phrase,(await unlockSpeech(pin.speechVault,'1234')).key);state.speechVault=next.speechVault;assert.equal(next.speechVault.version,2);assert.equal(next.deviceKey.extractable,false);
 const {json}=prepareVerifiedBackup(state);assert.ok(!json.includes(phrase)&&!json.includes('dummy-key')&&!json.includes('deviceKey'));
 const restored=parseBackup(JSON.parse(json));assert.equal((await unlockSpeech(restored.speechVault,phrase)).key,'dummy-key');await assert.rejects(unlockSpeech(restored.speechVault,'1234'));await assert.rejects(unlockSpeech(restored.speechVault,'wrong long passphrase'),/Passphrase/);assert.equal((await unlockSpeech(parseBackup(old).speechVault,'1234')).key,'dummy-key');
 const corrupt={...next.speechVault,data:'AAAA'};assert.equal(validVault(corrupt),false);await assert.rejects(unlockSpeech(corrupt,phrase));await assert.rejects(sealSpeechKey('short','dummy-key'));
});
test('standalone security policy permits required assets but blocks inline scripts and framing',()=>{
 const headers=readFileSync(new URL('../_headers',import.meta.url),'utf8');assert.match(headers,/script-src 'self';/);assert.match(headers,/frame-ancestors 'none'/);assert.match(headers,/object-src 'none'/);assert.match(headers,/https:\/\/\*\.tts\.speech\.microsoft\.com/);assert.match(headers,/https:\/\/cdn\.jsdelivr\.net/);assert.doesNotMatch(readFileSync(new URL('../app.js',import.meta.url),'utf8'),/onclick="location\.reload/);
});
