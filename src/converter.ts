// Разбивает строку на отдельные части, чтобы затем собрать её в нужном стиле.
// Например: "user_name" -> ["user", "name"], "userName" -> ["user", "name"].
function convertToSnake(ar: string[]): string {
    return ar.join('_');
}

// Для camelCase первое слово оставляем в нижнем регистре, а остальные слова
// начинаем с заглавной буквы. Например: ["user", "name"] -> "userName".
function convertToCamel(ar: string[]): string {
    return ar
        .map((str, index) => (index === 0 ? str : str[0].toUpperCase() + str.slice(1)))
        .join('');
}

// Для PascalCase каждое слово начинается с заглавной буквы, независимо от позиции.
// Например: ["user", "name"] -> "UserName".
function convertToPascal(ar: string[]): string {
    return ar
        .map(str => str[0].toUpperCase() + str.slice(1))
        .join('');
}

// Главная функция преобразования. Сначала исходная строка разделяется на слова,
// затем выбирается нужный формат записи и собирается итоговое имя.
export function convert(str: string, newStyle: NamingStyle): string {
    let ar: string[] = convertToArray(str);
    switch(newStyle) {
        case NamingStyle.SnakeCase:
            return convertToSnake(ar);
        case NamingStyle.CamelCase:
            return convertToCamel(ar);
        case NamingStyle.PascalCase:
            return convertToPascal(ar);
        default:
            return str;
    }
}

// Разбирает строку на массив слов, учитывая следующие правила:
// - нижнее подчеркивание (_) разделяет слова;
// - заглавная буква внутри camelCase/PascalCase тоже считается началом нового слова;
// - все части приводятся к нижнему регистру для унификации.
function convertToArray(str: string): string[] {
    let ar: string[] = [];
    let start = 0;
    let i = 0;
    while (i < str.length) {
        let ch = str[i];
        if (ch === '_') {
            let cur: string = str.slice(start, i).toLowerCase();
            if (cur.length > 0) {
                ar.push(cur);
            }
            start = i + 1;
            i++;
        } 
        else if (ch === ch.toUpperCase() && i !== 0 && ch !== ch.toLowerCase()){
            let cur: string = str.slice(start, i).toLowerCase();
            ar.push(cur);
            start = i;
            i++;
        }
        else if (i + 1 === str.length) {
            let cur: string = str.slice(start, i + 1).toLowerCase();
            ar.push(cur);
            i++;
        }
        else {
            i++;
        }
    }
    return ar;
}

// Определяет текущий стиль имени по шаблону: snake_case, camelCase или PascalCase.
// Если имя не соответствует ни одному формату, возвращается Unknown.
export function detectStyle(str: string): NamingStyle {
    const snakePattern = /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/;
    const camelPattern = /^[a-z][a-z0-9]*([A-Z][a-z0-9]*)+$/;
    const pascalPattern = /^[A-Z][a-z0-9]*([A-Z][a-z0-9]*)+$/;
    if (snakePattern.test(str)) {
        return NamingStyle.SnakeCase;
    }
    if (camelPattern.test(str)) {
        return NamingStyle.CamelCase;
    }
    if (pascalPattern.test(str)){
        return NamingStyle.PascalCase;
    }
    return NamingStyle.Unknown;
}


// Перечисление всех поддерживаемых стилей именования.
export enum NamingStyle {
    SnakeCase = "snake_case",
    CamelCase = "camelCase",
    PascalCase = "PascalCase",
    Unknown = "unknown",
}

// Описание токена идентификатора: само имя, стиль, тип, а также позиция в тексте.
// Эта структура нужна, чтобы после распознавания заменить переменную в нужном месте.
export interface VariableToken {
    name: string
    style: NamingStyle
    type: IdentifierType;
    posStart: number
    posEnd: number
}

// Типы идентификаторов, которые может распознавать расширение.
export enum IdentifierType {
    Variable = 'variable',
    FunctionCall = 'function_call',
    Property = 'property'
}

// Поиск всех идентификаторов в тексте и фильтрация только тех, которые были
// распознаны как фактические переменные по семантическим токенам языка.
// После этого определяется стиль текущего имени и сохраняется позиция для замены.
export function extractVariables(text: string, knownVariables: Set<string>): VariableToken[] {
    const tokens: VariableToken[] = [];
    const identifierRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    let match: RegExpExecArray | null;

    while((match = identifierRegex.exec(text)) !== null){
        const word = match[0];

        if (knownVariables.has(word)){
            const style = detectStyle(word);
            
            if (style !== NamingStyle.Unknown){
                tokens.push({
                    name: word,
                    style: style,
                    type: IdentifierType.Variable,
                    posStart: match.index,
                    posEnd: match.index + word.length
                });
            }
        }
    }
    return tokens;
}