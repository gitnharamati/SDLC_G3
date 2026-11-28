import { Router } from 'express';
import { placeOrder, recoverOrder, paymentMode } from './orders.js';
import { OrderError } from './order-store.js';
export function orderResponse(error,res,next){if(error instanceof OrderError)return res.status(error.status).json({error:error.message,code:error.code,...error.extra});return next(error);}
export function checkoutRouter(db,options={}) {
  const router=Router(),mode=paymentMode(options.paymentMode);
  router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
  router.post('/orders',async(req,res,next)=>{
    if(req.get('X-Checkout-Request')!=='1')return res.status(403).json({error:'Request not allowed.'});
    try{return res.status(201).json({order:await placeOrder(db,req.body,mode)});}catch(error){return orderResponse(error,res,next);}
  });
  router.post('/recover',async(req,res,next)=>{
    if(req.get('X-Checkout-Request')!=='1')return res.status(403).json({error:'Request not allowed.'});
    try{return res.json({order:await recoverOrder(db,req.body?.attemptId)});}catch(error){return orderResponse(error,res,next);}
  });return router;
}
