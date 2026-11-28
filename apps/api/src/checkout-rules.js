import { OrderError } from './order-store.js';
export const provinces = ['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'];
export function checkoutInput(input) {
  const customer = {}, fields = {};
  for (const [key, min, max, label] of [['fullName',2,80,'full name'],['address1',1,100,'street address'],['address2',0,100,'address line 2'],['city',1,60,'city'],['notes',0,200,'delivery notes']]) {
    const value = typeof input?.customer?.[key] === 'string' ? input.customer[key].trim() : '';
    customer[key] = value;
    if (value.length < min || value.length > max) fields[key] = 'Enter a valid ' + label + (max ? ' (up to '+max+' characters).' : '.');
  }
  const email = input?.customer?.email, mobile = input?.customer?.mobile;
  customer.email = typeof email === 'string' ? email.trim() : '';
  customer.mobile = typeof mobile === 'string' ? mobile.replace(/[\s()\-]/g, '') : '';
  if (customer.email && (customer.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))) fields.email = 'Enter an email like name@example.com.';
  if (customer.mobile && !/^\d{10}$/.test(customer.mobile)) fields.mobile = 'Enter a 10-digit mobile number.';
  if (!customer.email && !customer.mobile) fields.email = 'Enter an email or a 10-digit mobile number.';
  customer.province = typeof input?.customer?.province === 'string' ? input.customer.province : '';
  if (!provinces.includes(customer.province)) fields.province = 'Choose a province or territory.';
  const postal = typeof input?.customer?.postalCode === 'string' ? input.customer.postalCode.replace(/\s/g,'').toUpperCase() : '';
  if (!/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTVWXYZ]\d[ABCEGHJ-NPRSTVWXYZ]\d$/.test(postal)) fields.postalCode = 'Enter a postal code like K1A 0B1.';
  customer.postalCode = postal.slice(0,3)+' '+postal.slice(3);
  if (Object.keys(fields).length) throw new OrderError('Check the highlighted checkout fields.', 'CHECKOUT_FIELDS',400,{fields});
  if (typeof input?.attemptId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.attemptId)) throw new OrderError('Start a new checkout attempt.');
  if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 100 || input.lines.some(l => !l || ![l.productId,l.variantId,l.qty,l.priceCents].every(Number.isSafeInteger) || l.productId < 1 || l.variantId < 1 || l.qty < 1 || l.qty > 999999 || l.priceCents < 1) || new Set(input.lines.map(l=>l.variantId)).size !== input.lines.length) throw new OrderError('Check the items and quantities in your cart.');
  return { attemptId:input.attemptId.toLowerCase(), customer, lines:input.lines.map(({productId,variantId,qty,priceCents})=>({productId,variantId,qty,priceCents})).sort((a,b)=>a.variantId-b.variantId) };
}
