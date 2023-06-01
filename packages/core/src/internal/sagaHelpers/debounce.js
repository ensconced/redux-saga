import fsmIterator, { safeName } from './fsmIterator'
import { delay, fork, race, take } from '../io'

export default function debounceHelper(delayLengthOrOptions, patternOrChannel, worker, ...args) {
  let action, raceOutput, delayLength, leading, trailing

  if (typeof delayLengthOrOptions === 'number') {
    delayLength = delayLengthOrOptions
    leading = false
    trailing = true
  } else {
    ;({ delayLength, leading = false, trailing = true } = delayLengthOrOptions)
  }

  const yTake = { done: false, value: take(patternOrChannel) }
  const yRace = {
    done: false,
    value: race({
      action: take(patternOrChannel),
      debounce: delay(delayLength),
    }),
  }
  const yFork = (ac) => ({ done: false, value: fork(worker, ...args, ac) })
  const yNoop = (value) => ({ done: false, value })

  const setAction = (ac) => (action = ac)
  const setRaceOutput = (ro) => (raceOutput = ro)

  return fsmIterator(
    {
      q1() {
        return { nextState: 'q2', effect: yTake, stateUpdater: setAction }
      },
      q2() {
        return { nextState: 'q3', effect: yRace, stateUpdater: setRaceOutput }
      },
      q3() {
        return raceOutput.debounce
          ? { nextState: 'q1', effect: yFork(action) }
          : { nextState: 'q2', effect: yNoop(raceOutput.action), stateUpdater: setAction }
      },
    },
    'q1',
    `debounce(${safeName(patternOrChannel)}, ${worker.name})`,
  )
}
