import { PNG } from 'pngjs';

export function decode(buffer) { return PNG.sync.read(buffer, { checkCRC: true }); }
export function rasterCoverage(original, hidden, boxes) {
  if(original.width!==hidden.width || original.height!==hidden.height) throw new Error('Counterfactual dimensions changed');
  const {width,height,data}=original;
  const covered=new Uint8Array(width*height);
  const ink=boxes.map(()=>0);
  for(const b of boxes) for(let y=b.bbox[1];y<b.bbox[1]+b.bbox[3];y++) for(let x=b.bbox[0];x<b.bbox[0]+b.bbox[2];x++) covered[y*width+x]=1;
  let changed=0,outside=0;
  const mask=new Uint8Array(width*height);
  for(let p=0;p<width*height;p++) {
    const i=p*4;
    if(Math.max(Math.abs(data[i]-hidden.data[i]),Math.abs(data[i+1]-hidden.data[i+1]),Math.abs(data[i+2]-hidden.data[i+2]))>2) {
      changed++;mask[p]=1;if(!covered[p])outside++;
    }
  }
  boxes.forEach((b,j)=>{for(let y=b.bbox[1];y<b.bbox[1]+b.bbox[3];y++)for(let x=b.bbox[0];x<b.bbox[0]+b.bbox[2];x++)ink[j]+=mask[y*width+x];});
  return {changed_pixels:changed,outside_pixels:outside,covered_fraction:changed?1-outside/changed:1,fragment_ink_pixels:ink,mask};
}
export function encodeMask(mask,width,height){
  const out=new PNG({width,height});
  for(let p=0;p<mask.length;p++){const i=p*4;out.data[i]=out.data[i+1]=out.data[i+2]=mask[p]?255:0;out.data[i+3]=255;}
  return PNG.sync.write(out,{colorType:0});
}
export function resizeGray(png, size=32) {
  const out=new Float64Array(size*size);
  for(let oy=0;oy<size;oy++)for(let ox=0;ox<size;ox++) {
    const x0=Math.floor(ox*png.width/size),x1=Math.max(x0+1,Math.floor((ox+1)*png.width/size));
    const y0=Math.floor(oy*png.height/size),y1=Math.max(y0+1,Math.floor((oy+1)*png.height/size));
    let total=0,n=0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*png.width+x)*4;total+=0.2126*png.data[i]+0.7152*png.data[i+1]+0.0722*png.data[i+2];n++;}
    out[oy*size+ox]=total/n;
  }
  return out;
}
export function perceptualHash(gray) {
  const coefficients=[];
  for(let v=0;v<8;v++)for(let u=0;u<8;u++){
    let sum=0;
    for(let y=0;y<32;y++)for(let x=0;x<32;x++)sum+=gray[y*32+x]*Math.cos((2*x+1)*u*Math.PI/64)*Math.cos((2*y+1)*v*Math.PI/64);
    coefficients.push(sum);
  }
  const sorted=coefficients.slice(1).sort((a,b)=>a-b),median=sorted[31];
  let hash=0n;
  coefficients.forEach((value,i)=>{if(i && value>median)hash|=1n<<BigInt(i);});
  return hash.toString(16).padStart(16,'0');
}
export function hamming(a,b){let bits=BigInt('0x'+a)^BigInt('0x'+b),n=0;while(bits){bits&=bits-1n;n++;}return n;}
export function grayDifference(a,b){let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return sum/a.length;}
