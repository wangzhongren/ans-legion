import test from 'node:test';
import assert from 'node:assert/strict';
import { readyTaskBatch } from '../../src/models/workbench.mjs';
const task=(id,roleId,dependsOn=[])=>({id,roleId,dependsOn});
const state=(id,status='pending',results=[])=>({id,status,results});
test('ready-set bounds different roles, serializes whole role and waits for dependency runtime drain',()=>{
 const tasks=[task('a','A'),task('b','A'),task('c','C'),task('d','D'),task('e','E'),task('f','F'),task('g','G',['a'])];
 const states=tasks.map(t=>state(t.id));
 assert.deepEqual(readyTaskBatch(tasks,states,new Set()).map(t=>t.id),['a','c','d','e']);
 assert.deepEqual(readyTaskBatch(tasks,states,new Set(['a'])).map(t=>t.id),['c','d','e']);
 states[0].status='completed';
 assert.equal(readyTaskBatch(tasks,states,new Set(['a'])).some(t=>t.id==='g'),false);
 assert.deepEqual(readyTaskBatch(tasks,states,new Set()).map(t=>t.id),['b','c','d','e']);
});
test('failed dependency cannot release development; actual failed mutation releases only independent Acceptance',()=>{
 const tasks=[task('a','A'),task('b','B',['a']),task('c','C'),{...task('z','Acceptance',['a']),accepts:['a']}];
 const states=[state('a','failed'),state('b'),state('c'),state('z')];
 assert.deepEqual(readyTaskBatch(tasks,states,new Set()).map(t=>t.id),['c']);
 states[0].results=[{success:true,observedMutation:true,auditFailed:false}];
 assert.deepEqual(readyTaskBatch(tasks,states,new Set()).map(t=>t.id),['c','z']);
});
