// Normalized vector strokes survive resizing and retain one pad per character.
export function drawPad(canvas,strokes=[]){
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const size=canvas.width;ctx.clearRect(0,0,size,size);
 ctx.strokeStyle='#b8c6c3';ctx.lineWidth=1;ctx.setLineDash([5,6]);
 ctx.beginPath();ctx.moveTo(size/2,0);ctx.lineTo(size/2,size);ctx.moveTo(0,size/2);ctx.lineTo(size,size/2);ctx.stroke();ctx.setLineDash([]);
 ctx.strokeStyle='#183d38';ctx.lineWidth=size*.012;ctx.lineCap='round';ctx.lineJoin='round';
 for(const stroke of strokes){if(!stroke.length)continue;ctx.beginPath();ctx.moveTo(stroke[0][0]*size,stroke[0][1]*size);for(const [x,y] of stroke)ctx.lineTo(x*size,y*size);if(stroke.length===1)ctx.lineTo(stroke[0][0]*size+.1,stroke[0][1]*size+.1);ctx.stroke();}
}
export function attachPad(canvas,strokes,save){
 drawPad(canvas,strokes);let stroke=null,pointer=null;
 const point=e=>{const r=canvas.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))];};
 canvas.onpointerdown=e=>{if(pointer!==null||e.button>0)return;e.preventDefault();pointer=e.pointerId;canvas.setPointerCapture(pointer);stroke=[point(e)];drawPad(canvas,[...strokes,stroke]);};
 canvas.onpointermove=e=>{if(e.pointerId!==pointer||!stroke)return;e.preventDefault();if(stroke.length<4000)stroke.push(point(e));drawPad(canvas,[...strokes,stroke]);};
 const end=e=>{if(e.pointerId!==pointer||!stroke)return;strokes.push(stroke);stroke=null;pointer=null;drawPad(canvas,strokes);save(strokes);};
 canvas.onpointerup=end;canvas.onpointercancel=end;canvas.onlostpointercapture=end;
}
