import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
@Component({selector:'app-staff-workspace',standalone:true,imports:[FormsModule,CurrencyPipe,DatePipe],templateUrl:'./staff-workspace.component.html'})
export class StaffWorkspaceComponent {
  private http=inject(HttpClient);
  readonly canSave=input.required<boolean>(); readonly panel=input('overview');readonly refreshToken=input(0);
  readonly busyChanged=output<boolean>();readonly panelChanged=output<string>();readonly sessionEnded=output<void>();
  readonly data=signal<any>(null);readonly loading=signal(false);readonly busy=signal(false);readonly error=signal('');readonly message=signal('');
  readonly query=signal('');readonly inventoryFilter=signal('all');readonly orderFilter=signal('all');
  readonly detail=signal<any>(null);readonly adjustment=signal<any>(null);
  quantity:number|null=null;reason='';eventNote='';
  readonly statuses=['Received','Paid','In assembly','Ready to ship','Handed to shipper','On its way','Delivered to customer'];
  readonly eventNames:Record<string,string>={E3:'Assembly started',E4:'Moved to shipping room',E5:'Handed to carrier',E6:'In transit',E7:'Delivery confirmed'};
  readonly inventory=computed(()=> (this.data()?.inventory||[]).filter((v:any)=> (v.name+' '+v.sku+' '+v.category+' '+v.room+' '+v.options.map((o:any)=>o.value).join(' ')).toLowerCase().includes(this.query().trim().toLowerCase()) && (this.inventoryFilter()==='all'||(this.inventoryFilter()==='low'?v.stock>0&&v.stock<=5:v.stock===0))));
  readonly orders=computed(()=>(this.data()?.orders||[]).filter((o:any)=>(o.orderNumber+' '+o.customer.fullName).toLowerCase().includes(this.query().trim().toLowerCase())&&(this.orderFilter()==='all'||o.status===this.orderFilter())));
  constructor(){effect(()=>this.busyChanged.emit(this.busy()));effect(()=>{this.refreshToken();const p=this.panel();if(this.canSave()&&p!=='products')this.load();});}
  choose(panel:string){this.query.set('');this.detail.set(null);this.adjustment.set(null);this.error.set('');this.message.set('');this.panelChanged.emit(panel);}
  metric(panel:string,filter='all'){this.inventoryFilter.set(filter);this.choose(panel);}
  load(){if(!this.canSave())return;this.loading.set(true);this.error.set('');this.http.get('/api/admin/workspace').subscribe({next:r=>{this.data.set(r);this.loading.set(false)},error:e=>{this.fail(e);this.loading.set(false)}});}
  adjust(row:any){this.adjustment.set({...row});this.quantity=row.stock;this.reason='';this.error.set('');this.message.set('');}
  saveStock(){const row=this.adjustment();if(!row||this.busy()||!this.canSave())return;if(!Number.isSafeInteger(this.quantity)||this.quantity===null||this.quantity<0||this.quantity>999999||this.reason.trim().length<3){this.error.set('Enter whole stock and a reason of at least 3 characters.');return;}this.busy.set(true);this.http.post('/api/admin/inventory/'+row.variantId,{quantity:this.quantity,expectedStock:row.stock,reason:this.reason},{headers:{'X-Admin-Request':'1'}}).subscribe({next:()=>{this.busy.set(false);this.adjustment.set(null);this.message.set('Stock updated and the adjustment recorded.');this.load()},error:e=>{this.busy.set(false);this.fail(e)}});}
  openOrder(id:number){this.error.set('');this.http.get<any>('/api/admin/orders/'+id).subscribe({next:r=>{this.detail.set(r.order);this.eventNote='';},error:e=>this.fail(e)});}
  event(){const o=this.detail();if(!o||this.busy()||!this.canSave())return;this.busy.set(true);this.http.post<any>('/api/admin/orders/'+o.id+'/events',{event:o.nextEvent,expectedStatus:o.status,note:this.eventNote},{headers:{'X-Admin-Request':'1'}}).subscribe({next:r=>{this.detail.set(r.order);this.eventNote='';this.busy.set(false);this.message.set('Order event recorded.');this.load()},error:e=>{this.busy.set(false);this.fail(e);if(e.status===409)this.openOrder(o.id)}});}
  checkPayment(){const o=this.detail();if(!o||this.busy()||!this.canSave())return;this.busy.set(true);this.http.post<any>('/api/admin/orders/'+o.id+'/payment',{}, {headers:{'X-Admin-Request':'1'}}).subscribe({next:r=>{this.detail.set(r.order);this.busy.set(false);this.load()},error:e=>{this.busy.set(false);this.fail(e)}});}
  private fail(e:any){if(e.status===401)this.sessionEnded.emit();this.error.set(e.error?.error||'Could not load the staff data. Please try again.');}
}
