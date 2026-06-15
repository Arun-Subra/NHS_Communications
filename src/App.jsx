import { useEffect, useState } from 'react';
import { C } from './styles/shared.js';

import HomeTab from './tabs/HomeTab.jsx';
import PhotoTab from './tabs/PhotoTab.jsx';
import MessagesTab from './tabs/MessagesTab.jsx';
import LoginScreen from './components/LoginScreen.jsx';

import { supabase } from './supabaseClient.js';


const API_BASE_URL =
  import.meta.env.DEV
    ? 'http://127.0.0.1:8000'
    : '';



export async function apiFetch(path, options = {}) {

  const {data} =
    await supabase.auth.getSession();


  const token =
    data?.session?.access_token;


  const headers = {

    'Content-Type':'application/json',

    ...(token
      ? {
        Authorization:`Bearer ${token}`
      }
      : {}),

    ...options.headers

  };


  const res =
    await fetch(
      `${API_BASE_URL}${path}`,
      {
        ...options,
        headers
      }
    );


  if(!res.ok){
    throw new Error(res.statusText);
  }


  return res.json();

}



// ---------------- ICONS ----------------


function IconHome({filled,color}){

return filled ?

<svg width="26" height="26" viewBox="0 0 24 24" fill={color}>
<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
</svg>

:

<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
<path d="M3 12L12 3l9 9"/>
<path d="M9 21V12h6v9"/>
</svg>

}



function IconCamera({filled,color}){

return (

<svg width="26" height="26" viewBox="0 0 24 24"
fill={filled ? color : "none"}
stroke={color}
strokeWidth="1.8">

<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8c0-1 1-2 2-2h4l2-3h6l2 3h4c1 0 2 1 2 2z"/>

<circle cx="12" cy="13" r="4"/>

</svg>

)

}




function IconMail({filled,color}){

return (

<svg width="26" height="26"
viewBox="0 0 24 24"
fill={filled ? color : "none"}
stroke={color}
strokeWidth="1.8">

<rect x="2" y="4" width="20" height="16" rx="2"/>

<polyline points="2,4 12,13 22,4"/>

</svg>

)

}




const s = {


shell:{
width:'100%',
maxWidth:'430px',
minHeight:'100svh',
margin:'0 auto',
backgroundColor:C.bg,
display:'flex',
flexDirection:'column',
boxShadow:'0 0 40px rgba(0,0,0,.18)',
position:'relative'
},


mainContent:{
flex:1,
overflowY:'auto',
paddingBottom:'80px'
},


navBar:{
position:'sticky',
bottom:0,
backgroundColor:C.white,
display:'flex',
borderTop:`1px solid ${C.border}`,
paddingBottom:'20px',
paddingTop:'8px'
},


navItem:{
flex:1,
border:'none',
background:'none',
display:'flex',
flexDirection:'column',
alignItems:'center',
cursor:'pointer'
},


loading:{
display:'flex',
alignItems:'center',
justifyContent:'center',
height:'100vh',
color:C.primary
},


logoutBtn:{
position:'absolute',
right:'15px',
top:'12px',
zIndex:20,
border:'none',
background:'none',
color:C.primary,
fontWeight:'600'
}


};



const TABS = [

{
id:'home',
label:'Home',
Icon:IconHome
},

{
id:'photo',
label:'Camera',
Icon:IconCamera
},

{
id:'messages',
label:'Communications',
Icon:IconMail
}

];




// ---------------- MAIN APP ----------------


function MainApp(){

const [activeTab,setActiveTab]=useState('photo');

const [loading,setLoading]=useState(true);


const [role,setRole]=useState(null);


const [patient,setPatient]=useState(null);

const [managedPatients,setManagedPatients]=useState([]);

const [selectedPatient,setSelectedPatient]=useState(null);


const [appointments,setAppointments]=useState([]);

const [prescriptions,setPrescriptions]=useState([]);




useEffect(()=>{


apiFetch('/api/me')

.then(data=>{


setRole(data.role);



if(data.role==="patient"){


setPatient(
 data.patient_info
);


setAppointments(
 data.appointments ?? []
);


setPrescriptions(
 data.prescriptions ?? []
);


}



if(data.role==="carer"){


setManagedPatients(
 data.managed_patients ?? []
);


if(data.managed_patients?.length){

setSelectedPatient(
 data.managed_patients[0]
);

}


}


})

.catch(console.error)

.finally(()=>setLoading(false));


},[]);





const logout =
()=>supabase.auth.signOut();




const currentPatient =
role==="carer"
?
selectedPatient
:
patient;



const tabContent = {


home:

<HomeTab

patient={currentPatient}

appointments={appointments}

prescriptions={prescriptions}

/>,



photo:

<PhotoTab

patient={currentPatient}

apiFetch={apiFetch}

onNavigate={setActiveTab}

/>,



messages:

<MessagesTab

apiFetch={apiFetch}

patient={currentPatient}

/>


};




if(loading)

return (

<p style={s.loading}>
Connecting securely…
</p>

);





return (

<div style={s.shell}>


<button
style={s.logoutBtn}
onClick={logout}
>
Log out
</button>



{
role==="carer" &&

<div
style={{
padding:'12px',
background:C.white
}}
>


<select

style={{
width:'100%',
padding:'10px',
borderRadius:'8px'
}}

value={
selectedPatient?.nhs_number || ''
}

onChange={e=>{

const p =
managedPatients.find(
x=>x.nhs_number===e.target.value
);

setSelectedPatient(p);

}}

>


{
managedPatients.map(p=>

<option
key={p.nhs_number}
value={p.nhs_number}
>

{p.name}

</option>

)

}


</select>


</div>

}



<main style={s.mainContent}>

{tabContent[activeTab]}

</main>




<nav style={s.navBar}>


{
TABS.map(
({id,label,Icon})=>{


const active =
activeTab===id;


return (

<button

key={id}

style={s.navItem}

onClick={()=>setActiveTab(id)}

>


<Icon

filled={active}

color={
active
?
C.primary
:
C.textLight
}

/>


<span
style={{
fontSize:'11px',
color:
active
?
C.primary
:
C.textLight
}}
>

{label}

</span>


</button>


)

})

}


</nav>


</div>

);


}





// ---------------- AUTH ROUTER ----------------


export default function App(){


const [session,setSession]=useState(null);

const [checking,setChecking]=useState(true);



useEffect(()=>{


supabase.auth.getSession()

.then(({data})=>{

setSession(data.session);

setChecking(false);

});



const {

data:{subscription}

}

=
supabase.auth.onAuthStateChange(
(_,session)=>setSession(session)
);



return ()=>subscription.unsubscribe();


},[]);





if(checking)

return (

<p style={s.loading}>
Securing connection…
</p>

);



if(!session)

return <LoginScreen/>;



return <MainApp/>;


}