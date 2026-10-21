// Project a fixed sheet of writing onto the four corners of the pictured paper.
export function paperMatrix(width,height,quad){
 const from=[[0,0],[width,0],[width,height],[0,height]],a=[];
 from.forEach(([x,y],i)=>{const [u,v]=quad[i];a.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]);});
 for(let col=0;col<8;col++){
  let pivot=col;for(let r=col+1;r<8;r++)if(Math.abs(a[r][col])>Math.abs(a[pivot][col]))pivot=r;
  [a[col],a[pivot]]=[a[pivot],a[col]];
  if(Math.abs(a[col][col])<1e-10)throw Error('Invalid paper corners');
  const k=a[col][col];for(let j=col;j<9;j++)a[col][j]/=k;
  for(let r=0;r<8;r++)if(r!==col){const f=a[r][col];for(let j=col;j<9;j++)a[r][j]-=f*a[col][j];}
 }
 const h=a.map(row=>row[8]);
 return [h[0],h[3],0,h[6],h[1],h[4],0,h[7],0,0,1,0,h[2],h[5],0,1];
}
export function renderInk(container,image,items=[]){
 container.replaceChildren();
 if(!image.naturalWidth||!image.naturalHeight)return;
 const box=image.getBoundingClientRect(),scale=Math.min(image.clientWidth/image.naturalWidth,image.clientHeight/image.naturalHeight);
 const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
 Object.assign(container.style,{inset:'auto',left:(image.clientWidth-w)/2+'px',top:(image.clientHeight-h)/2+'px',width:w+'px',height:h+'px'});
 for(const item of items||[]){
  const o=document.createElement('div');o.className='overlay '+(item.font||'')+(item.vertical?' vertical':'');o.textContent=item.text;
  if(item.quad){
   const pw=item.paperWidth||400,ph=item.paperHeight||240;
   const matrix=paperMatrix(pw,ph,item.quad.map(([x,y])=>[x*w/100,y*h/100]));
   Object.assign(o.style,{left:'0',top:'0',width:pw+'px',height:ph+'px',fontSize:(item.size||30)+'px',lineHeight:item.lineHeight||1.25,transformOrigin:'0 0',transform:`matrix3d(${matrix.join(',')})`,overflow:'hidden'});
  }else{
   Object.assign(o.style,{left:item.x+'%',top:item.y+'%',width:item.w+'%',height:item.vertical?'70%':'auto',fontSize:Math.max(10,w*.019)+'px',transform:`rotate(${item.rot||0}deg)`});
  }
  container.append(o);
 }
}
