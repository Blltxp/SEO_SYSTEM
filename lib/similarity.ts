export function similarity(a: string, b: string) {

  const wordsA = a.split(" ")
  const wordsB = b.split(" ")

  const common = wordsA.filter(w => wordsB.includes(w))

  return common.length / Math.max(wordsA.length, wordsB.length)

}