import { createHash } from 'node:crypto';

export const VERSION='0.2.0', SEED='TRSV-CONTEXT-20261031-02';
// Preserve the four v0.1 class indices. New classes follow them.
export const CLASSES=['api_token','password','email','credential_uri','private_key','phone','national_id','iban','person_name','verification_code'];
export const APPS=['terminal','ide','ci','http','people','finance','database','vault','support','error'];
export const LAYOUTS={
  terminal:['shell_transcript','service_journal','interactive_table','repl_inspector'],
  ide:['source_and_symbols','notebook_cells','review_changes','debug_variables'],
  ci:['steps_log','pipeline_jobs','environment_table','deployment_summary'],
  http:['request_headers','split_exchange','response_object','network_detail'],
  people:['employee_record','onboarding_fields','directory_detail','access_review'],
  finance:['beneficiary_form','transfer_receipt','settlement_table','payout_review'],
  database:['query_grid','record_tree','connection_form','import_mapping'],
  vault:['secret_detail','configuration_yaml','certificate_panel','version_comparison'],
  support:['ticket_thread','incident_timeline','customer_case','attachment_preview'],
  error:['traceback_context','exception_dialog','structured_failure','build_diagnostic']
};
export const SPLIT_BY_APP=Object.fromEntries(APPS.map((a,i)=>[a,i<6?'train':i<8?'val':'test']));
export const sha256=x=>createHash('sha256').update(x).digest('hex');
export const hash=(key,n=32)=>sha256(SEED+'|'+key).slice(0,n);
const number=(key,n)=>BigInt('0x'+hash(key,15)).toString().padStart(n,'0').slice(-n);
const pick=(list,key)=>list[parseInt(hash(key,4),16)%list.length];
const title=s=>s[0].toLocaleUpperCase('tr-TR')+s.slice(1);

export function mod97(iban){
  const s=iban.replaceAll(' ','').toUpperCase();
  const digits=(s.slice(4)+s.slice(0,4)).replace(/[A-Z]/g,c=>String(c.charCodeAt(0)-55));
  if(!/^\d+$/.test(digits))return -1;
  let remainder=0;for(const d of digits)remainder=(remainder*10+Number(d))%97;return remainder;
}
export function validNationalId(s){
  if(!/^[1-9]\d{10}$/.test(s))return false;
  const d=[...s].map(Number),odd=d[0]+d[2]+d[4]+d[6]+d[8],even=d[1]+d[3]+d[5]+d[7];
  return ((odd*7-even)%10+10)%10===d[9] && d.slice(0,10).reduce((a,b)=>a+b,0)%10===d[10];
}
export function valueFor(category,key,format=0){
  const h=hash(key,32);
  switch(category){
    case 'api_token': return format%3===0?h:format%3===1?Buffer.from('offline-'+h).toString('base64url'):'v2.'+h.slice(0,12)+'.'+h.slice(12);
    case 'password': return pick(['Kıyı','Duru','Bulut','Çağrı','Örgü','Gölge'],key)+'!'+h.slice(0,12)+'#';
    case 'email': return `uye.${h.slice(0,12)}@ekip-${h.slice(12,20)}.example`;
    case 'credential_uri': return `postgresql://svc_${h.slice(0,5)}:${h.slice(5,17)}@db-${h.slice(17,25)}.example/app`;
    case 'private_key': {
      // NOT a generated cryptographic key. ASCII, not DER/ASN.1; no signing/parsing library is used.
      const body=Buffer.from('OFFLINE-FIXTURE-NOT-A-KEY:'+h+hash(key+'pem',24)).toString('base64');
      return '-----BEGIN PRIVATE KEY-----\n'+body.match(/.{1,52}/g).join('\n')+'\n-----END PRIVATE KEY-----';
    }
    case 'phone': {
      const d=number(key,7);return format%2?`+90 000 ${d.slice(0,3)} ${d.slice(3,5)} ${d.slice(5)}`:`+90 (000) ${d.slice(0,3)}-${d.slice(3,5)}-${d.slice(5)}`;
    }
    case 'national_id': return '0'+number(key,9)+'1'; // leading zero AND odd final digit: deliberately invalid
    case 'iban': {
      let v='TR00'+'00000'+'0'+number(key,16);
      if(mod97(v)===1)v='TR01'+v.slice(4);
      if(mod97(v)===1)throw new Error('IBAN invalidity guard failed');
      return format%2?v.match(/.{1,4}/g).join(' '):v;
    }
    case 'person_name': {
      const first=['Ece','Eren','Deniz','Duru','Öykü','Çağla','İlke','Tuğçe','Baran','Arda','Bora','Ayça','İpek','Cem','Selin','Emre','İrem','Ozan','Nehir','Utku','Elif','Mert','Ceren','Onur','Defne','Berk','Sude','Alp','Gizem','Can','Yağmur','Kerem'];
      const prefix=['Ak','Gök','Tan','Ay','Öz','Arı','Gün','Yel','Al','Esen','Demir','Çağ','Ekin','İl','Su','Kar'];
      const middle=['soy','eren','öz','yüce','taş','deniz','gün','yel','el','tunç','duru','sever','ak','kaya','sönmez','ışık'];
      const end=['soy','el','er','öz','gün','ay','tan','alp','can','su','yel','han','ata','ak','ışık','ekin'];
      return first[parseInt(h.slice(0,2),16)%first.length]+' '+prefix[parseInt(h[2],16)]+middle[parseInt(h[3],16)]+end[parseInt(h[4],16)];
    }
    case 'verification_code': return number(key,6);
    default: throw new Error('Unknown category');
  }
}

const ROLES={
 api_token:[['Erişim belirteci','API anahtarı','Servis yetkilendirmesi'],['Access token','API credential','Service authorization'],['İçerik özeti','Paket özeti','Artefakt kimliği'],['Content digest','Package hash','Artifact identifier']],
 password:[['Hesap parolası','Veritabanı parolası','Oturum şifresi'],['Account password','Database password','Login passphrase'],['Derleme etiketi','Paket sürüm etiketi','Kanal adı'],['Build label','Release label','Channel name']],
 email:[['Kullanıcı e-postası','Kişisel e-posta','İletişim adresi'],['User email','Personal email','Contact address'],['E-posta değişkeni'],['Email variable']],
 credential_uri:[['Veritabanı bağlantısı','Bağlantı dizesi','Servis bağlantısı'],['Database connection','Connection string','Service DSN'],['Bağlantı şablonu'],['Connection template']],
 private_key:[['Özel anahtar','İmzalama anahtarı','İstemci özel anahtarı'],['Private key','Signing key','Client private key'],['Açık anahtar'],['Public key']],
 phone:[['Cep telefonu','İletişim telefonu','Kişisel telefon'],['Mobile phone','Contact phone','Personal phone'],['Telefon değişkeni'],['Phone variable']],
 national_id:[['T.C. kimlik numarası','Kimlik numarası','Çalışan TCKN'],['National identity number','Citizen ID','Employee identity number'],['İş referansı','Derleme numarası','Belge sıra numarası'],['Job reference','Build number','Document sequence']],
 iban:[['Alıcı IBAN','Maaş hesabı','Ödeme hesabı'],['Beneficiary IBAN','Payroll account','Payout account'],['Hesap değişkeni'],['Account variable']],
 person_name:[['Çalışan adı soyadı','Hesap sahibinin adı','Kişinin adı'],['Employee full name','Account holder name','Person name'],['Proje adı','Çalışma alanı adı','Paket adı'],['Project name','Workspace name','Package name']],
 verification_code:[['Tek kullanımlık kod','Doğrulama kodu','Oturum onay kodu'],['One-time code','Verification code','Login confirmation code'],['Kuyruk sıra numarası','İşlem sürüm numarası','Paket revizyonu'],['Queue sequence','Operation revision','Bundle revision']]
};
export function makeCandidate(category,key,sensitive,lang,format=0,id='v0',focal=true){
  const base=valueFor(category,key,format),li=lang==='tr'?0:1;
  let value=base,pairKind='identical_payload_context';
  if(['email','credential_uri','phone','iban'].includes(category)){
    pairKind='literal_vs_reference';
    if(!sensitive)value=category==='credential_uri'?`postgresql://\${DB_USER}:\${DB_PASS}@db-${hash(key,8)}.example/app`:'${'+({email:'USER_EMAIL',phone:'CONTACT_PHONE',iban:'PAYOUT_IBAN'}[category])+'}';
  }
  if(category==='private_key'){
    pairKind='private_vs_public_pem_marker';
    if(!sensitive)value=base.replaceAll('PRIVATE KEY','PUBLIC KEY');
  }
  const role=pick(ROLES[category][li+(sensitive?0:2)],key+'role');
  return {id,category,value,sensitive,role,language:lang,focal,pair_kind:pairKind,payload_key_hash:sha256(key),synthetic:true};
}

export function makeSpecs(){
  const out=[];
  for(let ai=0;ai<APPS.length;ai++)for(let layout=0;layout<4;layout++)for(let p=0;p<15;p++){
    const app=APPS[ai],group=`${app}.${LAYOUTS[app][layout]}`,pairId='pair_'+hash(group+'|'+p,14),key=SPLIT_BY_APP[app]+'|'+pairId;
    const language=['tr','en','mixed'][p%3],theme=parseInt(hash(key+'theme',2),16)%2?'dark':'light';
    const [width,height]=[[1280,800],[1366,864],[1440,900],[1536,960]][(p+layout)%4];
    // Plausible application-specific records: payroll screens do not show PEM keys.
    const pool=['terminal','ide','ci','vault'].includes(app)?[0,1,2,3,4,9]:['people','finance'].includes(app)?[2,5,6,7,8,9]:[0,1,2,3,4,5,6,7,8,9];
    const categories=[0,1,2].map(j=>CLASSES[pool[(p*3+layout*7+ai*3+j)%pool.length]]);
    for(const arm of ['sensitive','control']){
      const slots=categories.map((category,j)=>makeCandidate(category,key+'|'+j,arm==='sensitive',language==='mixed'?(j%2?'en':'tr'):language,p+j,`v${j}`));
      // Half the pairs retain a fourth sensitive value in BOTH arms. Controls can therefore be mixed, not just empty screens.
      if(p%2===0)slots.push(makeCandidate(CLASSES[pool[(p*3+layout*7+ai*3+4)%pool.length]],key+'|anchor',true,language==='en'?'en':'tr',p,'anchor',false));
      out.push({id:'trsv2_'+hash(pairId+'|'+arm,16),pair_id:pairId,arm,split:SPLIT_BY_APP[app],app,layout,layout_name:LAYOUTS[app][layout],
        leakage_group_id:group,application_group_id:app,source_identity_group:pairId,width,height,theme,language,
        font_pair:(p+ai)%2, font_size:[12,14,16,18][(p+layout+ai)%4],case_index:p,slots,
        source:'fully_synthetic_closed_grammar',human_verified:false,variant:'clean',negative:!slots.some(x=>x.sensitive),
        ...(['database','vault','support','error'].includes(app)?{render_revision:app+'-native-workbench-v3'+(app==='database'&&[0,3].includes(layout)?'-type-nowrap-v4':'')}:{})});
    }
  }
  return out;
}

export function safetyErrors(record){
  const errors=[];
  if(record.source!=='fully_synthetic_closed_grammar'||record.human_verified!==false)errors.push('Provenance/verification mismatch');
  for(const slot of record.slots){
    const {category,value,sensitive}=slot;
    if(!CLASSES.includes(category)||!slot.synthetic){errors.push('Unknown or non-synthetic slot');continue;}
    if(!sensitive&&slot.pair_kind==='literal_vs_reference'){
      if(!value.includes('${')||/@(?!db-)/.test(value)&&category!=='credential_uri')errors.push('Unsafe control reference');
      continue;
    }
    if(category==='national_id'&&(!/^0\d{9}1$/.test(value)||validNationalId(value)))errors.push('National ID must be deliberately invalid');
    if(category==='iban'&&(mod97(value)===1||!/^TR0[01]000000\d{16}$/.test(value.replaceAll(' ',''))))errors.push('IBAN must fail MOD97');
    if(category==='phone'&&!/^\+90[ (]+000[) ]+\d{3}[ -]\d{2}[ -]\d{2}$/.test(value))errors.push('Phone must use invalid 000 area code');
    if(category==='email'&&!/^uye\.[a-f0-9]{12}@ekip-[a-f0-9]{8}\.example$/.test(value))errors.push('Non-reserved email');
    if(category==='credential_uri'&&!/^postgresql:\/\/svc_[a-f0-9]{5}:[a-f0-9]{12}@db-[a-f0-9]{8}\.example\/app$/.test(value))errors.push('Unsafe DSN');
    if(category==='api_token'&&!/^(?:[a-f0-9]{32}|v2\.[a-f0-9]{12}\.[a-f0-9]{20})$/.test(value)&&!/^offline-[a-f0-9]{32}$/.test(Buffer.from(value,'base64url').toString()))errors.push('Unknown token grammar');
    if(category==='password'&&!/^(?:Kıyı|Duru|Bulut|Çağrı|Örgü|Gölge)![a-f0-9]{12}#$/.test(value))errors.push('Unknown password grammar');
    if(category==='verification_code'&&!/^\d{6}$/.test(value))errors.push('Invalid synthetic OTP');
    if(category==='private_key'){
      const body=value.split('\n').slice(1,-1).join(''),bytes=Buffer.from(body,'base64');
      if(!bytes.toString().startsWith('OFFLINE-FIXTURE-NOT-A-KEY:')||bytes[0]===0x30)errors.push('Potential actual cryptographic key');
    }
    if(category==='person_name'&&!/^[\p{L}]+ [\p{L}]+$/u.test(value))errors.push('Unknown generated-name grammar');
  }
  if(record.rendered_text){
    const emails=record.rendered_text.match(/[A-Za-z0-9_.+-]+@[A-Za-z0-9.-]+/g)||[];
    if(emails.some(e=>!e.endsWith('.example')))errors.push('Unexpected email domain in rendered text');
    if(/(?:AKIA|ASIA)[A-Z0-9]{16}|gh[pousr]_[A-Za-z0-9]{30,}|sk-(?:proj-)?[A-Za-z0-9]{20,}/.test(record.rendered_text))errors.push('Real-provider token pattern');
  }
  return errors;
}
