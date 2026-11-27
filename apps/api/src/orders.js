import { createHash } from 'node:crypto';
import { checkoutInput } from './checkout-rules.js';
import { atomic, reader, OrderError, statuses, eventNames, now } from './order-store.js';
export function paymentMode(value = process.env.PAYMENT_SIMULATOR_MODE || 'always_paid') {
  if (!['always_paid','always_not_paid','error'].includes(value) || (process.env.NODE_ENV === 'production' && value !== 'always_paid')) throw new Error('PAYMENT_SIMULATOR_MODE must be always_paid in production.');
  return value;
}
export async function checkPayment(order, amountCents, mode) {
  if (!Number.isSafeInteger(amountCents) || amountCents < 1) throw new Error('Invalid simulator amount');
  if (mode === 'error') throw new Error('Simulated payment outage');
  return { paid: mode === 'always_paid', reference: mode === 'always_paid' ? 'SIM-'+String(order.id).padStart(6,'0') : '' };
}
export async function settlePayment(db,id,mode,manual=false) {
  return atomic(db,async(q,lock)=>{
    const [order]=await q('SELECT * FROM orders WHERE id=?'+lock,[id]);
    if (!order || order.status !== 'Received') return;
    const [{n}]=await q('SELECT COUNT(*) AS n FROM payment_attempts WHERE order_id=?',[id]);
    if (!manual && (Number(n)>=4 || (Number(n)>0 && (!order.next_payment_at || order.next_payment_at>now())))) return;
    let result='no answer',reference='';
    try { const checked=await checkPayment(order,order.total_cents,mode); result=checked.paid?'paid':'not paid';reference=checked.reference; } catch {}
    const timestamp=now();
    await q('INSERT INTO payment_attempts(order_id,attempt_no,amount_cents,result,reference,created_at) VALUES(?,?,?,?,?,?)',[id,Number(n)+1,order.total_cents,result,reference,timestamp]);
    if(result==='paid') {
      await q("UPDATE orders SET status='Paid',payment_flag='',next_payment_at=NULL WHERE id=?",[id]);
      await q('INSERT INTO order_history(order_id,event,old_status,new_status,actor,note,created_at) VALUES(?,?,?,?,?,?,?)',[id,'E2','Received','Paid','System',reference,timestamp]);
    } else {
      await q('UPDATE orders SET payment_flag=?,next_payment_at=? WHERE id=?',[result==='not paid'?'Payment not completed':'Payment check pending', result==='no answer' && Number(n)<3 ? new Date(Date.now()+60000).toISOString():null,id]);
    }
  });
}
export async function processDuePayments(db,mode) {
  const pending=await reader(db)("SELECT id FROM orders WHERE status='Received' AND next_payment_at IS NOT NULL AND next_payment_at<=? ORDER BY id LIMIT 20",[now()]);
  for(const row of pending) await settlePayment(db,row.id,mode);
}
export async function orderDetail(db,id,publicView=false) {
  const q=reader(db);const [order]=await q('SELECT * FROM orders WHERE id=?',[id]);
  if(!order)throw new OrderError('Order not found.','NOT_FOUND',404);
  const customer=JSON.parse(order.customer_json);
  const lines=(await q('SELECT product_id,variant_id,name,options_json,quantity,price_cents FROM order_lines WHERE order_id=? ORDER BY id',[id])).map(l=>({productId:l.product_id,variantId:l.variant_id,name:l.name,options:JSON.parse(l.options_json),qty:l.quantity,priceCents:l.price_cents,lineCents:l.quantity*l.price_cents}));
  const base={id:order.id,orderNumber:order.order_number,status:order.status,paymentFlag:order.payment_flag,totalCents:order.total_cents,createdAt:order.created_at,lines,testOrder:true};
  if(publicView) return {...base,contact:customer.email ? customer.email[0]+'•••@'+customer.email.split('@')[1]:'Number ending in '+customer.mobile.slice(-3),notification:'Email and SMS delivery are not connected in this preview. Please keep your order number.'};
  return {...base,customer,history:await q('SELECT event,old_status,new_status,actor,note,created_at FROM order_history WHERE order_id=? ORDER BY id',[id]),payments:await q('SELECT attempt_no,amount_cents,result,reference,created_at FROM payment_attempts WHERE order_id=? ORDER BY id',[id]),nextEvent:order.status==='Received'||order.status===statuses.at(-1)?null:'E'+(statuses.indexOf(order.status)+2)};
}
export async function recoverOrder(db,attemptId) {
  if(typeof attemptId!=='string'||!/^[a-f0-9-]{36}$/i.test(attemptId))throw new OrderError('Invalid checkout attempt.');
  const [row]=await reader(db)('SELECT id FROM orders WHERE attempt_id=?',[attemptId.toLowerCase()]);
  if(!row)throw new OrderError('No saved order for this attempt.','NOT_FOUND',404);
  return orderDetail(db,row.id,true);
}
export async function placeOrder(db,raw,mode='always_paid') {
  const input=checkoutInput(raw),digest=createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const id=await atomic(db,async(q,lock)=>{
    if(db.kind==='postgres') await q('SELECT pg_advisory_xact_lock(hashtext(?))',[input.attemptId]);
    const [existing]=await q('SELECT id,request_hash FROM orders WHERE attempt_id=?',[input.attemptId]);
    if(existing){if(existing.request_hash!==digest)throw new OrderError('This checkout attempt already belongs to another order.','ATTEMPT_REUSED',409);return existing.id;}
    const productIds=[...new Set(input.lines.map(l=>l.productId))].sort((a,b)=>a-b);
    for(const productId of productIds)await q('SELECT id FROM products WHERE id=?'+lock,[productId]);
    const validated=[],lineErrors=[];let total=0;
    for(const line of input.lines){
      const [item]=await q('SELECT v.id,v.stock,p.id AS product_id,p.name,p.price_cents,p.available FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=? AND p.id=?'+lock,[line.variantId,line.productId]);
      let note='';
      if(!item||!item.available)note='No longer available';else if(item.price_cents!==line.priceCents)note='Price changed to $'+(item.price_cents/100).toFixed(2);else if(item.stock<line.qty)note='Only '+item.stock+' left';
      if(note){lineErrors.push({variantId:line.variantId,note});continue;}
      const options=await q('SELECT t.name,o.value FROM variant_values vv JOIN option_values o ON o.id=vv.option_value_id JOIN option_types t ON t.id=o.option_type_id WHERE vv.variant_id=? ORDER BY t.id,o.id',[line.variantId]);
      if(options.length!==2)throw new OrderError('This combination is no longer available.','CART_CHANGED',409);
      validated.push({...line,name:item.name,options});total+=line.qty*item.price_cents;
    }
    if(lineErrors.length)throw new OrderError('Your cart changed. Review the highlighted items before placing the order.','CART_CHANGED',409,{lineErrors});
    if(!Number.isSafeInteger(total)||total<1||total>99999999)throw new OrderError('Reduce the cart total below $1,000,000 CAD.');
    const timestamp=now();
    const [saved]=await q("INSERT INTO orders(attempt_id,request_hash,customer_json,total_cents,status,payment_flag,next_payment_at,created_at) VALUES(?,?,?,?,'Received','Payment check pending',?,?) RETURNING id",[input.attemptId,digest,JSON.stringify(input.customer),total,timestamp,timestamp]);
    const day=timestamp.slice(2,10).replaceAll('-','');const number='HD-'+day+'-'+String(saved.id).padStart(4,'0');
    await q('UPDATE orders SET order_number=? WHERE id=?',[number,saved.id]);
    for(const line of validated){
      const changed=await q('UPDATE product_variants SET stock=stock-? WHERE id=? AND stock>=? RETURNING id',[line.qty,line.variantId,line.qty]);
      if(!changed.length)throw new OrderError('Stock changed. Review your cart.','CART_CHANGED',409);
      await q('INSERT INTO order_lines(order_id,product_id,variant_id,name,options_json,quantity,price_cents) VALUES(?,?,?,?,?,?,?)',[saved.id,line.productId,line.variantId,line.name,JSON.stringify(line.options),line.qty,line.priceCents]);
    }
    await q('INSERT INTO order_history(order_id,event,old_status,new_status,actor,note,created_at) VALUES(?,?,?,?,?,?,?)',[saved.id,'E1','','Received','System','Test order placed',timestamp]);
    return saved.id;
  });
  try { await settlePayment(db,id,mode); } catch { /* Saved order and durable pending work survive a payment failure. */ }
  return orderDetail(db,id,true);
}
export async function listOrders(db) {
  const rows=await reader(db)('SELECT id,order_number,customer_json,total_cents,status,payment_flag,created_at FROM orders ORDER BY id DESC');
  return rows.map(o=>({id:o.id,orderNumber:o.order_number,customer:JSON.parse(o.customer_json),totalCents:o.total_cents,status:o.status,paymentFlag:o.payment_flag,createdAt:o.created_at}));
}
export async function recordEvent(db,id,input,actor) {
  if(!Object.hasOwn(eventNames,input?.event))throw new OrderError('This step is recorded by the system.','SYSTEM_EVENT',409);
  const note=typeof input.note==='string'?input.note.trim():'';
  if(note.length>200)throw new OrderError('Keep the note within 200 characters.');
  await atomic(db,async(q,lock)=>{
    const [order]=await q('SELECT * FROM orders WHERE id=?'+lock,[id]);if(!order)throw new OrderError('Order not found.','NOT_FOUND',404);
    if(order.status!==input.expectedStatus)throw new OrderError('This order’s status has just changed. Reload the order.','STATUS_CHANGED',409);
    const index=statuses.indexOf(order.status);
    if(index<1||index>5||input.event!=='E'+(index+2))throw new OrderError('Record only the next event for this order.','WRONG_EVENT',409);
    await q('UPDATE orders SET status=? WHERE id=?',[statuses[index+1],id]);
    await q('INSERT INTO order_history(order_id,event,old_status,new_status,actor,note,created_at) VALUES(?,?,?,?,?,?,?)',[id,input.event,order.status,statuses[index+1],actor,note,now()]);
  });
  return orderDetail(db,id);
}
export async function adjustStock(db,variantId,input,actor) {
  if(![variantId,input?.quantity,input?.expectedStock].every(Number.isSafeInteger)||variantId<1||input.quantity<0||input.quantity>999999||input.expectedStock<0||typeof input.reason!=='string'||input.reason.trim().length<3||input.reason.trim().length>200)throw new OrderError('Enter whole stock numbers and a reason of 3 to 200 characters.');
  await atomic(db,async(q,lock)=>{
    const [link]=await q('SELECT product_id FROM product_variants WHERE id=?',[variantId]);if(!link)throw new OrderError('Combination not found.','NOT_FOUND',404);
    const [product]=await q('SELECT id,name FROM products WHERE id=?'+lock,[link.product_id]);
    const [variant]=await q('SELECT stock FROM product_variants WHERE id=?'+lock,[variantId]);
    if(!product||!variant)throw new OrderError('Combination not found.','NOT_FOUND',404);
    if(variant.stock!==input.expectedStock)throw new OrderError('Stock changed while you were editing. Reload the latest numbers.','STOCK_CHANGED',409);
    await q('UPDATE product_variants SET stock=? WHERE id=?',[input.quantity,variantId]);
    await q('INSERT INTO stock_adjustments(variant_id,product_name,previous_stock,new_stock,reason,actor,created_at) VALUES(?,?,?,?,?,?,?)',[variantId,product.name,variant.stock,input.quantity,input.reason.trim(),actor,now()]);
  });return {saved:true};
}
