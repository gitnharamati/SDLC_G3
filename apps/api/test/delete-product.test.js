import test from 'node:test';
import { openDatabase } from '../src/database.js';
import { deleteWorkflow } from './delete-workflow.mjs';
test('SQLite admin product deletion', async t=>{
  const db=openDatabase(':memory:');
  try {await deleteWorkflow(db,t);} finally {db.close();}
});
