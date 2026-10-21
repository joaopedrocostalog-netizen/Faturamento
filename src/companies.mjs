/** Separação por empresa proprietária (campo empresa do DSS), jamais pelo parceiro. */
export const COMPANY_ALL='all';
export const COMPANY_UNIDENTIFIED='unidentified';
export const COSTALOG_COMPANIES=Object.freeze(['A.C DA COSTA DELIBERALI','COMEX COSTA LOG','CRC COSTA','IDEALLOG']);
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toUpperCase();
const map=new Map([
 ['ACDACOSTADELIBERALI','A.C DA COSTA DELIBERALI'],
 ['ACDACOSTADELIBERALILTDA','A.C DA COSTA DELIBERALI'],
 ['COMEXCOSTALOG','COMEX COSTA LOG'],
 ['COMERCIOEXTERIORCOSTALOG','COMEX COSTA LOG'],
 ['COMERCIOEXTERIORCOSTALOGLTDA','COMEX COSTA LOG'],
 ['CRCCOSTA','CRC COSTA'],['CRCDACOSTA','CRC COSTA'],['CRCDACOSTALTDA','CRC COSTA'],
 ['IDEALLOG','IDEALLOG'],['IDEALLOGTRANSPORTES','IDEALLOG'],['IDEALLOGTRANSPORTESLTDA','IDEALLOG']
]);
export function companyOfReceivable(row){
 const value=row?.empresa;
 if(value===null||value===undefined||String(value).trim()==='')return COMPANY_UNIDENTIFIED;
 return map.get(norm(value))||COMPANY_UNIDENTIFIED;
}
const cache=new WeakMap();
export function receivablesByCompany(rows,company=COMPANY_ALL){
 if(!Array.isArray(rows))return [];
 if(company===COMPANY_ALL)return rows;
 if(company!==COMPANY_UNIDENTIFIED&&!COSTALOG_COMPANIES.includes(company))return [];
 let entries=cache.get(rows);
 if(!entries){entries=new Map();cache.set(rows,entries);}
 if(!entries.has(company))entries.set(company,rows.filter(r=>companyOfReceivable(r)===company));
 return entries.get(company);
}
export function companyDistribution(rows){
 const counts=new Map([...COSTALOG_COMPANIES,COMPANY_UNIDENTIFIED].map(k=>[k,0]));
 for(const row of rows||[]){
  const key=companyOfReceivable(row);
  counts.set(key,counts.get(key)+1);
 }
 return [...counts].map(([name,count])=>({name,count}));
}
