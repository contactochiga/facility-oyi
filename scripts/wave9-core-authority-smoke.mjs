import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let fail=false,calls=0,published=0;
const value={authority:'fixture-core'};
const request=async()=>{calls++;if(fail)throw Error('core_unavailable');return value};
const bundle=async()=>{await request();return {insights:[value],recommendations:[value],automationPlans:[value]}};
const dependencies={
  '@/services/facilityAttentionService':{loadFacilityAttention:async()=>[]},
  '@/services/oyiCoreRuntimeService':{evaluateOyiCoreRuntime:bundle,runOyiCoreConversation:request,loadOyiCoreExecutiveBriefing:request},
  '@/services/signalAwarenessService':{signalFromFacilityAttention:x=>x},
  '@/lib/runtimeSubscriptions':{ensureRuntimeSubscriptions:()=>({publishConversation:()=>published++,publishExecutive:()=>published++})},
};
for(const [file,fn,array] of [
  ['operationalReasoningService','loadOperationalInsights',true],['operationalRecommendationService','loadOperationalRecommendations',true],
  ['safeAutomationService','loadAutomationPlans',true],['conversationRuntimeService','runConversationRuntime',false],['executiveRuntimeService','loadExecutiveBriefing',false],
]){
  const source=readFileSync(`services/${file}.ts`,'utf8');
  const module={exports:{}};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
    module,exports:module.exports,require:name=>dependencies[name]||new Proxy({}, {get:()=>()=>{throw Error('local synthesis forbidden')}}),
  });
  fail=false;calls=0;assert.deepEqual(await module.exports[fn]({}),array?[value]:value);assert.equal(calls,1);
  fail=true;const before=published;await assert.rejects(()=>module.exports[fn]({}),/core_unavailable/);assert.equal(published,before);
}
console.log('PASS five Facility loaders: Core output only, one evaluation, outage rejects, no local synthesis/publication');
