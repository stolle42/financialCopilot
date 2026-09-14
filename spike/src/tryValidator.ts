import {validate} from './domain/expenseValidator.ts'

console.log(validate(0,"x"));
console.log(validate(10,""));
console.log(validate(10,"x"));