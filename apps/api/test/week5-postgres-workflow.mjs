import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { addProduct } from '../src/product-editor.js';
import { getProducts } from '../src/catalogue.js';
import { deleteProduct } from '../src/delete-product.js';

export async function week5Postgres(db, t) {
 const password='postgres-week5-test-password';
 const server=createApp(db,{password}).listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}/api`;
 const post=(path,body,Cookie='')=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Request':'1',Cookie},body:JSON.stringify(body)});
 const item={name:'Week 5 cushion',description:'Test record.',material:'Cotton',priceCents:2499,departmentId:1,categoryId:1,roomId:1,available:true,sizes:['One'],colours:['Sand'],stock:[3]};
 try{
  const login=await post('/admin/login',{password});const cookie=login.headers.get('set-cookie').split(';')[0];
  const created=await addProduct(db,item);
  await t.test('PostgreSQL cart uses authoritative prices and does not change stock',async()=>{
   const p=(await getProducts(db)).find(p=>p.id===created.id),id=p.variants[0].id;
   const checked=await post('/cart/check',[{productId:p.id,variantId:id,qty:2,priceCents:1}]);assert.equal(checked.status,200);
   assert.equal((await checked.json()).totalCents,4998);
   assert.equal((await db.pool.query('SELECT stock FROM product_variants WHERE id=$1',[id])).rows[0].stock,3);
  });
  await t.test('PostgreSQL same-placement collisions and duplicate-name acknowledgement are audited',async()=>{
   const blocked=await post('/admin/products',{...item,name:'Another name'},cookie);assert.equal(blocked.status,409);assert.equal((await blocked.json()).code,'PLACEMENT_EXISTS');
   const warned=await post('/admin/products',{...item,roomId:2},cookie);assert.equal(warned.status,409);assert.equal((await warned.json()).code,'DUPLICATE_NAME');
   const accepted=await post('/admin/products',{...item,roomId:2,confirmDuplicateName:true},cookie);assert.equal(accepted.status,201);
   assert.deepEqual((await db.pool.query('SELECT event FROM product_audit ORDER BY id')).rows.map(r=>r.event),['PLACEMENT_EXISTS','DUPLICATE_NAME','NAME_WARNING_IGNORED']);
  });
  await t.test('concurrent PostgreSQL requests create only one product in a free placement',async()=>{
   const attempts=await Promise.allSettled(Array.from({length:4},()=>addProduct(db,{...item,name:'Concurrent product',roomId:3})));
   assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
   assert.equal(attempts.filter(r=>r.status==='rejected' && r.reason.code==='PLACEMENT_EXISTS').length,3);
   assert.equal((await db.pool.query('SELECT count(*)::int n FROM products WHERE subcategory_id=3')).rows[0].n,1);
  });
  await t.test('PostgreSQL deleted product and variant ids are not reused and old cart lines stay unavailable',async()=>{
   const old=(await getProducts(db)).find(p=>p.id===created.id);await deleteProduct(db,old.id);
   const next=await addProduct(db,{...item,name:'Replacement product'});assert.ok(next.id>old.id);
   const fresh=(await getProducts(db)).find(p=>p.id===next.id);assert.ok(fresh.variants[0].id>old.variants[0].id);
   const checked=await (await post('/cart/check',[{productId:old.id,variantId:old.variants[0].id,qty:1}])).json();assert.equal(checked.lines[0].available,false);
  });
 }finally{await new Promise(resolve=>server.close(resolve));}
}
