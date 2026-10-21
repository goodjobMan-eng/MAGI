// Coordinates refer to the exhibits at Imjingak, not the former Jangdan station.
export const PLACES={
 train:{name:'장단역 증기기관차',lat:37.8902667,lon:126.7387167,radius:100,chapter:'CH04',hint:'기관차의 둥근 윗부분이 보이는 정면에서 윤곽에 맞춰 주세요. 안전 난간 밖에서 촬영해 주세요.'},
 bridge:{name:'독개다리',lat:37.8902667,lon:126.7387167,radius:120,chapter:'CH06',hint:'독개다리 입구의 아치와 양쪽 문기둥을 정면으로 담아 주세요.'},
 altar:{name:'망배단',lat:37.8894573,lon:126.7405547,radius:100,chapter:'CH10',hint:'계단 아래에서 가운데 비석과 양옆 석판을 정면으로 담아 주세요.'}
};
export const placeForChapter=id=>Number(id.slice(2))<4?null:Number(id.slice(2))>=10?'altar':Number(id.slice(2))>=6?'bridge':'train';
export function distanceMeters(a,b){
 const rad=v=>v*Math.PI/180,dy=rad(b.lat-a.lat),dx=rad(b.lon-a.lon);
 const h=Math.sin(dy/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dx/2)**2;
 return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
export function checkPosition(position,place,now=Date.now()){
 const c=position.coords;
 if(![c.latitude,c.longitude,c.accuracy,position.timestamp].every(Number.isFinite)||c.accuracy<0)return {ok:false,reason:'위치 정보를 읽지 못했습니다. 다시 확인해 주세요.'};
 if(now-position.timestamp>30000||position.timestamp>now+5000)return {ok:false,reason:'위치 정보가 오래되었습니다. 다시 확인해 주세요.'};
 if(c.accuracy>65)return {ok:false,reason:'위치 오차가 큽니다. 탁 트인 곳에서 다시 확인해 주세요.'};
 const distance=distanceMeters({lat:c.latitude,lon:c.longitude},place);
 return distance<=place.radius?{ok:true,distance}:{ok:false,distance,reason:`${place.name}에서 약 ${Math.round(distance)}m 떨어져 있습니다. 전시물 가까이에서 다시 확인해 주세요.`};
}
