import { getStore } from "@netlify/blobs";
import { randomBytes, createHash } from "node:crypto";

const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const valid=(id)=>/^([1-9]|[1-3]\d|4[0-4])$/.test(String(id));
const hash=(value)=>createHash('sha256').update(value).digest('hex');
export default async (request)=>{
 try{
  const store=getStore({name:'duda-kauan-reservas-v1',consistency:'strong'});
  if(request.method==='GET'){
   const ids=Array.from({length:44},(_,i)=>String(i+1));
   const results=await Promise.all(ids.map(id=>store.getJSON('presente-'+id,{consistency:'strong'})));
   const reserved={}; ids.forEach((id,i)=>reserved[id]=results[i]?.reserved===true);
   return json({reserved});
  }
  if(request.method!=='POST')return json({error:'Método não permitido'},405);
  const body=await request.json().catch(()=>null);
  if(!body||!valid(body.id))return json({error:'Presente inválido'},400);
  const id=String(body.id),key='presente-'+id;
  const entry=await store.getWithMetadata(key,{type:'json',consistency:'strong'});
  if(body.action==='reserve'){
   if(entry?.data?.reserved===true)return json({error:'Presente já reservado'},409);
   const token=randomBytes(24).toString('hex');
   const value={reserved:true,tokenHash:hash(token),at:new Date().toISOString()};
   const result=await store.setJSON(key,value,entry?{onlyIfMatch:entry.etag}:{onlyIfNew:true});
   if(!result.modified)return json({error:'Este presente acabou de ser reservado por outra pessoa'},409);
   return json({ok:true,token});
  }
  if(body.action==='cancel'){
   if(!entry?.data?.reserved)return json({error:'Este presente já está disponível'},409);
   if(typeof body.token!=='string'||! /^[a-f0-9]{48}$/.test(body.token)||hash(body.token)!==entry.data.tokenHash)return json({error:'Só quem reservou neste aparelho pode cancelar'},403);
   const result=await store.setJSON(key,{reserved:false}, {onlyIfMatch:entry.etag});
   if(!result.modified)return json({error:'A reserva mudou. Atualize a página'},409);
   return json({ok:true});
  }
  return json({error:'Ação desconhecida'},400);
 }catch(e){console.error(e);return json({error:'Serviço de reservas temporariamente indisponível'},503)}
};
export const config={path:'/.netlify/functions/reservas'};
