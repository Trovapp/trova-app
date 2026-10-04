// 장소 이름 뒤에 붙는 조사를 받침에 맞춰 고른다(디자인 QA W2). 예전엔 "을(를)"처럼 둘 다 적었다.
// 끝 글자가 한글이 아니면(영문·숫자·기호) 받침을 알 수 없어 예전처럼 둘 다 적는다.
function hasFinalConsonant(word: string): boolean | null {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  return (code - 0xac00) % 28 !== 0;
}

/** 목적격 조사만 돌려준다: objectParticle("만두") → "를", objectParticle("국밥") → "을". 따옴표로 감쌀 때도 이름만 넘긴다. */
export function objectParticle(word: string): string {
  const batchim = hasFinalConsonant(word);
  return batchim === null ? "을(를)" : batchim ? "을" : "를";
}
