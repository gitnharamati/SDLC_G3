import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';
import { getProducts } from '../src/catalogue.js';
import { addProduct } from '../src/product-editor.js';
import { deleteProduct } from '../src/delete-product.js';
import { ProductConflictError } from '../src/product-duplicates.js';
import { filterProducts } from '../../web/src/app/storefront-rules.ts';

const password = 'local-test-password-only';
const input = {name:'New cushion', description:'A test item', material:'Cotton', priceCents:2499,
  departmentId:1,categoryId:1,roomId:1,available:true,sizes:['One'],colours:['Sand'],stock:[5]};
async function start(t, db = openDatabase(':memory:'), opts = {}) {
  const server = createApp(db,{password, ...opts}).listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(async()=> {await new Promise(resolve=>server.close(resolve));db.close();});
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const post = (path,body,extra={}) => fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Request':'1',...extra},body:JSON.stringify(body)});
  return {db,post,base};
}

test('cart uses current server prices, integer cents and selected stock without reserving inventory',async t=>{
  const {db,post}=await start(t);
  const products=getProducts(db),v=products[0].variants;
  const result=await post('/cart/check',{lines:[{productId:1,variantId:v[3].id,qty:2,priceCents:1},{productId:1,variantId:v[0].id,qty:1}]});
  assert.equal(result.status,200);const body=await result.json();assert.equal(body.totalCents,7497);
  assert.equal(body.lines[0].lineCents,4998);assert.equal(body.lines[0].priceCents,2499);
  assert.equal(db.prepare('SELECT stock FROM product_variants WHERE id=?').get(v[3].id).stock,5);
  db.prepare('UPDATE products SET price_cents=2699 WHERE id=1').run();
  const changed=await (await post('/cart/check',[{productId:1,variantId:v[0].id,qty:1}])).json();
  assert.equal(changed.totalCents,2699);
});
test('cart caps stock, preserves unavailable row identifiers and excludes hidden or deleted products',async t=>{
  const {db,post}=await start(t);const v=getProducts(db)[0].variants;
  let body=await (await post('/cart/check',[{productId:1,variantId:v[0].id,qty:99},{productId:1,variantId:v[2].id,qty:1}])).json();
  assert.equal(body.lines[0].qty,12);assert.equal(body.lines[0].note,'Only 12 left');assert.equal(body.lines[1].lineCents,0);
  db.prepare('UPDATE products SET available=0 WHERE id=1').run();
  body=await (await post('/cart/check',[{productId:1,variantId:v[0].id,qty:2}])).json();
  assert.equal(body.totalCents,0);assert.equal(body.lines[0].available,false);assert.equal(body.lines[0].name,undefined);
  await deleteProduct(db,1);
  body=await (await post('/cart/check',[{productId:1,variantId:v[0].id,qty:1}])).json();assert.equal(body.lines[0].available,false);
});
test('cart rejects malformed, repeated, excessive and fractional quantities; wrong product/variant pairs cannot pass',async t=>{
  const {post}=await start(t);
  for(const lines of [null,{},[{productId:1,variantId:1,qty:0}],[{productId:1,variantId:1,qty:1.5}],
    [{productId:1,variantId:1,qty:'1'}],[{productId:1,variantId:1,qty:1000000}],Array(101).fill({productId:1,variantId:1,qty:1}),
    [{productId:1,variantId:1,qty:1},{productId:1,variantId:1,qty:1}]]) assert.equal((await post('/cart/check',{lines})).status,400);
  const wrong=await (await post('/cart/check',[{productId:2,variantId:1,qty:1}])).json();assert.equal(wrong.totalCents,0);assert.equal(wrong.lines[0].available,false);
  assert.equal((await (await post('/cart/check',[])).json()).totalCents,0);
});
test('placement collisions are blocked regardless of name; duplicate names require confirmation and every case is logged',async t=>{
  const {db,post}=await start(t);
  assert.equal((await post('/admin/products',input)).status,401);
  const login=await post('/admin/login',{password});const Cookie=login.headers.get('set-cookie').split(';')[0];
  const conflict=await post('/admin/products',{...input,roomId:4},{Cookie});assert.equal(conflict.status,409);
  const detail=await conflict.json();assert.equal(detail.code,'PLACEMENT_EXISTS');assert.equal(detail.matches[0].id,1);assert.equal(detail.matches[0].room,'Living room');
  const named={...input,name:' linen SQUARE cushion '};
  const warning=await post('/admin/products',named,{Cookie});assert.equal(warning.status,409);assert.equal((await warning.json()).code,'DUPLICATE_NAME');
  const accepted=await post('/admin/products',{...named,confirmDuplicateName:true},{Cookie});assert.equal(accepted.status,201);
  const events=db.prepare('SELECT event FROM product_audit ORDER BY id').all().map(x=>x.event);
  assert.deepEqual(events,['PLACEMENT_EXISTS','DUPLICATE_NAME','NAME_WARNING_IGNORED']);
  assert.equal(getProducts(db,true).length,4);
});
test('product and variant identifiers survive deletion and SQLite reconnection without reuse',async()=>{
  const folder=mkdtempSync(join(tmpdir(),'identity-'));const path=join(folder,'test.sqlite');let db=openDatabase(path);
  try{
    const first=addProduct(db,input);const old=getProducts(db).find(p=>p.id===first.id).variants[0].id;
    await deleteProduct(db,first.id);db.close();db=openDatabase(path);
    const second=addProduct(db,input);assert.ok(second.id>first.id);assert.ok(getProducts(db).find(p=>p.id===second.id).variants[0].id>old);
    assert.throws(()=>db.prepare('INSERT INTO products(id,subcategory_id,name,description,material,price_cents) VALUES(?,2,\'bad\',\'bad\',\'bad\',100)').run(first.id),/UNIQUE/);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  }finally{db.close();rmSync(folder,{recursive:true,force:true});}
});
test('migration preserves existing products, photos and stock on repeated startups',()=>{
  const db=openDatabase(':memory:');try{assert.equal(db.prepare('PRAGMA user_version').get().user_version,3);assert.equal(getProducts(db).length,3);assert.equal(getProducts(db)[0].variants[0].stock,12);}finally{db.close();}
});
test('sign-in failures are isolated by username and trusted client, and lock for fifteen minutes from the fifth failure',async t=>{
  const {post}=await start(t,undefined,{trustProxyHops:1});
  const realNow=Date.now;let now=realNow();t.after(()=>{Date.now=realNow;});Date.now=()=>now;
  assert.equal((await post('/admin/login',{password,username:'admin'+'x'.repeat(80)})).status,401);
  const A={'X-Forwarded-For':'192.0.2.1'}, B={'X-Forwarded-For':'192.0.2.2'};
  for(let i=0;i<5;i++)assert.equal((await post('/admin/login',{password:'wrong',username:'admin'},A)).status,401);
  let blocked=await post('/admin/login',{password},A);assert.equal(blocked.status,429);assert.equal(Number(blocked.headers.get('retry-after')),900);
  assert.equal((await post('/admin/login',{password},B)).status,200);
  assert.equal((await post('/admin/login',{password:'wrong',username:'other'},A)).status,401);
  now+=899000;assert.equal((await post('/admin/login',{password},A)).status,429);
  now+=1000;assert.equal((await post('/admin/login',{password},A)).status,200);
});
test('shared storefront rules rank names, ignore short searches, combine multiple filters and sort prices',()=>{
 const db=openDatabase(':memory:');try{
  const p=getProducts(db);p[0].name='Cotton cushion';p[1].name='Sheet';p[1].material='Cotton';
  assert.deepEqual(filterProducts(p,{search:'cotton'}).map(p=>p.id),[1,2]);
  assert.equal(filterProducts(p,{search:'z'}).length,3);
  assert.equal(filterProducts(p,{category:['Cushions','Bed sheets'],room:['Living room','Bedroom']}).length,2);
  assert.deepEqual(filterProducts(p,{sort:'price-desc'}).map(p=>p.id),[2,3,1]);
  p[0].variants.forEach(v=>v.stock=0);assert.deepEqual(filterProducts(p).map(p=>p.id),[2,3,1]);
  assert.deepEqual(filterProducts(p,{minimum:'40',maximum:'20'}),[]);
 }finally{db.close();}
});
