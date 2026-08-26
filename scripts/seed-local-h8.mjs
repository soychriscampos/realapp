#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const P='H8-SEED', PW='Real1234!', TZ='America/Mazatlan'

const fail=m=>{
  console.error(`\n[H8] ${m}`)
  process.exit(1)
}

const ok=(c,m)=>{
  if(!c) fail(m)
}

const env={}

for(const line of execFileSync(
  'npx',
  ['supabase','status','-o','env'],
  {encoding:'utf8'}
).split(/\r?\n/)){
  const x=line.match(/^([A-Z0-9_]+)=(.*)$/)
  if(!x) continue

  let v=x[2].trim()

  if(
    (v.startsWith('"')&&v.endsWith('"')) ||
    (v.startsWith("'")&&v.endsWith("'"))
  ){
    v=v.slice(1,-1)
  }

  env[x[1]]=v
}

ok(
  env.API_URL && env.ANON_KEY && env.SERVICE_ROLE_KEY,
  'Faltan credenciales locales'
)

const u=new URL(env.API_URL)

ok(
  ['127.0.0.1','localhost'].includes(u.hostname),
  `ABORTADO: ${env.API_URL} no es local`
)

const admin=createClient(
  env.API_URL,
  env.SERVICE_ROLE_KEY,
  {
    auth:{
      persistSession:false,
      autoRefreshToken:false
    }
  }
)

const master=createClient(
  env.API_URL,
  env.ANON_KEY,
  {
    auth:{
      persistSession:false,
      autoRefreshToken:false
    }
  }
)

const one=async(q,l)=>{
  const {data,error}=await q
  if(error) fail(`${l}: ${error.message}`)
  return data
}

const rpc=async(c,n,a,l=n)=>{
  const {data,error}=await c.rpc(n,a)
  if(error) fail(`${l}: ${error.message}`)
  return data
}

const localDate=()=>{
  const p=Object.fromEntries(
    new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone:TZ,
        year:'numeric',
        month:'2-digit',
        day:'2-digit'
      }
    )
      .formatToParts(new Date())
      .map(x=>[x.type,x.value])
  )

  return `${p.year}-${p.month}-${p.day}`
}

const shift=(s,d)=>{
  const [y,m,dd]=s.split('-').map(Number)
  const x=new Date(Date.UTC(y,m-1,dd))
  x.setUTCDate(x.getUTCDate()+d)
  return x.toISOString().slice(0,10)
}

const at=(d,h=11)=>
  `${d}T${String(h).padStart(2,'0')}:10:00-07:00`

const money=n=>
  Math.round((Number(n)+Number.EPSILON)*100)/100

const prop=(n,a,d)=>
  money(Number(n)*a/d)

async function users(){
  let a=[]
  let p=1

  for(;;p++){
    const {data,error}=await admin.auth.admin.listUsers({
      page:p,
      perPage:100
    })

    if(error) fail(error.message)

    a.push(...data.users)

    if(data.users.length<100) break
  }

  return a
}

async function actor(name,email,roleCode){
  let user=(await users()).find(
    x=>x.email?.toLowerCase()===email.toLowerCase()
  )

  if(!user){
    const {data,error}=await admin.auth.admin.createUser({
      email,
      password:PW,
      email_confirm:true,
      user_metadata:{
        display_name:name,
        local_seed:'H8'
      }
    })

    if(error) fail(error.message)
    user=data.user
  } else {
    const {data,error}=await admin.auth.admin.updateUserById(
      user.id,
      {
        password:PW,
        email_confirm:true,
        user_metadata:{
          ...(user.user_metadata||{}),
          display_name:name,
          local_seed:'H8'
        }
      }
    )

    if(error) fail(error.message)
    user=data.user
  }

  const r=(
    await one(
      admin
        .from('roles')
        .select('id')
        .eq('code',roleCode)
        .limit(1),
      `rol ${roleCode}`
    )
  )[0]

  ok(r,`Falta rol ${roleCode}`)

  const pr=await one(
    admin
      .from('profiles')
      .select('id')
      .eq('id',user.id)
      .limit(1),
    'profile'
  )

  if(pr.length){
    await one(
      admin
        .from('profiles')
        .update({
          display_name:name,
          is_active:true
        })
        .eq('id',user.id),
      'profile update'
    )
  } else {
    await one(
      admin
        .from('profiles')
        .insert({
          id:user.id,
          display_name:name,
          is_active:true
        }),
      'profile insert'
    )
  }

  const ur=await one(
    admin
      .from('user_roles')
      .select('id')
      .eq('user_id',user.id)
      .eq('role_id',r.id)
      .is('valid_until',null)
      .limit(1),
    'user role'
  )

  if(!ur.length){
    await one(
      admin
        .from('user_roles')
        .insert({
          user_id:user.id,
          role_id:r.id,
          valid_from:new Date().toISOString(),
          valid_until:null,
          assigned_by:user.id
        }),
      'user role insert'
    )
  }

  let st=await one(
    admin
      .from('staff')
      .select('id')
      .eq('profile_id',user.id)
      .limit(1),
    'staff'
  )

  let sid

  if(st.length){
    sid=st[0].id

    await one(
      admin
        .from('staff')
        .update({
          full_name:name,
          status:'ACTIVE'
        })
        .eq('id',sid),
      'staff update'
    )
  } else {
    sid=(
      await one(
        admin
          .from('staff')
          .insert({
            full_name:name,
            status:'ACTIVE',
            profile_id:user.id
          })
          .select('id')
          .single(),
        'staff insert'
      )
    ).id
  }

  return {
    name,
    email,
    profileId:user.id,
    staffId:sid,
    roleCode
  }
}

const A={
  christian:await actor(
    'Christian',
    'admin@real.local',
    'MASTER'
  ),
  fran:await actor(
    'Fran',
    'fran@real.local',
    'ADMINISTRATIVO'
  ),
  citlali:await actor(
    'Citlali',
    'citlali@real.local',
    'ADMINISTRATIVO'
  )
}

{
  const {error}=await master.auth.signInWithPassword({
    email:A.christian.email,
    password:PW
  })

  if(error) fail(`login MASTER: ${error.message}`)
}

const cycles=await one(
  master
    .from('school_cycles')
    .select('*')
    .in('code',['25-26','26-27']),
  'ciclos'
)

const C=Object.fromEntries(
  cycles.map(x=>[x.code,x])
)

ok(
  C['25-26']&&C['26-27'],
  'Faltan ciclos'
)

const cls=await one(
  master
    .from('enrollment_classifications')
    .select('*')
    .eq('is_active',true),
  'clasificaciones'
)

const CL=Object.fromEntries(
  cls.map(x=>[x.code,x])
)

;['OFFICIAL_SEP','CAMPUS','VISITOR']
  .forEach(x=>ok(CL[x],`Falta ${x}`))

const pms=await one(
  master
    .from('payment_methods')
    .select('*')
    .eq('is_active',true),
  'métodos'
)

const PM=Object.fromEntries(
  pms.map(x=>[x.code,x])
)

;['CASH','TRANSFER','IN_KIND']
  .forEach(x=>ok(PM[x],`Falta ${x}`))

const levels=await one(
  master
    .from('education_levels')
    .select('id,name')
    .in('name',['Preescolar','Primaria']),
  'niveles'
)

const L=Object.fromEntries(
  levels.map(x=>[x.name,x])
)

const grades=await one(
  master
    .from('grade_levels')
    .select('*')
    .eq('is_active',true),
  'grados'
)

const G={}

for(const g of grades){
  const l=levels.find(
    x=>x.id===g.education_level_id
  )

  if(l){
    G[`${l.name}:${g.code}`]=g
  }
}

const groups=await one(
  master
    .from('groups')
    .select('*')
    .eq('cycle_id',C['26-27'].id)
    .eq('is_active',true),
  'grupos'
)

const GA=Object.fromEntries(
  groups
    .filter(x=>x.code==='A')
    .map(x=>[x.grade_level_id,x])
)

const fcs=await one(
  master
    .from('financial_concepts')
    .select('id,code')
    .in('code',['TUITION','ENROLLMENT_FEE']),
  'conceptos'
)

const FC=Object.fromEntries(
  fcs.map(x=>[x.code,x])
)

const rates=await one(
  master
    .from('base_rates')
    .select('*')
    .eq('cycle_id',C['26-27'].id),
  'tarifas'
)

const tuition=level=>{
  const r=rates.find(
    x=>
      x.education_level_id===L[level].id &&
      x.financial_concept_id===FC.TUITION.id
  )

  ok(r,`Falta tarifa ${level}`)

  return Number(r.amount)
}

const plans=await one(
  master
    .from('financial_plans')
    .select('*')
    .eq('cycle_id',C['26-27'].id)
    .eq('installment_count',12)
    .eq('is_default',true)
    .neq('status','INACTIVE'),
  'planes'
)

const periods=await one(
  master
    .from('financial_plan_periods')
    .select('*')
    .in(
      'financial_plan_id',
      plans.map(x=>x.id)
    )
    .eq('financial_concept_id',FC.TUITION.id)
    .eq('coverage_year',2026)
    .eq('coverage_month',9),
  'periodos'
)

const sepDue=level=>{
  const p=plans.find(
    x=>x.education_level_id===L[level].id
  )

  const q=periods.find(
    x=>x.financial_plan_id===p?.id
  )

  ok(q,`Falta SEP ${level}`)

  return q.due_date
}

const discDefs=[
  ['SIB','H8 Hermanos','FIXED_AMOUNT',400],
  ['B25','H8 Beca 25%','PERCENTAGE',25],
  ['SUP','H8 Apoyo $250','FIXED_AMOUNT',250]
]

const D={}

for(const [k,name,type,value] of discDefs){
  let e=await one(
    master
      .from('tuition_discount_categories')
      .select('id')
      .eq('cycle_id',C['26-27'].id)
      .eq('name',name)
      .limit(1),
    name
  )

  let id=e[0]?.id

  if(!id){
    id=await rpc(
      master,
      'create_tuition_discount_category',
      {
        p_cycle_id:C['26-27'].id,
        p_name:name,
        p_discount_type:type,
        p_value:value,
        p_effective_on:'2026-08-31',
        p_reason:`${P}: categoría H8`
      },
      name
    )
  }

  D[k]={
    id,
    type,
    value,
    name
  }
}

const individual=(base,k)=>
  !k
    ? money(base)
    : D[k].type==='FIXED_AMOUNT'
      ? money(
          Math.max(
            0,
            base-D[k].value
          )
        )
      : money(
          base-base*D[k].value/100
        )

const S=[
  [1,'Valeria Navarro López','M','2021-03-12',['Preescolar','1'],['Preescolar','2'],'SIB'],
  [2,'Emiliano Navarro López','H','2020-05-21',['Preescolar','2'],['Preescolar','3'],'SIB'],
  [3,'Renata García Soto','M','2019-01-18',['Preescolar','3'],['Primaria','1']],
  [4,'Santiago García Soto','H','2018-11-03',['Primaria','1'],['Primaria','2']],
  [5,'Camila Ortega Ruiz','M','2018-07-09',['Primaria','1'],['Primaria','2']],
  [6,'Diego Ortega Ruiz','H','2017-09-15',['Primaria','2'],['Primaria','3']],
  [7,'Sofía Mendoza León','M','2017-04-26',['Primaria','2'],['Primaria','3']],
  [8,'Mateo Mendoza León','H','2016-10-02',['Primaria','3'],['Primaria','4']],
  [9,'Regina Flores Vega','M','2021-08-14',['Preescolar','1'],['Preescolar','2'],'B25'],
  [10,'Leonardo Flores Vega','H','2020-02-27',['Preescolar','2'],['Preescolar','3'],'B25'],
  [11,'Ana Paula Cárdenas Ríos','M','2016-06-17',['Primaria','3'],['Primaria','4']],
  [12,'Nicolás Cárdenas Ríos','H','2015-12-08',['Primaria','4'],['Primaria','5']],
  [13,'Julia Valdez Mora','M','2018-02-11',['Primaria','1'],['Primaria','2']],
  [14,'Bruno Valdez Mora','H','2015-05-29',['Primaria','4'],['Primaria','5']],
  [15,'Elisa Torres Núñez','M','2020-09-06',['Preescolar','2'],['Preescolar','3']],
  [16,'Gael Torres Núñez','H','2019-03-23',['Preescolar','3'],['Primaria','1']],
  [17,'Martina Salazar Peña','M','2017-01-30',['Primaria','2'],['Primaria','3']],
  [18,'Thiago Salazar Peña','H','2016-07-19',['Primaria','3'],['Primaria','4']],
  [19,'Luciana Acosta Gil','M','2018-05-16',['Primaria','1'],['Primaria','2']],
  [20,'Sebastián Acosta Gil','H','2015-08-04',['Primaria','4'],['Primaria','5']],
  [21,'Olivia Herrera Paz','M','2015-02-13',['Primaria','4'],['Primaria','5'],'SUP'],
  [22,'Máximo Herrera Paz','H','2014-10-25',['Primaria','5'],['Primaria','6']],
  [23,'Elena Robles Castro','M','2021-06-01',['Preescolar','1'],['Preescolar','2']],
  [24,'Iker Robles Castro','H','2020-12-19',['Preescolar','2'],['Preescolar','3']],
  [25,'Victoria Luna Meza','M','2017-11-07',['Primaria','2'],['Primaria','3']],
  [26,'Andrés Luna Meza','H','2016-03-28',['Primaria','3'],['Primaria','4']],
  [27,'Paula Serrano Díaz','M','2015-09-22',['Primaria','4'],['Primaria','5'],'B25'],
  [28,'Rodrigo Serrano Díaz','H','2014-04-05',['Primaria','5'],['Primaria','6']],
  [29,'Natalia Paredes Solís','M','2013-12-16',['Primaria','6'],null,null,'NO'],
  [30,'Joaquín Paredes Solís','H','2013-06-10',['Primaria','6'],null,null,'NO'],

  [31,'Alma Quiñones Vega','M','2022-02-18',null,['Preescolar','1'],'SIB','AUG31'],
  [32,'Hugo Quiñones Vega','H','2022-08-09',null,['Preescolar','1'],'SIB','AUG31'],
  [33,'Zoe Beltrán Cruz','M','2020-01-14',null,['Preescolar','3'],null,'AUG31'],
  [34,'Ian Beltrán Cruz','H','2019-07-27',null,['Primaria','1'],null,'AUG31'],
  [35,'María José Ríos Lara','M','2018-10-03',null,['Primaria','2'],'B25','AUG31'],

  [36,'Luis Ríos Lara','H','2018-03-20',null,['Primaria','2'],null,'SEP15'],
  [37,'Emma Carrillo Paz','M','2017-06-12',null,['Primaria','3'],null,'SEP15'],
  [38,'Noah Carrillo Paz','H','2016-09-01',null,['Primaria','4'],null,'SEP15'],
  [39,'Isabella Mejía Soto','M','2015-01-24',null,['Primaria','5'],'SUP','SEP15'],
  [40,'Samuel Mejía Soto','H','2014-07-13',null,['Primaria','6'],null,'SEP15']
].map(
  ([n,name,sex,birth,prior,current,discount,flag])=>({
    n,
    name,
    sex,
    birth,
    prior,
    current,
    discount,
    flag,
    code:`DEV-H8-${String(n).padStart(3,'0')}`
  })
)

const classCode=n=>
  n%9===0
    ? 'VISITOR'
    : n%5===0
      ? 'CAMPUS'
      : 'OFFICIAL_SEP'

const SID={}
const E25={}
const E26={}

for(const s of S.filter(x=>x.prior)){
  let q=await one(
    admin
      .from('students')
      .select('id')
      .eq('student_code',s.code)
      .limit(1),
    s.code
  )

  let id=q[0]?.id

  if(!id){
    id=(
      await one(
        admin
          .from('students')
          .insert({
            student_code:s.code,
            full_name:s.name,
            sex:s.sex,
            birth_date:s.birth
          })
          .select('id')
          .single(),
        `crear ${s.code}`
      )
    ).id
  }

  SID[s.code]=id

  const gr=G[
    `${s.prior[0]}:${s.prior[1]}`
  ]

  const cl=CL[
    classCode(s.n)
  ]

  ok(
    gr,
    `grado previo ${s.code}`
  )

  q=await one(
    admin
      .from('enrollments')
      .select('id')
      .eq('student_id',id)
      .eq('cycle_id',C['25-26'].id)
      .limit(1),
    'e25'
  )

  if(q.length){
    E25[s.code]=q[0].id
  } else {
    E25[s.code]=(
      await one(
        admin
          .from('enrollments')
          .insert({
            student_id:id,
            cycle_id:C['25-26'].id,
            grade_level_id:gr.id,
            group_id:null,
            classification_id:cl.id,
            status:s.flag==='NO'
              ? 'NO_CONTINUA'
              : 'FINALIZADA',
            enrolled_on:'2025-09-01',
            classes_start_on:'2025-09-01',
            closed_on:'2026-07-10',
            created_by:A.christian.profileId,
            legacy_id:`${P}:${s.code}:25-26`
          })
          .select('id')
          .single(),
        'crear e25'
      )
    ).id
  }
}

const debts=[
  [
    'DEV-H8-003',
    ['2026-07'],
    2400,
    []
  ],
  [
    'DEV-H8-006',
    ['2026-06','2026-07'],
    2500,
    [
      3000,
      [2500,500],
      'TRANSFER',
      'fran'
    ]
  ],
  [
    'DEV-H8-008',
    ['2026-07'],
    2500,
    [
      2200,
      [2200],
      'CASH',
      'citlali'
    ]
  ],
  [
    'DEV-H8-011',
    ['2026-05','2026-06','2026-07'],
    2500,
    [
      1000,
      [1000,0,0],
      'CASH',
      'christian'
    ]
  ],
  [
    'DEV-H8-014',
    ['2026-06','2026-07'],
    2500,
    [
      1000,
      [1000,0],
      'TRANSFER',
      'fran'
    ]
  ],
  [
    'DEV-H8-017',
    ['2026-04','2026-05','2026-06'],
    2500,
    [
      2500,
      [2500,0,0],
      'CASH',
      'citlali'
    ]
  ],
  [
    'DEV-H8-021',
    ['2026-04','2026-05','2026-06','2026-07'],
    2500,
    []
  ],
  [
    'DEV-H8-027',
    ['2026-05','2026-06','2026-07'],
    2500,
    [
      500,
      [500,0,0],
      'CASH',
      'christian'
    ]
  ]
]

const HC={}

for(const [code,months,amount] of debts){
  HC[code]=[]

  for(const ym of months){
    const ref=
      `${P}:25-26:${code}:TUITION:${ym}`

    let q=await one(
      admin
        .from('charges')
        .select('id')
        .eq('legacy_reference',ref)
        .limit(1),
      'hist charge'
    )

    let id=q[0]?.id

    if(!id){
      const [y,m]=ym
        .split('-')
        .map(Number)

      id=(
        await one(
          admin
            .from('charges')
            .insert({
              student_id:SID[code],
              enrollment_id:E25[code],
              cycle_id:C['25-26'].id,
              financial_concept_id:FC.TUITION.id,
              coverage_year:y,
              coverage_month:m,
              original_amount:amount,
              due_date:`${ym}-05`,
              origin:'LEGACY_IMPORT',
              status:'ACTIVE',
              created_by:A.christian.profileId,
              legacy_reference:ref
            })
            .select('id')
            .single(),
          'hist charge insert'
        )
      ).id
    }

    HC[code].push(id)
  }
}

async function findPay(marker){
  const q=await one(
    admin
      .from('payments')
      .select('id,status')
      .ilike('notes',`${marker}%`)
      .limit(1),
    'find pay'
  )

  return q[0]||null
}

async function pay({
  key,
  code,
  amount,
  method,
  receiver,
  date,
  alloc,
  bank=null,
  desc=null,
  reason=null
}){
  const marker=`${P}:${key}`

  const e=await findPay(marker)

  if(e){
    return e.id
  }

  const pm=PM[method]
  const r=A[receiver]

  return await rpc(
    master,
    'register_payment',
    {
      p_student_id:SID[code],
      p_received_at:at(
        date,
        11+(Number(code.slice(-1))%5)
      ),
      p_amount:amount,
      p_payment_method_id:pm.id,
      p_received_by_staff_id:r.staffId,
      p_bank_reference:bank,
      p_notes:
        (pm.requires_description||desc)
          ? `${marker} | ${desc||'Pago local H8'}`
          : marker,
      p_receipt_visible_note:
        'Datos locales de desarrollo H8',
      p_allocations:alloc
        .filter(x=>x.amount>0)
        .map(x=>({
          charge_id:x.id,
          amount:x.amount
        })),
      p_allocation_override_reason:reason
    },
    marker
  )
}

for(const [code,,,p] of debts){
  if(!p.length) continue

  const [
    amount,
    aa,
    method,
    receiver
  ]=p

  await pay({
    key:`HISTPAY:${code}`,
    code,
    amount,
    method,
    receiver,
    date:'2026-07-01',
    alloc:aa.map(
      (x,i)=>({
        id:HC[code][i],
        amount:x
      })
    )
  })
}

for(
  const s of S.filter(
    x=>x.prior&&x.flag!=='NO'
  )
){
  const gr=G[
    `${s.current[0]}:${s.current[1]}`
  ]

  const ga=GA[gr.id]

  ok(
    ga,
    `grupo ${s.code}`
  )

  let q=await one(
    admin
      .from('enrollments')
      .select('id')
      .eq('student_id',SID[s.code])
      .eq('cycle_id',C['26-27'].id)
      .limit(1),
    'e26'
  )

  let eid=q[0]?.id

  if(!eid){
    eid=await rpc(
      master,
      'create_and_activate_enrollment',
      {
        p_student_id:SID[s.code],
        p_cycle_id:C['26-27'].id,
        p_grade_level_id:gr.id,
        p_classification_id:CL[classCode(s.n)].id,
        p_group_id:ga.id,
        p_activated_on:'2026-08-31',
        p_classes_start_on:'2026-08-31',
        p_economic_start_on:'2026-09-01',
        p_initial_period_amount:null,
        p_initial_period_due_date:null,
        p_enrollment_fee_mode:'FULL',
        p_enrollment_fee_amount:null,
        p_reason:`${P}: continuidad`
      },
      s.code
    )
  }

  E26[s.code]=eid

  if(s.discount){
    q=await one(
      master
        .from('enrollment_tuition_discount_assignments')
        .select('id')
        .eq('enrollment_id',eid)
        .is('valid_until',null)
        .limit(1),
      'disc'
    )

    if(!q.length){
      await rpc(
        master,
        'set_enrollment_tuition_discount',
        {
          p_enrollment_id:eid,
          p_category_id:D[s.discount].id,
          p_effective_on:'2026-09-01',
          p_effect_mode:'CURRENT',
          p_current_period_amount:null,
          p_reason:`${P}: descuento`
        },
        `disc ${s.code}`
      )
    }
  }
}

const fam={
  31:[
    'Mariana Vega Ruiz',
    '6691003101',
    'familia.quinones.31.h8@example.test',
    'MADRE'
  ],
  32:[
    'Mariana Vega Ruiz',
    '6691003101',
    'familia.quinones.32.h8@example.test',
    'MADRE'
  ],
  33:[
    'Daniela Cruz Soto',
    '6691003301',
    'familia.beltran.33.h8@example.test',
    'MADRE'
  ],
  34:[
    'Daniela Cruz Soto',
    '6691003301',
    'familia.beltran.34.h8@example.test',
    'MADRE'
  ],
  35:[
    'Patricia Lara Meza',
    '6691003501',
    'familia.rios.35.h8@example.test',
    'MADRE'
  ],
  36:[
    'Patricia Lara Meza',
    '6691003501',
    'familia.rios.36.h8@example.test',
    'MADRE'
  ],
  37:[
    'Óscar Carrillo Vega',
    '6691003701',
    'familia.carrillo.37.h8@example.test',
    'PADRE'
  ],
  38:[
    'Óscar Carrillo Vega',
    '6691003701',
    'familia.carrillo.38.h8@example.test',
    'PADRE'
  ],
  39:[
    'Adriana Soto Gil',
    '6691003901',
    'familia.mejia.39.h8@example.test',
    'MADRE'
  ],
  40:[
    'Adriana Soto Gil',
    '6691003901',
    'familia.mejia.40.h8@example.test',
    'MADRE'
  ]
}

for(const s of S.filter(x=>!x.prior)){
  let q=await one(
    admin
      .from('students')
      .select('id,student_code')
      .eq('student_code',s.code)
      .limit(1),
    'new code'
  )

  if(!q.length){
    q=await one(
      admin
        .from('students')
        .select('id,student_code')
        .eq('full_name',s.name)
        .limit(2),
      'new name'
    )
  }

  let sid=q[0]?.id
  let eid=null

  if(sid){
    const es=await one(
      admin
        .from('enrollments')
        .select('id')
        .eq('student_id',sid)
        .eq('cycle_id',C['26-27'].id)
        .limit(1),
      'new enrollment'
    )

    eid=es[0]?.id

    if(!eid){
      fail(
        `${s.code} existe sin matrícula 26-27; revisa ese caso parcial`
      )
    }
  }

  const gr=G[
    `${s.current[0]}:${s.current[1]}`
  ]

  const ga=GA[gr.id]
  const base=tuition(s.current[0])
  const ind=individual(
    base,
    s.discount
  )

  let act
  let eco
  let amt
  let due

  if(s.flag==='AUG31'){
    act=eco='2026-08-31'
    amt=prop(ind,1,31)
    due='2026-08-31'
  } else {
    act=eco='2026-09-15'
    amt=prop(ind,16,30)
    due=sepDue(s.current[0])
  }

  if(!eid){
    const [
      gn,
      gp,
      ge,
      rel
    ]=fam[s.n]

    const res=await rpc(
      master,
      'create_new_student_enrollment',
      {
        p_student_full_name:s.name,
        p_student_sex:s.sex,
        p_student_birth_date:s.birth,
        p_contacts:[
          {
            full_name:gn,
            phone:gp,
            email:ge,
            relationship:rel
          }
        ],
        p_cycle_id:C['26-27'].id,
        p_grade_level_id:gr.id,
        p_classification_id:CL[classCode(s.n)].id,
        p_group_id:ga.id,
        p_activated_on:act,
        p_classes_start_on:act,
        p_economic_start_on:eco,
        p_initial_period_amount:amt,
        p_initial_period_due_date:due,
        p_enrollment_fee_mode:'FULL',
        p_enrollment_fee_amount:null,
        p_discount_category_id:
          s.discount
            ? D[s.discount].id
            : null,
        p_reason:`${P}: nuevo ${s.flag}`
      },
      s.code
    )

    sid=res.student_id
    eid=res.enrollment_id

    await one(
      admin
        .from('students')
        .update({
          student_code:s.code
        })
        .eq('id',sid),
      'set code'
    )
  } else if(!q[0].student_code){
    await one(
      admin
        .from('students')
        .update({
          student_code:s.code
        })
        .eq('id',sid),
      'recover code'
    )
  }

  SID[s.code]=sid
  E26[s.code]=eid
}

async function charge(
  code,
  concept,
  year=null,
  month=null
){
  let q=admin
    .from('charges')
    .select('id,original_amount')
    .eq('student_id',SID[code])
    .eq('cycle_id',C['26-27'].id)
    .eq('financial_concept_id',FC[concept].id)
    .eq('status','ACTIVE')

  if(year!==null){
    q=q.eq(
      'coverage_year',
      year
    )
  }

  if(month!==null){
    q=q.eq(
      'coverage_month',
      month
    )
  }

  const r=await one(
    q
      .order(
        'created_at',
        {ascending:false}
      )
      .limit(1),
    'charge'
  )

  ok(
    r.length,
    `Falta cargo ${code} ${concept}`
  )

  return r[0]
}

const today=localDate()
const yest=shift(today,-1)
const d2=shift(today,-2)
const d3=shift(today,-3)
const d4=shift(today,-4)

const cur=[
  ['001',2800,'CASH','christian',today],
  ['002',1000,'TRANSFER','fran',today],
  ['004',2800,'CASH','citlali',yest],
  ['005',1400,'CASH','fran',d2],
  ['009',2800,'TRANSFER','christian',today],
  ['012',2800,'IN_KIND','citlali',d3],
  ['016',500,'CASH','fran',yest],
  ['023',2800,'TRANSFER','citlali',d4],
  ['031',2800,'CASH','christian',today],
  ['032',1200,'TRANSFER','fran',today],
  ['034',2800,'CASH','citlali',d2],
  ['036',2800,'TRANSFER','christian',yest]
]

for(
  const [
    suf,
    amount,
    method,
    receiver,
    date
  ] of cur
){
  const code=`DEV-H8-${suf}`
  const marker=
    `${P}:CURPAY:${suf}`

  if(await findPay(marker)){
    continue
  }

  const f=await charge(
    code,
    'ENROLLMENT_FEE'
  )

  await pay({
    key:`CURPAY:${suf}`,
    code,
    amount,
    method,
    receiver,
    date,
    alloc:[
      {
        id:f.id,
        amount
      }
    ],
    bank:
      method==='TRANSFER'
        ? `H8-TR-${suf}`
        : null,
    desc:
      method==='IN_KIND'
        ? 'Especie: material escolar de prueba H8'
        : null
  })
}

if(
  !(
    await findPay(
      `${P}:CURPAY:033:MULTI`
    )
  )
){
  const f=await charge(
    'DEV-H8-033',
    'ENROLLMENT_FEE'
  )

  const s=await charge(
    'DEV-H8-033',
    'TUITION',
    2026,
    9
  )

  await pay({
    key:'CURPAY:033:MULTI',
    code:'DEV-H8-033',
    amount:3500,
    method:'TRANSFER',
    receiver:'christian',
    date:yest,
    alloc:[
      {
        id:f.id,
        amount:2800
      },
      {
        id:s.id,
        amount:700
      }
    ],
    bank:'H8-MULTI-033',
    reason:
      'H8 seed: pago anticipado explícito a colegiatura SEP'
  })
}

if(
  !(
    await findPay(
      `${P}:CURPAY:035:CREDIT`
    )
  )
){
  const f=await charge(
    'DEV-H8-035',
    'ENROLLMENT_FEE'
  )

  await pay({
    key:'CURPAY:035:CREDIT',
    code:'DEV-H8-035',
    amount:3300,
    method:'CASH',
    receiver:'fran',
    date:today,
    alloc:[
      {
        id:f.id,
        amount:2800
      }
    ],
    reason:
      'H8 seed: excedente para saldo a favor'
  })
}

{
  let p=await findPay(
    `${P}:CURPAY:037:REVERSE`
  )

  if(!p){
    const f=await charge(
      'DEV-H8-037',
      'ENROLLMENT_FEE'
    )

    const id=await pay({
      key:'CURPAY:037:REVERSE',
      code:'DEV-H8-037',
      amount:900,
      method:'CASH',
      receiver:'citlali',
      date:yest,
      alloc:[
        {
          id:f.id,
          amount:900
        }
      ]
    })

    p={
      id,
      status:'CONFIRMED'
    }
  }

  if(p.status==='CONFIRMED'){
    await rpc(
      master,
      'reverse_payment',
      {
        p_payment_id:p.id,
        p_reason:`${P}: reversión H8`
      },
      'reverse'
    )
  }
}

async function outstanding(id){
  const c=(
    await one(
      admin
        .from('charges')
        .select('original_amount')
        .eq('id',id)
        .limit(1),
      'out c'
    )
  )[0]

  const a=await one(
    master
      .from('charge_adjustments')
      .select('amount')
      .eq('charge_id',id),
    'out a'
  )

  const pa=await one(
    master
      .from('payment_allocations')
      .select(
        'amount,payments!inner(status)'
      )
      .eq('charge_id',id)
      .is('reversed_at',null)
      .eq('payments.status','CONFIRMED'),
    'out p'
  )

  const ca=await one(
    master
      .from('credit_applications')
      .select(
        'amount,credits!inner(status)'
      )
      .eq('charge_id',id)
      .is('reversed_at',null)
      .eq('credits.status','ACTIVE'),
    'out cr'
  )

  return money(
    Number(c.original_amount)
    +a.reduce(
      (s,x)=>s+Number(x.amount),
      0
    )
    -pa.reduce(
      (s,x)=>s+Number(x.amount),
      0
    )
    -ca.reduce(
      (s,x)=>s+Number(x.amount),
      0
    )
  )
}

const debtSummary=[]

for(const [code] of debts){
  let total=0

  for(const id of HC[code]){
    total+=await outstanding(id)
  }

  debtSummary.push([
    code,
    S.find(
      x=>x.code===code
    ).name,
    money(total)
  ])
}

const pays=await one(
  admin
    .from('payments')
    .select(
      'status,received_by_name_snapshot,notes'
    )
    .ilike(
      'notes',
      `${P}:%`
    ),
  'sum pay'
)

const ps={}

for(const p of pays){
  const k=
    p.received_by_name_snapshot

  ps[k]??={
    total:0,
    confirmed:0,
    reversed:0
  }

  ps[k].total++

  p.status==='CONFIRMED'
    ? ps[k].confirmed++
    : ps[k].reversed++
}

const credit=await one(
  master
    .from('credits')
    .select('original_amount')
    .eq(
      'student_id',
      SID['DEV-H8-035']
    )
    .eq(
      'status',
      'ACTIVE'
    )
    .limit(1),
  'credit'
)

console.log(
  '\n=== H8 LOCAL SEED ==='
)

console.log(
  'Staff:'
)

for(const x of Object.values(A)){
  console.log(
    `- ${x.name}: ${x.email} / ${PW} / ${x.roleCode}`
  )
}

console.log(
  '\nAlumnos: 40 | 25-26: 30 | continuidad ACTIVA 26-27: 28 | NO_CONTINUA: 2 | nuevo ingreso: 10 (5x 31-AGO, 5x 15-SEP)'
)

console.log(
  '\nAdeudo histórico 25-26:'
)

for(const [c,n,b] of debtSummary){
  console.log(
    `- ${c} — ${n}: $${b.toFixed(2)}`
  )
}

console.log(
  '\nPagos H8 por receptor:'
)

for(const [n,v] of Object.entries(ps)){
  console.log(
    `- ${n}: ${v.total} (${v.confirmed} confirmados, ${v.reversed} revertidos)`
  )
}

console.log(
  '\nCasos:'
)

console.log(
  '- DEV-H8-001 inscripción pagada / Christian'
)

console.log(
  '- DEV-H8-002 inscripción parcial / Fran'
)

console.log(
  '- DEV-H8-003,006,008,011,014,017,021,027 deuda histórica'
)

console.log(
  '- DEV-H8-029,030 NO_CONTINUA'
)

console.log(
  '- DEV-H8-031..035 nuevos 31-AGO; DEV-H8-036..040 nuevos 15-SEP'
)

console.log(
  '- DEV-H8-033 pago multi-cargo'
)

console.log(
  '- DEV-H8-035 saldo a favor '+
  (
    credit[0]
      ? `$${Number(credit[0].original_amount).toFixed(2)}`
      : 'NO ENCONTRADO'
  )
)

console.log(
  '- DEV-H8-037 reversión'
)

console.log(
  '- Descuentos: H8 Hermanos / H8 Beca 25% / H8 Apoyo $250'
)

console.log(
  '\nReejecutar: node scripts/seed-local-h8.mjs'
)

console.log(
  'No se ejecutó db reset. El script aborta si API_URL no es local.'
)
