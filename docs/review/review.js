const language=document.getElementById('review-language');
function translate(value){
 const pt=value==='pt-PT';document.documentElement.lang=pt?'pt-PT':'en';language.value=pt?'pt-PT':'en';
 for(const node of document.querySelectorAll('[data-en][data-pt]'))node.textContent=pt?node.dataset.pt:node.dataset.en;
 try{localStorage.setItem('bs.review-language',language.value)}catch{}
}
try{translate(localStorage.getItem('bs.review-language')||'en')}catch{translate('en')}
language.addEventListener('change',()=>translate(language.value));
for(const filter of document.querySelectorAll('.sector-filter'))filter.addEventListener('change',()=>{
 const plan=document.querySelector('[data-plan="'+filter.dataset.map+'"]');
 for(const node of plan.querySelectorAll('.sector'))node.classList.toggle('inactive',Number([...node.classList].find(v=>/^sector-\d$/.test(v)).slice(-1))>Number(filter.value));
});