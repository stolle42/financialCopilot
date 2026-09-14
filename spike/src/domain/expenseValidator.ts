export function validate(amount: number, category: string){
    const problems:string[]=[];
    if(amount<=0)
        problems.push("amount is not positive");
    if(!category)
        problems.push("category is missing");

    return problems;
}