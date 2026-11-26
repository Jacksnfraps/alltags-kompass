// Generates PNG app icons (apple-touch-icon etc.) without dependencies: node scripts/make-icons.mjs
import {deflateSync} from 'node:zlib';
import {writeFileSync} from 'node:fs';
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=buf=>{let c=0xffffffff;for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type),data]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([len,td,c]);}
function png(size,pixel){
  const raw=Buffer.alloc((size*4+1)*size);const S=4;
  for(let y=0;y<size;y++){raw[y*(size*4+1)]=0;for(let x=0;x<size;x++){let r=0,g=0,b=0;
    for(let sy=0;sy<S;sy++)for(let sx=0;sx<S;sx++){const [pr,pg,pb]=pixel((x+(sx+.5)/S)/size,(y+(sy+.5)/S)/size);r+=pr;g+=pg;b+=pb;}
    const o=y*(size*4+1)+1+x*4;raw[o]=r/S/S;raw[o+1]=g/S/S;raw[o+2]=b/S/S;raw[o+3]=255;}}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
const BG=[7,9,11],RING=[28,58,46],GREEN=[16,185,129];
function pixel(u,v){
  const x=u-.5,y=v-.5,d=Math.hypot(x,y);
  if(Math.abs(d-.33)<.012)return RING;
  // eight-armed asterisk
  const a=Math.atan2(y,x);let best=1;
  for(let k=0;k<4;k++){const ang=k*Math.PI/4;const along=Math.abs(x*Math.cos(ang)+y*Math.sin(ang));const across=Math.abs(-x*Math.sin(ang)+y*Math.cos(ang));if(along<.22)best=Math.min(best,across);}
  if(best<.028)return GREEN;
  return BG;
}
for(const size of [180,512])writeFileSync(new URL(`../icon-${size}.png`,import.meta.url),png(size,pixel));
console.log('icon-180.png, icon-512.png geschrieben');
