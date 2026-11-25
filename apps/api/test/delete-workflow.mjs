import assert from 'node:assert/strict';
import { once } from 'node:events';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import { addProduct } from '../src/product-editor.js';
import { preparePhotos } from '../src/photos.js';

export async function deleteWorkflow(db, t) {
  const query = async sql => db.kind === 'postgres' ? (await db.pool.query(sql)).rows : db.prepare(sql).all();
  const tables = ['products', 'product_photos', 'option_types', 'option_values', 'product_variants', 'variant_values', 'variant_combinations', 'variant_requirements'];
  const snapshot = async () => Object.fromEntries(await Promise.all(tables.map(async name => [name, await query(`SELECT * FROM ${name} ORDER BY ${name === 'variant_values' ? '1, 2' : '1'}`)])));
  const original = await snapshot();
  const photo = await preparePhotos([{mimetype:'image/png',buffer:await sharp({create:{width:30,height:20,channels:3,background:'#889944'}}).png().toBuffer()}]);
  const item = await addProduct(db, {name:'Temporary delete test',description:'Delete this test product only.',material:'Cotton',priceCents:2500,departmentId:1,categoryId:1,roomId:1,available:true,sizes:['Small','Large'],colours:['Sand'],stock:[3,9]}, photo);
  const photoId = (await query(`SELECT id FROM product_photos WHERE product_id = ${item.id}`))[0].id;
  const password = 'delete-test-password';
  const server = createApp(db,{password}).listen(0,'127.0.0.1'); await once(server,'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path,body,cookie='',header=true) => fetch(base+'/api/admin'+path,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,...(header?{'X-Admin-Request':'1'}:{})},body:JSON.stringify(body)});
  const path = `/products/${item.id}/delete`; let cookie;
  try {
    await t.test('deletion requires a session, request header and explicit matching confirmation', async()=>{
      assert.equal((await post(path,{confirmProductId:item.id})).status,401);
      cookie=(await post('/login',{password})).headers.get('set-cookie').split(';')[0];
      assert.equal((await post(path,{confirmProductId:item.id},cookie,false)).status,403);
      assert.equal((await post(path,{},cookie)).status,400);
      assert.equal((await post(path,{confirmProductId:item.id+1},cookie)).status,400);
      assert.ok((await query(`SELECT id FROM products WHERE id=${item.id}`)).length);
    });
    await t.test('invalid IDs and missing products return clear errors',async()=>{
      assert.equal((await post('/products/nope/delete',{confirmProductId:1},cookie)).status,400);
      assert.equal((await post('/products/999999/delete',{confirmProductId:999999},cookie)).status,404);
    });
    await t.test('a failed delete rolls back photos, stock and option records',async()=>{
      const before=await snapshot();
      if(db.kind==='postgres') await db.pool.query("CREATE FUNCTION prevent_test_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test block'; END $$; CREATE TRIGGER prevent_test_delete BEFORE DELETE ON products FOR EACH ROW EXECUTE FUNCTION prevent_test_delete()");
      else db.exec("CREATE TRIGGER prevent_test_delete BEFORE DELETE ON products BEGIN SELECT RAISE(ABORT, 'test block'); END");
      try {assert.equal((await post(path,{confirmProductId:item.id},cookie)).status,500);assert.deepEqual(await snapshot(),before);}
      finally {if(db.kind==='postgres')await db.pool.query('DROP TRIGGER prevent_test_delete ON products; DROP FUNCTION prevent_test_delete()');else db.exec('DROP TRIGGER prevent_test_delete');}
    });
    await t.test('confirmed deletion removes only that product and all its dependent records',async()=>{
      const result=await post(path,{confirmProductId:item.id},cookie);assert.equal(result.status,200);assert.equal((await result.json()).deleted,true);
      assert.deepEqual(await snapshot(),original);
      const products=(await (await fetch(base+'/api/products')).json()).products;
      assert.ok(!products.some(p=>p.id===item.id));
      assert.equal((await fetch(base+'/api/photos/'+photoId)).status,404);
      assert.equal((await post(path,{confirmProductId:item.id},cookie)).status,404);
    });
    await t.test('signing out prevents further deletes',async()=>{
      await post('/logout',{},cookie);
      assert.equal((await post('/products/1/delete',{confirmProductId:1},cookie)).status,401);
      assert.deepEqual(await snapshot(),original);
    });
  } finally {await new Promise(resolve=>server.close(resolve));}
}
