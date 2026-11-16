// Original line guides. 장단 열차: production/location-sources.md의 정면 사진.
// 자유의 다리·망배단: 2026-11-16 감독 현장 사진에서 그림(망배단은 계단 아래 돌마당, 주차장에 들어가지 않는 자리).
// A geometric alignment aid, not a semantic landmark classifier.
export const GUIDE_VERSION=2;
export const GUIDES={
 train:{label:'기관차의 둥근 윗부분과 아래 받침',paths:[[[0.528125,0.5625],[0.53125,0.4],[0.546875,0.3416666666666667],[0.584375,0.2916666666666667],[0.63125,0.2708333333333333],[0.68125,0.2875],[0.71875,0.3375],[0.740625,0.42916666666666664],[0.746875,0.5666666666666667]],[[0.528125,0.5625],[0.746875,0.5666666666666667]],[[0.55,0.3625],[0.71875,0.3625],[0.73125,0.55],[0.54375,0.55],[0.55,0.3625]],[[0.50625,0.6],[0.753125,0.6],[0.759375,0.65],[0.50625,0.65],[0.50625,0.6]]]},
bridge:{label:'자유의 다리 양쪽 난간과 흰 줄',paths:[[[0.0,0.59],[0.4125,0.535]],[[0.0,0.7183],[0.4125,0.5517]],[[0.05,0.8867],[0.4125,0.59]],[[0.525,0.5283],[1.0,0.6017]],[[0.5312,0.5467],[1.0,0.7333]],[[0.5875,0.6283],[0.875,0.95]]]},
 altar:{label:'망배단 가운데 비석과 안쪽 석판',paths:[[[0.4462,0.165],[0.4,0.165],[0.4425,0.11],[0.4637,0.165]],[[0.5563,0.105],[0.5988,0.1633],[0.6125,0.8083]],[[0.4487,0.7333],[0.4475,0.2133],[0.4637,0.2117],[0.5513,0.2117],[0.5513,0.7333]],[[0.2188,0.9333],[0.2188,0.8083],[0.3275,0.8083]],[[0.49,0.8083],[0.675,0.8083],[0.675,0.9333]],[[0.2963,0.8083],[0.2963,0.5183],[0.3875,0.5183]],[[0.6275,0.8083],[0.6275,0.52],[0.7712,0.52],[0.7712,0.9]]]}
};
export function guideMarkup(key){
 const g=GUIDES[key];return `<svg viewBox="0 0 320 240" role="img" aria-label="${g.label} 실루엣" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${g.paths.map(p=>`<polyline points="${p.map(([x,y])=>`${x*320},${y*240}`).join(' ')}"/>`).join('')}</g></svg>`;
}
export function cropFrame(source,canvas){
 const w=source.videoWidth||source.width,h=source.videoHeight||source.height;
 if(!w||!h)throw Error('카메라가 준비되지 않았습니다.');
 const ratio=canvas.width/canvas.height,sw=Math.min(w,h*ratio),sh=sw/ratio;
 canvas.getContext('2d',{willReadFrequently:true}).drawImage(source,(w-sw)/2,(h-sh)/2,sw,sh,0,0,canvas.width,canvas.height);
 return canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height);
}
export function matchGuide({data,width:w,height:h},key){
 const guide=GUIDES[key];if(!guide||w<32||h<24)return {ok:false,score:0,reason:'촬영 화면을 다시 열어 주세요.'};
 const gray=new Float32Array(w*h),blur=new Float32Array(w*h),mag=new Float32Array(w*h),gx=new Float32Array(w*h),gy=new Float32Array(w*h);
 let sum=0,sum2=0;
 for(let i=0;i<w*h;i++){const v=.299*data[i*4]+.587*data[i*4+1]+.114*data[i*4+2];gray[i]=v;sum+=v;sum2+=v*v;}
 const mean=sum/(w*h),contrast=Math.sqrt(Math.max(0,sum2/(w*h)-mean*mean));
 if(mean<25||mean>238||contrast<14)return {ok:false,score:0,reason:'주변이 잘 보이도록 밝기와 렌즈를 확인해 주세요.'};
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;blur[i]=(gray[i]*4+(gray[i-1]+gray[i+1]+gray[i-w]+gray[i+w])*2+gray[i-w-1]+gray[i-w+1]+gray[i+w-1]+gray[i+w+1])/16;}
 const histogram=[];
 for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){const i=y*w+x;gx[i]=blur[i+1]-blur[i-1];gy[i]=blur[i+w]-blur[i-w];mag[i]=Math.hypot(gx[i],gy[i]);histogram.push(mag[i]);}
 histogram.sort((a,b)=>a-b);const threshold=Math.max(18,histogram[Math.floor(histogram.length*.82)]);
 let edges=0;for(const v of mag)if(v>=threshold)edges++;
 if(edges/(w*h)>.27)return {ok:false,score:0,reason:'배경이 너무 복잡합니다. 대상 정면에서 가이드를 맞춰 주세요.'};
 const groups=[],directions=[[0,0],[0,0],[0,0]];let total=0,hits=0;
 for(const path of guide.paths){let count=0,hit=0;
  for(let j=1;j<path.length;j++){
   const [ax,ay]=[path[j-1][0]*w,path[j-1][1]*h],[bx,by]=[path[j][0]*w,path[j][1]*h],dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy),steps=Math.max(1,Math.ceil(len/3));
   for(let n=0;n<steps;n++){
    const x=Math.round(ax+dx*n/steps),y=Math.round(ay+dy*n/steps);let found=false;
    for(let yy=Math.max(2,y-4);yy<=Math.min(h-3,y+4)&&!found;yy++)for(let xx=Math.max(2,x-4);xx<=Math.min(w-3,x+4);xx++){
     const i=yy*w+xx;if(mag[i]>=threshold&&Math.abs(gx[i]*(-dy)+gy[i]*dx)/(mag[i]*len)>.86){found=true;break;}
    }count++;if(found)hit++;const bucket=Math.abs(dx)>Math.abs(dy)*2?0:Math.abs(dy)>Math.abs(dx)*2?1:2;directions[bucket][0]++;if(found)directions[bucket][1]++;
   }
  }groups.push(hit/Math.max(1,count));hits+=hit;total+=count;
 }
 const coverage=hits/Math.max(1,total),ok=coverage>=.70&&groups.every(v=>v>=.46)&&directions.every(([count,hit])=>count<15||hit/count>=.50);
 return {ok,score:Math.round(coverage*100),groups,reason:ok?'윤곽이 맞았습니다. 흔들리지 않게 촬영해 주세요.':'실루엣과 실제 대상의 크기·위치를 맞춰 주세요.'};
}
