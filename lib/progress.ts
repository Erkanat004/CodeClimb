// Clock ticks are saved periodically but must not block navigation or logout.
// Changed code, avatar or completed levels still require a successful save.
export function sameProgressContent(a:string,b:string){
  if(!a||!b)return false;
  try{
    const left=JSON.parse(a),right=JSON.parse(b);
    return left.completed===right.completed&&left.avatar===right.avatar&&JSON.stringify(left.drafts)===JSON.stringify(right.drafts);
  }catch{return false;}
}
