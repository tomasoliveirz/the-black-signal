// Proposed reference-level data. Other four maps retain their existing layouts until owner approval.
export const REFERENCES={
 foundry:{
  spawn:{x:-1,z:2},lanterns:[[-6,-7],[20,-31],[-23,-60]],extraction:{x:19,z:-89,r:4.5},transmitters:[[-8,-17],[7,-44.5],[-10,-66]],
  landmarks:[
   {id:'receiving',name:'Receiving',x:-8,z:-17,zone:0,purpose:'Power distribution and initial cooperation'},
   {id:'smelting',name:'Smelting controls',x:7,z:-44.5,zone:1,purpose:'Two furnace-side approaches and a west maintenance loop'},
   {id:'maintenance',name:'Maintenance',x:-10,z:-66,zone:2,purpose:'Final relay away from both loading exits'},
   {id:'loading',name:'Loading apron',x:19,z:-89,zone:2,purpose:'Extraction beyond two real rear doorways'},
  ],
  routes:[
   {id:'main',width:3.2,points:[[-1,2],[-5.5,-17],[0,-26],[0,-42],[5,-44.5],[0,-56],[5,-60],[23,-60],[19,-83],[19,-89]]},
   {id:'east',width:2.4,points:[[-1,2],[8,-17],[16,-22],[16,-26],[22,-44],[9,-46],[5,-48],[5,-44.5]]},
   {id:'west-loop',width:2.2,points:[[0,-26],[0,-29],[-23,-32],[-23,-45],[-10,-46],[0,-42]]},
   {id:'maintenance',width:2.2,points:[[-10,-46],[-16,-56],[-8,-66],[-15,-77],[-15,-83],[-15,-89],[19,-89]]},
   {id:'final-cross',width:3,points:[[-8,-66],[5,-60]]},
  ],
  sectorDepths:[[-25,8],[-55,-27],[-94,-57]],
  slots:[
   [[-10,-11],[20,-10],[7,-3],[-21,5],[-23,-17],[16,-14],[-22,-5],[22,1],[10,-22],[-5,6],[0,-20]],
   [[-9,-36],[22,-35],[-9,-40],[8,-52],[-19,-33],[18,-52],[-5,-31],[23,-49],[-10,-54],[5,-34],[0,-47]],
   [[-17,-62],[8,-64],[-23,-67],[6,-68],[-18,-79],[9,-69],[20,-62],[-4,-77],[23,-72],[-7,-59],[0,-64]],
  ],
  signs:[
   {x:0,z:-25.64,y:6,width:4,zone:1,label:'FURNACES · DAY {day}'},
   {x:16,z:-25.64,y:4,width:3.5,zone:1,label:'SERVICE · DAY {day}'},
   {x:0,z:-55.64,y:6,width:4,zone:2,label:'MAINTENANCE · DAY {day}'},
   {x:-16,z:-55.64,y:4,width:3.5,zone:2,label:'SERVICE · DAY {day}'},
   {x:19,z:-82.1,y:6.2,width:5,label:'LOADING EXIT'},
   {x:-15,z:-82.1,y:3.7,width:3.5,label:'SERVICE EXIT'},
  ],
 },
 ashfall:{
  baseHeight:0,surfaces:[{x:-8.4,z:-34,w:2.9,d:80,h:.08,family:'concrete'},{x:8.4,z:-34,w:2.9,d:80,h:.08,family:'concrete'},{x:-6.88,z:-34,w:.14,d:80,h:.12,family:'concrete'},{x:6.88,z:-34,w:.14,d:80,h:.12,family:'concrete'}],
  spawn:{x:0,z:2},powerPoles:[[-10,1],[10,-20],[-34,-52],[30,-70]],mast:{x:31,z:-64},lanterns:[[-8,-4],[7,-30],[-20,-52]],extraction:{x:-24,z:-58,r:4.5},transmitters:[[-8,-16],[-26,-41],[8,-65]],
  landmarks:[
   {id:'laundry',name:'Laundry corner',x:-8,z:-16,zone:0,purpose:'Recognisable storefront with a safe first repair approach'},
   {id:'rear-yard',name:'Motel service yard',x:-26,z:-41,zone:1,purpose:'Rear alley reached through either cross street'},
   {id:'freight',name:'Freight dispatch',x:8,z:-65,zone:2,purpose:'Warehouse-side relay with two approaches to evacuation'},
   {id:'courtyard',name:'Evacuation courtyard',x:-24,z:-58,zone:2,purpose:'Side courtyard away from the final transmitter'},
  ],
  routes:[
   {id:'high-street',width:7,pavedWidth:13.4,points:[[0,2],[0,-25],[0,-55],[0,-74]]},
   {id:'west-block',width:3.2,points:[[0,-25],[-26,-25],[-29,-31],[-29,-51],[-24,-55],[0,-55]]},
   {id:'east-block',width:2,points:[[9,-24],[30,-24],[30,-55.35],[9,-55.35],[9,-55]]},
   {id:'east-walk',width:2.4,points:[[0,-25],[9,-25],[9,-55],[0,-55]]},
   {id:'freight',width:2.4,points:[[9,-55],[10,-62.5],[10,-68],[8,-74]]},
   {id:'south-loop',width:3.2,points:[[0,-74],[-24,-74],[-24,-58],[-24,-55]]},
   {id:'laundry-front',width:2.4,points:[[0,-16],[-5.5,-16],[-5.5,-25]]},
   {id:'yard-repair',width:2.4,points:[[-26,-25],[-23.5,-38.5],[-23.5,-43.5],[-26,-51]]},
  ],
  sectorDepths:[[-25,8],[-55,-27],[-80,-57]],
  slots:[
   [[-8,-8],[8,-21],[-8,-22],[8,-3],[-24,-11],[23,0],[-25,-18],[25,-3],[-6,7],[6,7],[0,-21]],
   [[-21,-33],[6,-34],[-21,-47],[6,-50],[-32,-36],[-32,-46],[32,-29],[32,-48],[-8,-32],[-8,-48],[0,-46]],
   [[-21,-64],[5,-76],[-20,-69],[-8,-61],[-11,-65],[-4,-78],[-17,-62],[-17,-69],[-7,-70],[-8,-58],[0,-66]],
  ],
  signs:[
   {x:-8.8,z:-20,y:3.3,width:3.5,zone:0,label:'LAUNDRY · DAY {day}',post:true},
   {x:-19.6,z:-36,y:3.3,width:3.5,yaw:-Math.PI/2,zone:1,label:'SERVICE YARD · DAY {day}'},
   {x:11.1,z:-69,y:3.3,width:3.5,yaw:-Math.PI/2,zone:2,label:'FREIGHT · DAY {day}',post:true},
   {x:-17,z:-61,y:3.3,width:3.5,label:'EVACUATION COURT',post:true},
  ],
 },
};
