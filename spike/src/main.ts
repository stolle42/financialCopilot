import {validate} from './domain/expenseValidator.ts'

const outElem=document.getElementById("outLabel");
if(outElem!=null){
    let warnings=validate(0,"");
    outElem.textContent= warnings.toString();
}