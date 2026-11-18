// The drawing result is ONE grade for EACH written character. The lowest
// character grade schedules the word; every explicit character grade is kept
// as independent evidence across words. No sketches are saved to history.
export const DRAWING_RATINGS=Object.freeze([
 {key:'forgotten',label:'Again',grade:1},
 {key:'difficult',label:'Hard',grade:2},
 {key:'recalled',label:'Good',grade:3},
 {key:'easy',label:'Easy',grade:4}
]);
export function ratingGrade(key){return DRAWING_RATINGS.find(x=>x.key===key)?.grade??null;}
export function drawingResult(hanzi,ratings){
 const chars=[...String(hanzi||'')];
 if(!chars.length||!ratings)return null;
 const history=[];
 for(let index=0;index<chars.length;index++){
  const rating=ratings[index],grade=ratingGrade(rating);
  if(!grade)return null;
  history.push({character:chars[index],rating,grade});
 }
 return {grade:Math.min(...history.map(x=>x.grade)),characters:history};
}
export function withDrawingRating(ratings,index,choice,length){
 if(!Number.isInteger(index)||index<0||index>=length||!ratingGrade(choice))return null;
 return {...(ratings||{}),[index]:choice};
}
