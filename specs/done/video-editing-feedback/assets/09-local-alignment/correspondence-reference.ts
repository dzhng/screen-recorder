import {foldWord} from '/Users/server/dev/yap-video-editing/packages/core/src/word-kind.ts';
export function correspond(supplied:string[],observed:string[]){
 const a=supplied.map(foldWord),b=observed.map(foldWord),N=a.length,M=b.length;
 const prefix=Array.from({length:N+1},()=>Array(M+1).fill(0)),suffix=Array.from({length:N+1},()=>Array(M+1).fill(0));
 for(let i=0;i<N;i++)for(let j=0;j<M;j++)prefix[i+1][j+1]=Math.max(prefix[i][j+1],prefix[i+1][j],a[i]!==''&&a[i]===b[j]?prefix[i][j]+1:0);
 for(let i=N-1;i>=0;i--)for(let j=M-1;j>=0;j--)suffix[i][j]=Math.max(suffix[i+1][j],suffix[i][j+1],a[i]!==''&&a[i]===b[j]?suffix[i+1][j+1]+1:0);
 const optimum=suffix[0][0];
 const requested=a.map((_,i)=>{const possible=b.flatMap((_,j)=>a[i]!==''&&a[i]===b[j]&&prefix[i][j]+1+suffix[i+1][j+1]===optimum?[j]:[]);const omissionPossible=b.length===0||Array.from({length:M+1},(_,j)=>prefix[i][j]+suffix[i+1][j]===optimum).some(Boolean);return {index:i,text:supplied[i],folded:a[i],status:possible.length===1&&!omissionPossible?'matched':possible.length===0?'unmatched':'unknown',observedIndices:possible,omissionPossible};});
 const observedRows=b.map((_,j)=>{const possible=requested.flatMap(r=>r.observedIndices.includes(j)?[r.index]:[]);const extraPossible=Array.from({length:N+1},(_,i)=>prefix[i][j]+suffix[i][j+1]===optimum).some(Boolean);return {index:j,text:observed[j],folded:b[j],status:possible.length===1&&!extraPossible?'matched':possible.length===0?'observed_extra':'unknown',suppliedIndices:possible,extraPossible};});
 return {optimum,requested,observed:observedRows};
}
