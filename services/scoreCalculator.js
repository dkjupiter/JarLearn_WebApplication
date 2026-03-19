// single

function calculateSingleScore({ isCorrect, timeSpent, maxTime }) {
  const bonus = Math.max(0, Math.floor((maxTime - timeSpent) * 2));
  if (!isCorrect) return 0;
  return 100 + bonus;
}

// multiple (soft penalty)
function calculateMultipleScore({
  correctCount,
  wrongCount,
  maxTime,
  timeSpent
}) {
  const bonus = Math.max(0, Math.floor((maxTime - timeSpent) * 2));
  if (wrongCount === 0) {
    return 100 + bonus;
  }else{
    return 0;
  }
}

function calculateOrderingScore({
  correctOrder,
  studentOrder,
  maxTime,
  timeSpent,
}) {

  const isCorrect =
    correctOrder.length === studentOrder.length &&
    correctOrder.every((id, index) => id === studentOrder[index]);

  if (!isCorrect) return 0;

  const bonus = Math.max(0, Math.floor((maxTime - timeSpent) * 2));
  console.log("maxTime =", maxTime);
  console.log("timeSpent =", timeSpent);
  console.log("bonus =", bonus);


  return 100 + bonus;
}


module.exports = {
  calculateSingleScore,
  calculateMultipleScore,
  calculateOrderingScore,
};
