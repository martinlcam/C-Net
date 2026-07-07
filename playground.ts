async function calcProfitLoss(startingMoney: number, leavingMoney: number) {
  const profitLoss = leavingMoney - startingMoney
  return profitLoss
}


async function main() {
  const result = await calcProfitLoss(100, 150)
  console.log(result) // 50 profit

  const loss = await calcProfitLoss(100, 75)
  console.log(loss) // -25 loss
}

main()

"Would you hesitate to throw a bundle of logs onto a fire... because you pitied the tree they came from?"
a